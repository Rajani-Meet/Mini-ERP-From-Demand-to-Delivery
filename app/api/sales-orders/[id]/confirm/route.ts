import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { recordStockMovement } from "@/lib/stock";
import { createManufacturingOrderFromSO } from "@/lib/mto";
import { can } from "@/lib/permissions";
import { MovementType, Role } from "@prisma/client";

// POST /api/sales-orders/[id]/confirm
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role as Role, "write", "SalesOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;

    const so = await db.salesOrder.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                procurementType: true,
                stockQty: true,
                reservedQty: true,
                costPrice: true,
              },
            },
          },
        },
      },
    });

    if (!so) {
      return NextResponse.json({ success: false, message: "Sales Order not found." }, { status: 404 });
    }

    if (so.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, message: "Only DRAFT Sales Orders can be confirmed." },
        { status: 400 }
      );
    }

    const linkedMoIds: string[] = [];
    const linkedPoIds: string[] = [];

    for (const line of so.items) {
      const product = line.product;
      const availableQty = product.stockQty - product.reservedQty;

      if (product.procurementType === "BUY") {
        if (availableQty >= line.quantity) {
          // Sufficient stock — reserve it
          await recordStockMovement(
            product.id,
            line.quantity,
            MovementType.RESERVE,
            "SALES_ORDER",
            so.id,
            companyId
          );
        } else {
          // BUY product with insufficient stock -> trigger PO
          const orderQty = line.quantity - availableQty;
          const poNumber = `PO-MTO-${line.id}`;
          
          // Verify if PO already exists
          const existingPO = await db.purchaseOrder.findFirst({
            where: { poNumber, companyId },
          });

          if (!existingPO) {
            // Find most recent vendor for this product
            const lastPOItem = await db.purchaseOrderItem.findFirst({
              where: { productId: product.id, purchaseOrder: { companyId } },
              orderBy: { createdAt: "desc" },
              include: { purchaseOrder: { select: { vendorId: true } } },
            });

            let vendorId = lastPOItem?.purchaseOrder.vendorId;

            if (!vendorId) {
              // Try to find any vendor in the company
              const anyVendor = await db.vendor.findFirst({
                where: { companyId },
              });
              if (anyVendor) {
                vendorId = anyVendor.id;
              } else {
                // Create a default vendor if none exists
                const defaultVendor = await db.vendor.create({
                  data: {
                    name: "Default Vendor",
                    email: "vendor@example.com",
                    phone: "1234567890",
                    companyId,
                  },
                });
                vendorId = defaultVendor.id;
              }
            }

            const po = await db.purchaseOrder.create({
              data: {
                poNumber,
                vendorId,
                status: "DRAFT",
                totalAmount: orderQty * product.costPrice,
                companyId,
                items: {
                  create: {
                    productId: product.id,
                    quantity: orderQty,
                    unitPrice: product.costPrice,
                    receivedQty: 0,
                  },
                },
              },
            });
            linkedPoIds.push(po.id);

            await logAudit(companyId, session.user.id, "PurchaseOrder", po.id, "CREATE", {
              after: po,
            });
          } else {
            linkedPoIds.push(existingPO.id);
          }
        }
      } else {
        // MAKE product -> trigger MO
        const moId = await createManufacturingOrderFromSO(line.id);
        linkedMoIds.push(moId);
      }
    }

    const confirmed = await db.salesOrder.update({
      where: { id },
      data: { status: "CONFIRMED" },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, procurementType: true } },
          },
        },
      },
    });

    await logAudit(companyId, session.user.id, "SalesOrder", so.id, "STATUS_CHANGE", {
      before: { status: "DRAFT" },
      after: { status: "CONFIRMED", linkedMoIds, linkedPoIds },
    });

    // Resolve linked MOs for response
    const linkedMos = linkedMoIds.length > 0
      ? await db.manufacturingOrder.findMany({
          where: { id: { in: linkedMoIds } },
          select: { id: true, moNumber: true, status: true },
        })
      : [];

    // Resolve linked POs for response
    const linkedPos = linkedPoIds.length > 0
      ? await db.purchaseOrder.findMany({
          where: { id: { in: linkedPoIds } },
          select: { id: true, poNumber: true, status: true, totalAmount: true },
        })
      : [];

    return NextResponse.json({ success: true, data: { ...confirmed, linkedMOs: linkedMos, linkedPOs: linkedPos } });
  } catch (error) {
    console.error("Failed to confirm Sales Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
