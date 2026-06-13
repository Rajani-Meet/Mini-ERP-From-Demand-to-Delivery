import { Prisma } from "@prisma/client";
import { generateNumber } from "./sequences";

/**
 * If stockQty just dropped below reorderPoint, auto-create a DRAFT PO.
 * Uses the most recent vendor that supplied this product; skips silently if none found.
 * Must be called inside an existing Prisma transaction.
 */
export async function triggerReorderIfNeeded(
  tx: Prisma.TransactionClient,
  productId: string,
  companyId: string,
  newStockQty: number
): Promise<void> {
  const product = await tx.product.findFirst({
    where: { id: productId, companyId },
    select: { reorderPoint: true, costPrice: true, name: true, sku: true, procurementType: true },
  });

  if (!product || product.reorderPoint <= 0 || newStockQty >= product.reorderPoint) {
    return;
  }

  const orderQty = product.reorderPoint * 2 - newStockQty;

  if (product.procurementType === "MAKE") {
    // Check if there's already an open (DRAFT or STARTED) MO for this product to avoid duplicates
    const existingOpenMO = await tx.manufacturingOrder.findFirst({
      where: {
        productId,
        companyId,
        status: { in: ["DRAFT", "STARTED"] },
      },
    });

    if (existingOpenMO) {
      return;
    }

    const moNumber = await generateNumber(companyId, "MO");

    await tx.manufacturingOrder.create({
      data: {
        moNumber,
        productId,
        quantity: orderQty,
        status: "DRAFT",
        companyId,
      },
    });

    await tx.auditLog.create({
      data: {
        entity: "ManufacturingOrder",
        entityId: moNumber,
        action: "AUTO_REORDER_MO",
        oldValue: null,
        newValue: JSON.stringify({
          productId,
          sku: product.sku,
          name: product.name,
          reorderPoint: product.reorderPoint,
          stockQtyAfterMovement: newStockQty,
          orderQty,
        }),
        companyId,
      },
    });
  } else {
    // Check if there's already an open (DRAFT or SENT) PO for this product to avoid duplicates
    const existingOpenPO = await tx.purchaseOrderItem.findFirst({
      where: {
        productId,
        purchaseOrder: {
          companyId,
          status: { in: ["DRAFT", "SENT"] },
        },
      },
    });

    if (existingOpenPO) {
      return;
    }

    // Find the most recent vendor used for this product
    const lastPOItem = await tx.purchaseOrderItem.findFirst({
      where: { productId, purchaseOrder: { companyId } },
      orderBy: { createdAt: "desc" },
      include: { purchaseOrder: { select: { vendorId: true } } },
    });

    if (!lastPOItem) {
      return;
    }

    const vendorId = lastPOItem.purchaseOrder.vendorId;

    const poNumber = await generateNumber(companyId, "PO");

    await tx.purchaseOrder.create({
      data: {
        poNumber,
        vendorId,
        status: "DRAFT",
        totalAmount: orderQty * product.costPrice,
        companyId,
        items: {
          create: {
            productId,
            quantity: orderQty,
            unitPrice: product.costPrice,
            receivedQty: 0,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        entity: "PurchaseOrder",
        entityId: poNumber,
        action: "AUTO_REORDER",
        oldValue: null,
        newValue: JSON.stringify({
          productId,
          sku: product.sku,
          name: product.name,
          reorderPoint: product.reorderPoint,
          stockQtyAfterMovement: newStockQty,
          orderQty,
          vendorId,
        }),
        companyId,
      },
    });
  }
}
