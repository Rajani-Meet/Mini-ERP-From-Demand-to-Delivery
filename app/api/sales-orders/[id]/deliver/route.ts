import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { recordStockMovement } from "@/lib/stock";
import { can } from "@/lib/permissions";
import { MovementType, Role } from "@prisma/client";

// POST /api/sales-orders/[id]/deliver
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
            product: { select: { id: true, name: true, stockQty: true } },
          },
        },
      },
    });

    if (!so) {
      return NextResponse.json({ success: false, message: "Sales Order not found." }, { status: 404 });
    }

    if (so.status !== "CONFIRMED") {
      return NextResponse.json(
        { success: false, message: "Only CONFIRMED Sales Orders can be delivered." },
        { status: 400 }
      );
    }

    for (const line of so.items) {
      // 1. Release the reservation
      await recordStockMovement(
        line.productId,
        line.quantity,
        MovementType.RELEASE,
        "SALES_ORDER",
        so.id,
        companyId
      );
      // 2. Physically decrement stock
      await recordStockMovement(
        line.productId,
        line.quantity,
        MovementType.OUT,
        "SALES_ORDER",
        so.id,
        companyId
      );
    }

    const delivered = await db.salesOrder.update({
      where: { id },
      data: { status: "DELIVERED" },
    });

    await logAudit(companyId, session.user.id, "SalesOrder", so.id, "STATUS_CHANGE", {
      before: { status: "CONFIRMED" },
      after: { status: "DELIVERED" },
    });

    return NextResponse.json({ success: true, data: delivered });
  } catch (error) {
    console.error("Failed to deliver Sales Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
