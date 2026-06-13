import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required").max(50),
  costPrice: z.number().min(0, "Cost price must be non-negative"),
  salesPrice: z.number().min(0, "Sales price must be non-negative"),
  onHandQty: z.number().int().min(0).default(0),
  reorderPoint: z.number().int().min(0).default(0),
  procurementType: z.enum(["BUY", "MAKE"]),
  description: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized access. Please log in." },
        { status: 401 }
      );
    }

    if (!can(session.user.role, "read", "Product")) {
      return NextResponse.json(
        { success: false, message: "Forbidden: insufficient permissions." },
        { status: 403 }
      );
    }

    const companyId = session.user.companyId;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const procurementType = searchParams.get("procurementType");
    const lowStock = searchParams.get("lowStock") === "true";
    const sort = searchParams.get("sort") ?? "name";

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { companyId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    if (procurementType === "BUY" || procurementType === "MAKE") {
      where.procurementType = procurementType;
    }

    const orderBy =
      sort === "stock"
        ? { stockQty: "desc" as const }
        : sort === "price"
        ? { stockPrice: "desc" as const }
        : { name: "asc" as const };

    const products = await db.product.findMany({
      where,
      orderBy,
    });

    // Apply low-stock filter after fetch (needs comparison with reorderPoint)
    const filtered = lowStock
      ? products.filter((p) => p.stockQty <= p.reorderPoint)
      : products;

    // Map fields to frontend-friendly names
    const data = filtered.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      costPrice: p.costPrice,
      salesPrice: p.stockPrice,
      onHandQty: p.stockQty,
      reservedQty: p.reservedQty,
      availableToSell: p.stockQty - p.reservedQty,
      reorderPoint: p.reorderPoint,
      procurementType: p.procurementType,
      companyId: p.companyId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    if (!can(session.user.role, "write", "Product")) {
      return NextResponse.json(
        { success: false, message: "Forbidden: insufficient permissions." },
        { status: 403 }
      );
    }

    const companyId = session.user.companyId;
    const body = await req.json();

    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, sku, costPrice, salesPrice, onHandQty, reorderPoint, procurementType, description } =
      parsed.data;

    // Check SKU uniqueness per company
    const existing = await db.product.findFirst({
      where: { sku, companyId },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: `SKU "${sku}" is already in use by another product in your company.` },
        { status: 409 }
      );
    }

    const product = await db.product.create({
      data: {
        name,
        sku,
        description,
        costPrice,
        stockPrice: salesPrice,
        stockQty: onHandQty,
        reorderPoint,
        reservedQty: 0,
        procurementType,
        companyId,
      },
    });

    await logAudit(companyId, session.user.id, "Product", product.id, "CREATE", {
      after: product,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...product,
          salesPrice: product.stockPrice,
          onHandQty: product.stockQty,
          availableToSell: product.stockQty - product.reservedQty,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
