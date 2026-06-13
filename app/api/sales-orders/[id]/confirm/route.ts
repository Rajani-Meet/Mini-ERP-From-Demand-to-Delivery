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

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { autoCreateMO: true },
    });
    const autoCreateMO = company?.autoCreateMO ?? true;

    const linkedMoIds: string[] = [];

    for (const line of so.items) {
      const product = line.product;
      const availableQty = product.stockQty - product.reservedQty;

      if (product.procurementType === "BUY" && availableQty >= line.quantity) {
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
        // MAKE product OR BUY with insufficient stock → trigger MO if enabled
        if (autoCreateMO) {
          const moId = await createManufacturingOrderFromSO(line.id);
          linkedMoIds.push(moId);
        }
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
      after: { status: "CONFIRMED", linkedMoIds },
    });

    // Resolve linked MOs for response
    const linkedMos = linkedMoIds.length > 0
      ? await db.manufacturingOrder.findMany({
          where: { id: { in: linkedMoIds } },
          select: { id: true, moNumber: true, status: true },
        })
      : [];

    return NextResponse.json({ success: true, data: { ...confirmed, linkedMOs: linkedMos } });
  } catch (error) {
    console.error("Failed to confirm Sales Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
