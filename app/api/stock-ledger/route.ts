import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "read", "InventoryMovement")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const { searchParams } = new URL(req.url);

    const productId = searchParams.get("productId");
    const type = searchParams.get("type");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { companyId };

    if (productId) {
      where.productId = productId;
    }

    if (type && ["IN", "OUT", "RESERVE", "RELEASE"].includes(type)) {
      where.movementType = type;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [movements, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where,
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.inventoryMovement.count({ where }),
    ]);

    // Summary aggregation — scoped to company (or filtered product)
    const summaryScope = productId ? { companyId, productId } : { companyId };
    const products = await db.product.findMany({
      where: summaryScope,
      select: { stockQty: true, reservedQty: true },
    });

    const summary = products.reduce(
      (acc, p) => {
        acc.totalOnHand += p.stockQty;
        acc.totalReserved += p.reservedQty;
        return acc;
      },
      { totalOnHand: 0, totalReserved: 0 }
    );

    return NextResponse.json({
      success: true,
      data: movements,
      summary: {
        totalOnHand: summary.totalOnHand,
        totalReserved: summary.totalReserved,
        totalAvailable: summary.totalOnHand - summary.totalReserved,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch stock ledger:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
