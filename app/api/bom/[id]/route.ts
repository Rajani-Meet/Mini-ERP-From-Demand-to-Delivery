import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "read", "BillOfMaterials")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const companyId = session.user.companyId;

    const bom = await db.billOfMaterials.findFirst({
      where: { id, companyId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        components: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    if (!bom) {
      return NextResponse.json({ success: false, message: "BoM not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: bom });
  } catch (error) {
    console.error("Failed to fetch BoM details:", error);
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

    if (!can(session.user.role, "write", "BillOfMaterials")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const companyId = session.user.companyId;
    const body = await req.json();

    const { quantity = 1, components } = body;

    // Validate inputs
    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json({ success: false, message: "Quantity must be greater than 0." }, { status: 400 });
    }

    if (!Array.isArray(components) || components.length === 0) {
      return NextResponse.json({ success: false, message: "At least one component is required." }, { status: 400 });
    }

    // Check if BoM exists
    const oldBom = await db.billOfMaterials.findFirst({
      where: { id, companyId },
      include: { components: true },
    });

    if (!oldBom) {
      return NextResponse.json({ success: false, message: "BoM not found." }, { status: 404 });
    }

    // Verify all component products
    for (const comp of components) {
      if (!comp.productId || typeof comp.quantity !== "number" || comp.quantity <= 0) {
        return NextResponse.json(
          { success: false, message: "Each component must have a valid product and quantity greater than 0." },
          { status: 400 }
        );
      }

      const compProduct = await db.product.findFirst({
        where: { id: comp.productId, companyId },
      });

      if (!compProduct) {
        return NextResponse.json(
          { success: false, message: `Component product with ID ${comp.productId} not found.` },
          { status: 404 }
        );
      }
    }

    // Perform updates inside a transaction
    const updatedBom = await db.$transaction(async (tx) => {
      // 1. Delete all old components
      await tx.boMComponent.deleteMany({
        where: { bomId: id },
      });

      // 2. Update BoM quantity and recreate components
      const bom = await tx.billOfMaterials.update({
        where: { id },
        data: {
          quantity,
          components: {
            create: components.map((comp: { productId: string; quantity: number }) => ({
              productId: comp.productId,
              quantity: comp.quantity,
            })),
          },
        },
        include: {
          components: true,
        },
      });

      // Log Audit Trail
      await logAudit(
        companyId,
        session.user.id,
        "BillOfMaterials",
        id,
        "UPDATE",
        {
          before: oldBom,
          after: bom,
        }
      );

      return bom;
    });

    return NextResponse.json({ success: true, data: updatedBom });
  } catch (error) {
    console.error("Failed to update BoM:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "write", "BillOfMaterials")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const companyId = session.user.companyId;

    const bom = await db.billOfMaterials.findFirst({
      where: { id, companyId },
      include: { components: true },
    });

    if (!bom) {
      return NextResponse.json({ success: false, message: "BoM not found." }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.billOfMaterials.delete({
        where: { id },
      });

      await logAudit(
        companyId,
        session.user.id,
        "BillOfMaterials",
        id,
        "DELETE",
        { before: bom }
      );
    });

    return NextResponse.json({ success: true, message: "Bill of Materials deleted successfully." });
  } catch (error) {
    console.error("Failed to delete BoM:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
