import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).max(50).optional(),
  costPrice: z.number().min(0).optional(),
  salesPrice: z.number().min(0).optional(),
  onHandQty: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  procurementType: z.enum(["BUY", "MAKE"]).optional(),
  description: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "read", "Product")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const companyId = session.user.companyId;

    const product = await db.product.findFirst({ where: { id, companyId } });

    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        salesPrice: product.stockPrice,
        onHandQty: product.stockQty,
        availableToSell: product.stockQty - product.reservedQty,
      },
    });
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "write", "Product")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const companyId = session.user.companyId;

    const before = await db.product.findFirst({ where: { id, companyId } });
    if (!before) {
      return NextResponse.json({ success: false, message: "Product not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, sku, costPrice, salesPrice, onHandQty, reorderPoint, procurementType, description } =
      parsed.data;

    // Check SKU uniqueness if changing SKU
    if (sku && sku !== before.sku) {
      const conflict = await db.product.findFirst({
        where: { sku, companyId, NOT: { id } },
      });
      if (conflict) {
        return NextResponse.json(
          { success: false, message: `SKU "${sku}" is already used by another product.` },
          { status: 409 }
        );
      }
    }

    const after = await db.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(sku !== undefined && { sku }),
        ...(description !== undefined && { description }),
        ...(costPrice !== undefined && { costPrice }),
        ...(salesPrice !== undefined && { stockPrice: salesPrice }),
        ...(onHandQty !== undefined && { stockQty: onHandQty }),
        ...(reorderPoint !== undefined && { reorderPoint }),
        ...(procurementType !== undefined && { procurementType }),
      },
    });

    await logAudit(companyId, session.user.id, "Product", id, "UPDATE", {
      before,
      after,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...after,
        salesPrice: after.stockPrice,
        onHandQty: after.stockQty,
        availableToSell: after.stockQty - after.reservedQty,
      },
    });
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "write", "Product")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const companyId = session.user.companyId;

    const product = await db.product.findFirst({ where: { id, companyId } });
    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found." }, { status: 404 });
    }

    await db.product.delete({ where: { id } });

    await logAudit(companyId, session.user.id, "Product", id, "DELETE", {
      before: product,
    });

    return NextResponse.json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
