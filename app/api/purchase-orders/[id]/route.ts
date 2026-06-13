import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { Role } from "@prisma/client";

// GET /api/purchase-orders/[id]
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

    if (!can(session.user.role as Role, "read", "PurchaseOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;

    const po = await db.purchaseOrder.findFirst({
      where: { id, companyId },
      include: {
        vendor: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!po) {
      return NextResponse.json({ success: false, message: "Purchase Order not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: po });
  } catch (error) {
    console.error("Failed to fetch Purchase Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// PUT /api/purchase-orders/[id]
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

    if (!can(session.user.role as Role, "write", "PurchaseOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const body = await req.json();

    const existing = await db.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Purchase Order not found." }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, message: "Only DRAFT Purchase Orders can be edited." },
        { status: 400 }
      );
    }

    const { vendorId, lines } = body;
    const before = { ...existing };

    let totalAmount = existing.totalAmount;
    if (lines && Array.isArray(lines)) {
      totalAmount = lines.reduce(
        (sum: number, l: { orderedQty: number; unitCost: number }) => sum + l.orderedQty * l.unitCost,
        0
      );
      await db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: {
        ...(vendorId ? { vendorId } : {}),
        totalAmount,
        ...(lines && Array.isArray(lines)
          ? {
              items: {
                create: lines.map((l: { productId: string; orderedQty: number; unitCost: number }) => ({
                  productId: l.productId,
                  quantity: l.orderedQty,
                  unitPrice: l.unitCost,
                  receivedQty: 0,
                })),
              },
            }
          : {}),
      },
      include: {
        vendor: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    await logAudit(companyId, session.user.id, "PurchaseOrder", id, "UPDATE", {
      before,
      after: updated,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update Purchase Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
