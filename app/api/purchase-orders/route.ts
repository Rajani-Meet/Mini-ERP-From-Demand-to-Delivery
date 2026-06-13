import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { generateNumber } from "@/lib/sequences";
import { can } from "@/lib/permissions";
import { Role } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role as Role, "read", "PurchaseOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const purchaseOrders = await db.purchaseOrder.findMany({
      where: {
        companyId,
        ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter as never } : {}),
      },
      include: {
        vendor: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: purchaseOrders });
  } catch (error) {
    console.error("Failed to fetch Purchase Orders:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role as Role, "write", "PurchaseOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const body = await req.json();
    const { vendorId, lines } = body;

    if (!vendorId || typeof vendorId !== "string") {
      return NextResponse.json({ success: false, message: "Vendor ID is required." }, { status: 400 });
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ success: false, message: "At least one order line is required." }, { status: 400 });
    }

    // Verify vendor belongs to company
    const vendor = await db.vendor.findFirst({ where: { id: vendorId, companyId } });
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    const poNumber = await generateNumber(companyId, "PO");

    const totalAmount = lines.reduce(
      (sum: number, l: { orderedQty: number; unitCost: number }) => sum + l.orderedQty * l.unitCost,
      0
    );

    const po = await db.purchaseOrder.create({
      data: {
        poNumber,
        vendorId,
        status: "DRAFT",
        totalAmount,
        companyId,
        items: {
          create: lines.map((l: { productId: string; orderedQty: number; unitCost: number }) => ({
            productId: l.productId,
            quantity: l.orderedQty,
            unitPrice: l.unitCost,
            receivedQty: 0,
          })),
        },
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

    await logAudit(companyId, session.user.id, "PurchaseOrder", po.id, "CREATE", { after: po });

    return NextResponse.json({ success: true, data: po }, { status: 201 });
  } catch (error) {
    console.error("Failed to create Purchase Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
