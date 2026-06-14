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

    // ── 1. Handle Quantity / BoM updates (DRAFT only) ────────────────────────
    if (
      (quantity !== undefined && quantity !== mo.quantity) ||
      (bomId !== undefined && bomId !== mo.bomId)
    ) {
      if (mo.status !== MOStatus.DRAFT) {
        return NextResponse.json(
          { success: false, message: "Quantity and BoM can only be modified in Draft status." },
          { status: 400 }
        );
      }

      const finalQuantity = quantity !== undefined ? quantity : mo.quantity;
      const finalBomId = bomId !== undefined ? bomId : mo.bomId;

      if (typeof finalQuantity !== "number" || finalQuantity <= 0) {
        return NextResponse.json(
          { success: false, message: "Quantity must be greater than 0." },
          { status: 400 }
        );
      }

      try {
        const updatedMO = await db.$transaction(async (tx) => {
          let bomRef = mo.bomReference;

          if (finalBomId) {
            const bom = await tx.billOfMaterials.findFirst({
              where: { id: finalBomId, companyId },
              include: { components: true, workOrders: true },
            });

            if (!bom) throw new Error("BoM not found.");

            bomRef = bom.reference;

            // Replace components and work orders scaled to new quantity
            await tx.mOComponent.deleteMany({ where: { moId: id } });
            await tx.mOWorkOrder.deleteMany({ where: { moId: id } });

            await tx.mOComponent.createMany({
              data: bom.components.map((comp) => ({
                moId: id,
                productId: comp.productId,
                quantity: Math.max(
                  1,
                  Math.round(comp.quantity * (finalQuantity / (bom.quantity || 1)))
                ),
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
            await tx.mOComponent.deleteMany({ where: { moId: id } });
            await tx.mOWorkOrder.deleteMany({ where: { moId: id } });
            bomRef = null;
          }

          const result = await tx.manufacturingOrder.update({
            where: { id },
            data: {
              quantity: finalQuantity,
              bomId: finalBomId || null,
              bomReference: bomRef,
            },
            include: { components: true, workOrders: true },
          });

          await logAudit(companyId, session.user.id, "ManufacturingOrder", id, "UPDATE", {
            before: { quantity: mo.quantity, bomId: mo.bomId, bomReference: mo.bomReference },
            after: { quantity: result.quantity, bomId: result.bomId, bomReference: result.bomReference },
          });

          return result;
        });

        return NextResponse.json({ success: true, data: updatedMO });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to update manufacturing order.";
        return NextResponse.json({ success: false, message: msg }, { status: 400 });
      }
    }

    // ── 2. Handle Status Transitions ─────────────────────────────────────────
    if (targetStatus) {
      const currentStatus = mo.status;

      // Validate allowed transitions
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

      // Fetch BoM (needed for RESERVE / RELEASE on STARTED / CLOSED)
      const bom = await db.billOfMaterials.findFirst({
        where: { productId: mo.productId, companyId },
        include: { components: true },
      });

      // ── DRAFT → STARTED: reserve components ────────────────────────────────
      if (targetStatus === MOStatus.STARTED) {
        if (!bom || bom.components.length === 0) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Cannot start: a valid Bill of Materials with at least one component must exist.",
            },
            { status: 400 }
          );
        }

        // Pre-flight stock check
        const shortfall: string[] = [];
        for (const comp of bom.components) {
          const product = await db.product.findFirst({ where: { id: comp.productId, companyId } });
          const needed = comp.quantity * mo.quantity;
          if (!product || product.stockQty < needed) {
            shortfall.push(
              `"${product?.name ?? "Unknown"}" (${product?.sku ?? "?"}) — need ${needed}, have ${product?.stockQty ?? 0}`
            );
          }
        }
        if (shortfall.length > 0) {
          return NextResponse.json(
            { success: false, message: `Insufficient stock to reserve:\n${shortfall.join("\n")}` },
            { status: 400 }
          );
        }

        // Reserve each component
        for (const comp of bom.components) {
          await recordStockMovement(
            comp.productId,
            comp.quantity * mo.quantity,
            MovementType.RESERVE,
            "MANUFACTURING_ORDER",
            mo.id,
            companyId
          );
        }
      }

      // ── STARTED → CLOSED: release reserved components ──────────────────────
      if (targetStatus === MOStatus.CLOSED && currentStatus === MOStatus.STARTED) {
        if (bom && bom.components.length > 0) {
          for (const comp of bom.components) {
            await recordStockMovement(
              comp.productId,
              comp.quantity * mo.quantity,
              MovementType.RELEASE,
              "MANUFACTURING_ORDER",
              mo.id,
              companyId
            );
          }
        }
      }

      // ── STARTED → COMPLETED: release reservations + OUT components + IN FG ──
      if (targetStatus === MOStatus.COMPLETED) {
        // Use MO-level components (set when BoM was applied to this MO)
        const moComponents = await db.mOComponent.findMany({
          where: { moId: id },
          include: { product: true },
        });

        if (moComponents.length === 0) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Cannot complete: the order must have at least one component in its specification.",
            },
            { status: 400 }
          );
        }

        // Pre-flight stock check
        const insufficient: string[] = [];
        for (const comp of moComponents) {
          if (!comp.product || comp.product.stockQty < comp.quantity) {
            insufficient.push(
              `"${comp.product?.name ?? "Unknown"}" (${comp.product?.sku ?? "?"}) — need ${comp.quantity}, have ${comp.product?.stockQty ?? 0}`
            );
          }
        }
        if (insufficient.length > 0) {
          return NextResponse.json(
            { success: false, message: `Insufficient stock for components:\n${insufficient.join("\n")}` },
            { status: 400 }
          );
        }

        // Release reservations (placed at STARTED) then consume + produce inside a transaction
        if (bom && bom.components.length > 0) {
          for (const comp of bom.components) {
            await recordStockMovement(
              comp.productId,
              comp.quantity * mo.quantity,
              MovementType.RELEASE,
              "MANUFACTURING_ORDER",
              mo.id,
              companyId
            );
          }
        }

        const updatedMO = await db.$transaction(async (tx) => {
          // OUT each component
          for (const comp of moComponents) {
            await recordStockMovement(
              comp.productId,
              comp.quantity,
              MovementType.OUT,
              "MANUFACTURING_ORDER",
              mo.id,
              companyId,
              tx
            );
          }

          // IN finished goods
          await recordStockMovement(
            mo.productId,
            mo.quantity,
            MovementType.IN,
            "MANUFACTURING_ORDER",
            mo.id,
            companyId,
            tx
          );

          return await tx.manufacturingOrder.update({
            where: { id },
            data: { status: targetStatus },
          });
        });

        await logAudit(companyId, session.user.id, "ManufacturingOrder", id, `STATUS_${targetStatus}`, {
          before: { status: currentStatus },
          after:  { status: targetStatus },
        });

        return NextResponse.json({ success: true, data: updatedMO });
      }

      // ── All other transitions (STARTED, CLOSED from DRAFT/COMPLETED) ────────
      const updatedMO = await db.manufacturingOrder.update({
        where: { id },
        data: { status: targetStatus },
      });

      await logAudit(companyId, session.user.id, "ManufacturingOrder", id, `STATUS_${targetStatus}`, {
        before: { status: currentStatus },
        after:  { status: targetStatus },
      });

      return NextResponse.json({ success: true, data: updatedMO });
    }

    return NextResponse.json({ success: false, message: "No actions specified." }, { status: 400 });
  } catch (error) {
    console.error("Failed to update MO:", error);
    const message = error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ success: false, message }, { status: 500 });
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
      include: { components: true, workOrders: true },
    });

    if (!mo) {
      return NextResponse.json({ success: false, message: "Manufacturing order not found." }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.manufacturingOrder.delete({ where: { id } });
      await logAudit(companyId, session.user.id, "ManufacturingOrder", id, "DELETE", { before: mo });
    });

    return NextResponse.json({ success: true, message: "Manufacturing Order deleted successfully." });
  } catch (error) {
    console.error("Failed to delete MO:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
