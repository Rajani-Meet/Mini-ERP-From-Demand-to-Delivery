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

    if (!can(session.user.role as Role, "read", "SalesOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const salesOrders = await db.salesOrder.findMany({
      where: {
        companyId,
        ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter as never } : {}),
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, procurementType: true, stockPrice: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: salesOrders });
  } catch (error) {
    console.error("Failed to fetch Sales Orders:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role as Role, "write", "SalesOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const body = await req.json();
    const { customerName, customerAddress, lines } = body;

    if (!customerName || typeof customerName !== "string") {
      return NextResponse.json({ success: false, message: "Customer name is required." }, { status: 400 });
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ success: false, message: "At least one order line is required." }, { status: 400 });
    }

    // Validate lines
    for (const line of lines) {
      if (!line.productId || !line.qty || !line.unitPrice) {
        return NextResponse.json(
          { success: false, message: "Each line must have productId, qty, and unitPrice." },
          { status: 400 }
        );
      }
    }

    const soNumber = await generateNumber(companyId, "SO");

    const totalAmount = lines.reduce(
      (sum: number, l: { qty: number; unitPrice: number }) => sum + l.qty * l.unitPrice,
      0
    );

    const so = await db.salesOrder.create({
      data: {
        orderNumber: soNumber,
        customerName,
        customerAddress: customerAddress ?? null,
        status: "DRAFT",
        totalAmount,
        companyId,
        items: {
          create: lines.map((l: { productId: string; qty: number; unitPrice: number }) => ({
            productId: l.productId,
            quantity: l.qty,
            unitPrice: l.unitPrice,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, procurementType: true } },
          },
        },
      },
    });

    await logAudit(companyId, session.user.id, "SalesOrder", so.id, "CREATE", { after: so });

    return NextResponse.json({ success: true, data: so }, { status: 201 });
  } catch (error) {
    console.error("Failed to create Sales Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
