import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { Role } from "@prisma/client";

// GET /api/sales-orders/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role as Role, "read", "SalesOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;

    const so = await db.salesOrder.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, procurementType: true, stockPrice: true } },
          },
        },
      },
    });

    if (!so) {
      return NextResponse.json({ success: false, message: "Sales Order not found." }, { status: 404 });
    }

    // Resolve linked Manufacturing Orders via MTO moNumber encoding
    const itemIds = so.items.map((i: { id: string }) => i.id);
    const linkedMos = itemIds.length > 0
      ? await db.manufacturingOrder.findMany({
          where: {
            companyId,
            moNumber: { in: itemIds.map((id: string) => `MTO-${id}`) },
          },
          select: { id: true, moNumber: true, status: true, productId: true, quantity: true },
        })
      : [];

    return NextResponse.json({ success: true, data: { ...so, linkedMOs: linkedMos } });
  } catch (error) {
    console.error("Failed to fetch Sales Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// PUT /api/sales-orders/[id]
export async function PUT(
  req: Request,
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
    const body = await req.json();

    const existing = await db.salesOrder.findFirst({ where: { id, companyId } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Sales Order not found." }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, message: "Only DRAFT Sales Orders can be edited." },
        { status: 400 }
      );
    }

    const { customerName, customerAddress, lines } = body;
    const before = { ...existing };

    // Recompute total if lines provided
    let totalAmount = existing.totalAmount;
    if (lines && Array.isArray(lines)) {
      totalAmount = lines.reduce(
        (sum: number, l: { qty: number; unitPrice: number }) => sum + l.qty * l.unitPrice,
        0
      );
      // Replace all items
      await db.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
    }

    const updated = await db.salesOrder.update({
      where: { id },
      data: {
        ...(customerName ? { customerName } : {}),
        ...(customerAddress !== undefined ? { customerAddress } : {}),
        totalAmount,
        ...(lines && Array.isArray(lines)
          ? {
              items: {
                create: lines.map((l: { productId: string; qty: number; unitPrice: number }) => ({
                  productId: l.productId,
                  quantity: l.qty,
                  unitPrice: l.unitPrice,
                })),
              },
            }
          : {}),
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, procurementType: true } },
          },
        },
      },
    });

    await logAudit(companyId, session.user.id, "SalesOrder", id, "UPDATE", {
      before,
      after: updated,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update Sales Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
