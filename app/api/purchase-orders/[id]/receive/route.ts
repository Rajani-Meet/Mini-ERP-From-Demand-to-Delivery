import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { recordStockMovement } from "@/lib/stock";
import { can } from "@/lib/permissions";
import { MovementType, Role } from "@prisma/client";

// POST /api/purchase-orders/[id]/receive
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role as Role, "write", "PurchaseOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const body = await req.json();
    const { lines }: { lines: { lineId: string; receivedQtyDelta: number }[] } = body;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ success: false, message: "Receipt lines are required." }, { status: 400 });
    }

    const po = await db.purchaseOrder.findFirst({
      where: { id, companyId },
      include: { items: true },
    });

    if (!po) {
      return NextResponse.json({ success: false, message: "Purchase Order not found." }, { status: 404 });
    }

    if (po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
      return NextResponse.json(
        { success: false, message: "Receipts can only be recorded for SENT or PARTIALLY_RECEIVED orders." },
        { status: 400 }
      );
    }

    const receiptSummary: { lineId: string; delta: number }[] = [];

    for (const receiptLine of lines) {
      const { lineId, receivedQtyDelta } = receiptLine;

      if (!receivedQtyDelta || receivedQtyDelta <= 0) continue;

      const poItem = po.items.find((i: { id: string }) => i.id === lineId);
      if (!poItem) continue;

      const maxReceivable = poItem.quantity - poItem.receivedQty;
      const actualDelta = Math.min(receivedQtyDelta, maxReceivable);

      if (actualDelta <= 0) continue;

      // Update received quantity on the line
      await db.purchaseOrderItem.update({
        where: { id: lineId },
        data: { receivedQty: { increment: actualDelta } },
      });

      // Record stock movement IN
      await recordStockMovement(
        poItem.productId,
        actualDelta,
        MovementType.IN,
        "PURCHASE_ORDER",
        po.id,
        companyId
      );

      receiptSummary.push({ lineId, delta: actualDelta });
    }

    // Determine new PO status
    const updatedItems = await db.purchaseOrderItem.findMany({
      where: { purchaseOrderId: id },
    });

    const totalOrdered = updatedItems.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0);
    const totalReceived = updatedItems.reduce((s: number, i: { receivedQty: number }) => s + i.receivedQty, 0);

    let newStatus: "PARTIALLY_RECEIVED" | "RECEIVED" = "PARTIALLY_RECEIVED";
    if (totalReceived >= totalOrdered) {
      newStatus = "RECEIVED";
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: { status: newStatus },
      include: {
        vendor: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    await logAudit(companyId, session.user.id, "PurchaseOrder", po.id, "RECEIPT", {
      after: { lines: receiptSummary, newStatus },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to record receipt:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
