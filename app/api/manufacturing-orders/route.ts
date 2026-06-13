import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { MOStatus } from "@prisma/client";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "read", "ManufacturingOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;

    const mos = await db.manufacturingOrder.findMany({
      where: { companyId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            procurementType: true,
          },
        },
        components: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        workOrders: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Extract SalesOrderItem IDs for MTO orders (where moNumber starts with MTO-)
    const mtoMoNumbers = mos
      .filter((mo) => mo.moNumber.startsWith("MTO-"))
      .map((mo) => mo.moNumber.replace("MTO-", ""));

    // Query details for these Sales Order Items
    const salesOrderLines = mtoMoNumbers.length > 0
      ? await db.salesOrderItem.findMany({
          where: { id: { in: mtoMoNumbers } },
          include: {
            salesOrder: {
              select: {
                orderNumber: true,
                customerName: true,
              },
            },
          },
        })
      : [];

    const salesOrderLinesMap = new Map(
      salesOrderLines.map((line) => [line.id, line])
    );

    const result = mos.map((mo) => {
      let salesOrderInfo = null;
      if (mo.moNumber.startsWith("MTO-")) {
        const lineId = mo.moNumber.replace("MTO-", "");
        const line = salesOrderLinesMap.get(lineId);
        if (line) {
          salesOrderInfo = {
            id: line.id,
            orderNumber: line.salesOrder.orderNumber,
            customerName: line.salesOrder.customerName,
          };
        }
      }

      return {
        id: mo.id,
        moNumber: mo.moNumber,
        productId: mo.productId,
        productName: mo.product.name,
        productSku: mo.product.sku,
        quantity: mo.quantity,
        status: mo.status,
        companyId: mo.companyId,
        createdAt: mo.createdAt,
        updatedAt: mo.updatedAt,
        hasBom: !!mo.bomId,
        bomId: mo.bomId,
        bomReference: mo.bomReference,
        components: mo.components,
        workOrders: mo.workOrders,
        salesOrder: salesOrderInfo,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Failed to fetch MOs:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "write", "ManufacturingOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const body = await req.json();

    const { productId, quantity, bomId } = body;

    // Validate inputs
    if (!productId || typeof productId !== "string") {
      return NextResponse.json({ success: false, message: "Product ID is required." }, { status: 400 });
    }

    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json({ success: false, message: "Quantity must be greater than 0." }, { status: 400 });
    }

    // Verify product exists and is MAKE type
    const product = await db.product.findFirst({
      where: { id: productId, companyId },
    });

    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found." }, { status: 404 });
    }

    if (product.procurementType !== "MAKE") {
      return NextResponse.json(
        { success: false, message: "Manufacturing orders can only be created for products of type MAKE." },
        { status: 400 }
      );
    }

    // Resolve BoM to copy components/work orders from
    let finalBomId = bomId;
    if (!finalBomId) {
      const defaultBom = await db.billOfMaterials.findUnique({
        where: { productId },
      });
      if (defaultBom) {
        finalBomId = defaultBom.id;
      }
    }

    let bomReference = null;
    let bomComponents: any[] = [];
    let bomWorkOrders: any[] = [];
    let bomQuantity = 1;

    if (finalBomId) {
      const bom = await db.billOfMaterials.findFirst({
        where: { id: finalBomId, companyId },
        include: {
          components: true,
          workOrders: true,
        },
      });
      if (bom) {
        bomReference = bom.reference;
        bomComponents = bom.components;
        bomWorkOrders = bom.workOrders;
        bomQuantity = bom.quantity || 1;
      }
    }

    // Generate a unique MO number (e.g. MO-260613-1234)
    const dateStr = new Date()
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const moNumber = `MO-${dateStr}-${randomSuffix}`;

    // Create the MO in Draft status and clone components and work orders
    const mo = await db.$transaction(async (tx) => {
      const createdMo = await tx.manufacturingOrder.create({
        data: {
          moNumber,
          productId,
          quantity,
          bomId: finalBomId || null,
          bomReference,
          status: MOStatus.DRAFT,
          companyId,
          components: {
            create: bomComponents.map((comp) => ({
              productId: comp.productId,
              quantity: Math.max(1, Math.round(comp.quantity * (quantity / bomQuantity))),
            })),
          },
          workOrders: {
            create: bomWorkOrders.map((wo) => ({
              operation: wo.operation,
              workCenter: wo.workCenter,
              expectedDuration: wo.expectedDuration,
            })),
          },
        },
        include: {
          components: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          workOrders: true,
        },
      });

      // Log audit
      await logAudit(
        companyId,
        session.user.id,
        "ManufacturingOrder",
        createdMo.id,
        "CREATE",
        { after: createdMo }
      );

      return createdMo;
    });

    return NextResponse.json({ success: true, data: mo });
  } catch (error) {
    console.error("Failed to create MO:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
