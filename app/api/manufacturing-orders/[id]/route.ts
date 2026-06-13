import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
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

    const { status: targetStatus, quantity, bomId } = body;

    // Fetch existing MO
    const mo = await db.manufacturingOrder.findFirst({
      where: { id, companyId },
    });

    if (!mo) {
      return NextResponse.json({ success: false, message: "Manufacturing order not found." }, { status: 404 });
    }

    // 1. Handle BoM Selection / Swap (Only allowed in DRAFT status)
    // 1. Handle BoM and Quantity updates (Only allowed in DRAFT status)
    if ((quantity !== undefined && quantity !== mo.quantity) || (bomId !== undefined && bomId !== mo.bomId)) {
      if (mo.status !== MOStatus.DRAFT) {
        return NextResponse.json(
          { success: false, message: "Quantity and BOM can only be modified in Draft status." },
          { status: 400 }
        );
      }

      const finalQuantity = quantity !== undefined ? quantity : mo.quantity;
      const finalBomId = bomId !== undefined ? bomId : mo.bomId;

      if (typeof finalQuantity !== "number" || finalQuantity <= 0) {
        return NextResponse.json({ success: false, message: "Quantity must be greater than 0." }, { status: 400 });
      }

      try {
        const updatedMO = await db.$transaction(async (tx) => {
          let bomRef = mo.bomReference;

          if (finalBomId) {
            const bom = await tx.billOfMaterials.findFirst({
              where: { id: finalBomId, companyId },
              include: { components: true, workOrders: true },
            });

            if (!bom) {
              throw new Error("BoM not found.");
            }

            bomRef = bom.reference;

            // Clear old components & work orders
            await tx.mOComponent.deleteMany({ where: { moId: id } });
            await tx.mOWorkOrder.deleteMany({ where: { moId: id } });

            // Re-create components and work orders scaled by the new quantity
            await tx.mOComponent.createMany({
              data: bom.components.map((comp) => ({
                moId: id,
                productId: comp.productId,
                quantity: Math.max(1, Math.round(comp.quantity * (finalQuantity / (bom.quantity || 1)))),
              })),
            });

            await tx.mOWorkOrder.createMany({
              data: bom.workOrders.map((wo) => ({
                moId: id,
                operation: wo.operation,
                workCenter: wo.workCenter,
                expectedDuration: wo.expectedDuration,
              })),
            });
          } else {
            // Clear components & work orders if BOM is removed
            await tx.mOComponent.deleteMany({ where: { moId: id } });
            await tx.mOWorkOrder.deleteMany({ where: { moId: id } });
            bomRef = null;
          }

          const res = await tx.manufacturingOrder.update({
            where: { id },
            data: {
              quantity: finalQuantity,
              bomId: finalBomId || null,
              bomReference: bomRef,
            },
            include: {
              components: true,
              workOrders: true,
            },
          });

          await logAudit(
            companyId,
            session.user.id,
            "ManufacturingOrder",
            id,
            "UPDATE",
            {
              before: { quantity: mo.quantity, bomId: mo.bomId, bomReference: mo.bomReference },
              after: { quantity: res.quantity, bomId: res.bomId, bomReference: res.bomReference },
            }
          );

          return res;
        });

        return NextResponse.json({ success: true, data: updatedMO });
      } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message || "Failed to update manufacturing order." }, { status: 400 });
      }
    }

    // 3. Handle Status Transitions
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
        // Fetch MO Components
        const moComponents = await db.mOComponent.findMany({
          where: { moId: id },
          include: { product: true },
        });

        if (moComponents.length === 0) {
          return NextResponse.json(
            {
              success: false,
              message: "Cannot complete manufacturing order: The order must have at least one component in its specification.",
            },
            { status: 400 }
          );
        }

        // B. Pre-flight check: Verify sufficient stock for all components
        const insufficientComponents: string[] = [];
        for (const comp of moComponents) {
          const compProduct = comp.product;
          const requiredQty = comp.quantity;
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
        // C. Record stock movements
        await db.$transaction(async (tx) => {
          // 1. Consume components (OUT)
          for (const comp of moComponents) {
            await recordStockMovement(
              comp.productId,
              comp.quantity,
              MovementType.OUT,
              "MANUFACTURING_ORDER",
              mo.id,
              companyId
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
          await tx.manufacturingOrder.update({
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
      } else {
        // Simple status update
        await db.manufacturingOrder.update({
          where: { id },
          data: { status: targetStatus },
        });
      }

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

      return NextResponse.json({ success: true, data: { ...mo, status: targetStatus } });
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

export async function DELETE(
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

    const mo = await db.manufacturingOrder.findFirst({
      where: { id, companyId },
      include: {
        components: true,
        workOrders: true,
      },
    });

    if (!mo) {
      return NextResponse.json({ success: false, message: "Manufacturing order not found." }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.manufacturingOrder.delete({
        where: { id },
      });

      await logAudit(
        companyId,
        session.user.id,
        "ManufacturingOrder",
        id,
        "DELETE",
        { before: mo }
      );
    });

    return NextResponse.json({ success: true, message: "Manufacturing Order deleted successfully." });
  } catch (error) {
    console.error("Failed to delete MO:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
