import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { validateBoMExists } from "@/lib/bom";
import { recordStockMovement } from "@/lib/stock";
import { logAudit } from "@/lib/audit";
import { MovementType, MOStatus } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role, "write", "ManufacturingOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const companyId = session.user.companyId;
    const body = await req.json();

    const { status: targetStatus, quantity } = body;

    // Fetch existing MO
    const mo = await db.manufacturingOrder.findFirst({
      where: { id, companyId },
    });

    if (!mo) {
      return NextResponse.json({ success: false, message: "Manufacturing order not found." }, { status: 404 });
    }

    // 1. Handle Quantity Update (Only allowed in DRAFT status)
    if (quantity !== undefined && quantity !== mo.quantity) {
      if (mo.status !== MOStatus.DRAFT) {
        return NextResponse.json(
          { success: false, message: "Quantity can only be modified in Draft status." },
          { status: 400 }
        );
      }

      if (typeof quantity !== "number" || quantity <= 0) {
        return NextResponse.json({ success: false, message: "Quantity must be greater than 0." }, { status: 400 });
      }

      const updatedMO = await db.manufacturingOrder.update({
        where: { id },
        data: { quantity },
      });

      await logAudit(
        companyId,
        session.user.id,
        "ManufacturingOrder",
        id,
        "UPDATE",
        {
          before: { quantity: mo.quantity },
          after: { quantity },
        }
      );

      return NextResponse.json({ success: true, data: updatedMO });
    }

    // 2. Handle Status Transitions
    if (targetStatus) {
      const currentStatus = mo.status;

      // Validate transition rules
      let isValidTransition = false;
      if (currentStatus === MOStatus.DRAFT) {
        isValidTransition = [MOStatus.STARTED, MOStatus.CLOSED].includes(targetStatus);
      } else if (currentStatus === MOStatus.STARTED) {
        isValidTransition = [MOStatus.COMPLETED, MOStatus.CLOSED].includes(targetStatus);
      } else if (currentStatus === MOStatus.COMPLETED) {
        isValidTransition = [MOStatus.CLOSED].includes(targetStatus);
      }

      if (!isValidTransition) {
        return NextResponse.json(
          { success: false, message: `Invalid status transition from ${currentStatus} to ${targetStatus}.` },
          { status: 400 }
        );
      }

      // Handle Completion logic (status -> COMPLETED)
      if (targetStatus === MOStatus.COMPLETED) {
        // A. Validate BoM exists
        const hasBom = await validateBoMExists(mo.productId);
        if (!hasBom) {
          return NextResponse.json(
            {
              success: false,
              message: "Cannot complete manufacturing order: A valid Bill of Materials with at least one component must exist for this product.",
            },
            { status: 400 }
          );
        }

        const bom = await db.billOfMaterials.findFirst({
          where: { productId: mo.productId, companyId },
          include: { components: true },
        });

        if (!bom) {
          return NextResponse.json({ success: false, message: "Failed to retrieve BoM." }, { status: 400 });
        }

        // B. Pre-flight check: Verify sufficient stock for all components before any movements
        const insufficientComponents: string[] = [];
        for (const comp of bom.components) {
          const compProduct = await db.product.findFirst({
            where: { id: comp.productId, companyId },
          });

          const requiredQty = comp.quantity * mo.quantity;
          if (!compProduct || compProduct.stockQty < requiredQty) {
            const currentStock = compProduct ? compProduct.stockQty : 0;
            const sku = compProduct ? compProduct.sku : "UNKNOWN";
            const name = compProduct ? compProduct.name : "Unknown Component";
            insufficientComponents.push(
              `"${name}" (${sku}) - Required: ${requiredQty}, Available: ${currentStock}`
            );
          }
        }

        if (insufficientComponents.length > 0) {
          return NextResponse.json(
            {
              success: false,
              message: `Insufficient stock for components:\n${insufficientComponents.join("\n")}`,
            },
            { status: 400 }
          );
        }

        // C. Record stock movements atomically in a transaction
        const updatedMO = await db.$transaction(async (tx) => {
          // 1. Consume components (OUT)
          for (const comp of bom.components) {
            await recordStockMovement(
              comp.productId,
              comp.quantity * mo.quantity,
              MovementType.OUT,
              "MANUFACTURING_ORDER",
              mo.id,
              companyId,
              tx
            );
          }

          // 2. Add finished goods (IN)
          await recordStockMovement(
            mo.productId,
            mo.quantity,
            MovementType.IN,
            "MANUFACTURING_ORDER",
            mo.id,
            companyId,
            tx
          );

          // 3. Update MO status
          return await tx.manufacturingOrder.update({
            where: { id },
            data: { status: targetStatus },
          });
        });

        // E. Write status change audit log
        await logAudit(
          companyId,
          session.user.id,
          "ManufacturingOrder",
          id,
          `STATUS_${targetStatus}`,
          {
            before: { status: currentStatus },
            after: { status: targetStatus },
          }
        );

        return NextResponse.json({ success: true, data: updatedMO });
      }

      // Handle other status changes (DRAFT -> STARTED, DRAFT -> CLOSED, etc.)
      const updatedMO = await db.manufacturingOrder.update({
        where: { id },
        data: { status: targetStatus },
      });

      // Write status change audit log
      await logAudit(
        companyId,
        session.user.id,
        "ManufacturingOrder",
        id,
        `STATUS_${targetStatus}`,
        {
          before: { status: currentStatus },
          after: { status: targetStatus },
        }
      );

      return NextResponse.json({ success: true, data: updatedMO });
    }

    return NextResponse.json({ success: false, message: "No actions specified." }, { status: 400 });
  } catch (error) {
    console.error("Failed to update MO:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
