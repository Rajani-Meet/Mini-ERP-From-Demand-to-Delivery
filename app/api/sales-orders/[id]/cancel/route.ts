import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { recordStockMovement } from "@/lib/stock";
import { can } from "@/lib/permissions";
import { MovementType, Role } from "@prisma/client";

// POST /api/sales-orders/[id]/cancel
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
                procurementType: true,
                stockQty: true,
                reservedQty: true,
              },
            },
          },
        },
      },
    });

    if (!so) {
      return NextResponse.json({ success: false, message: "Sales Order not found." }, { status: 404 });
    }

    if (so.status === "DELIVERED") {
      return NextResponse.json(
        { success: false, message: "Delivered Sales Orders cannot be cancelled." },
        { status: 400 }
      );
    }

    if (so.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, message: "Sales Order is already cancelled." },
        { status: 400 }
      );
    }

    // If CONFIRMED — release reserved stock and cancel linked MOs
    if (so.status === "CONFIRMED") {
      for (const line of so.items) {
        const product = line.product;

        // Only release if this product had stock reserved (BUY type)
        if (product.procurementType === "BUY" && product.reservedQty > 0) {
          const qtyToRelease = Math.min(line.quantity, product.reservedQty);
          await recordStockMovement(
            product.id,
            qtyToRelease,
            MovementType.RELEASE,
            "SALES_ORDER",
            so.id,
            companyId
          );
        }
      }

      // Cancel any linked MOs (MTO-{itemId} pattern) that are still cancellable
      const itemIds = so.items.map((i) => i.id);
      const linkedMOs = await db.manufacturingOrder.findMany({
        where: {
          companyId,
          moNumber: { in: itemIds.map((itemId) => `MTO-${itemId}`) },
          status: { in: ["DRAFT", "STARTED"] },
        },
      });

      if (linkedMOs.length > 0) {
        await db.manufacturingOrder.updateMany({
          where: { id: { in: linkedMOs.map((mo) => mo.id) } },
          data: { status: "CLOSED" },
        });
      }
    }

    const cancelled = await db.salesOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, procurementType: true } },
          },
        },
      },
    });

    await logAudit(companyId, session.user.id, "SalesOrder", so.id, "STATUS_CHANGE", {
      before: { status: so.status },
      after: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true, data: cancelled });
  } catch (error) {
    console.error("Failed to cancel Sales Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
