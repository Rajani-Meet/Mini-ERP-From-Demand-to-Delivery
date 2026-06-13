import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "read", "BillOfMaterials")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;

    const boms = await db.billOfMaterials.findMany({
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
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: boms });
  } catch (error) {
    console.error("Failed to fetch BoMs:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "write", "BillOfMaterials")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const body = await req.json();

    const { productId, quantity = 1, components } = body;

    // Validate inputs
    if (!productId || typeof productId !== "string") {
      return NextResponse.json({ success: false, message: "Parent product ID is required." }, { status: 400 });
    }

    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json({ success: false, message: "Parent product quantity must be greater than 0." }, { status: 400 });
    }

    if (!Array.isArray(components) || components.length === 0) {
      return NextResponse.json({ success: false, message: "At least one component is required for a BoM." }, { status: 400 });
    }

    // Verify parent product
    const parentProduct = await db.product.findFirst({
      where: { id: productId, companyId },
    });

    if (!parentProduct) {
      return NextResponse.json({ success: false, message: "Parent product not found in this company." }, { status: 404 });
    }

    if (parentProduct.procurementType !== "MAKE") {
      return NextResponse.json({ success: false, message: "Parent product must have procurement type MAKE." }, { status: 400 });
    }

    // Verify if BoM already exists for this product
    const existingBoM = await db.billOfMaterials.findUnique({
      where: { productId },
    });

    if (existingBoM) {
      return NextResponse.json({ success: false, message: "A Bill of Materials already exists for this product." }, { status: 400 });
    }

    // Verify all component products
    for (const comp of components) {
      if (!comp.productId || typeof comp.quantity !== "number" || comp.quantity <= 0) {
        return NextResponse.json(
          { success: false, message: "Each component must have a valid product and quantity greater than 0." },
          { status: 400 }
        );
      }

      const compProduct = await db.product.findFirst({
        where: { id: comp.productId, companyId },
      });

      if (!compProduct) {
        return NextResponse.json(
          { success: false, message: `Component product with ID ${comp.productId} not found.` },
          { status: 404 }
        );
      }
    }

    // Create BoM and components inside a transaction
    const newBoM = await db.$transaction(async (tx) => {
      const bom = await tx.billOfMaterials.create({
        data: {
          productId,
          quantity,
          companyId,
          components: {
            create: components.map((comp: { productId: string; quantity: number }) => ({
              productId: comp.productId,
              quantity: comp.quantity,
            })),
          },
        },
        include: {
          components: true,
        },
      });

      // Log Audit Trail
      await logAudit(
        companyId,
        session.user.id,
        "BillOfMaterials",
        bom.id,
        "CREATE",
        { after: bom }
      );

      return bom;
    });

    return NextResponse.json({ success: true, data: newBoM });
  } catch (error) {
    console.error("Failed to create BoM:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
