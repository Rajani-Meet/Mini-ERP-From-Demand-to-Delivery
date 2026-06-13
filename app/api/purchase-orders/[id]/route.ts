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
      if (lines.length === 0) {
        return NextResponse.json({ success: false, message: "At least one order line is required." }, { status: 400 });
      }

      // Validate and verify line items
      for (const line of lines) {
        if (!line.productId || typeof line.productId !== "string") {
          return NextResponse.json({ success: false, message: "Product ID is required for all lines." }, { status: 400 });
        }
        if (typeof line.orderedQty !== "number" || line.orderedQty <= 0) {
          return NextResponse.json({ success: false, message: "Quantity must be a positive number." }, { status: 400 });
        }
        if (typeof line.unitCost !== "number" || line.unitCost < 0) {
          return NextResponse.json({ success: false, message: "Unit cost must be a non-negative number." }, { status: 400 });
        }

        // Verify product exists and belongs to company
        const product = await db.product.findFirst({ where: { id: line.productId, companyId } });
        if (!product) {
          return NextResponse.json({ success: false, message: `Product with ID ${line.productId} not found.` }, { status: 404 });
        }
      }

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
