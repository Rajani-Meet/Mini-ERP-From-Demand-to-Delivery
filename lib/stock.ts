import { db } from "./db";
import { MovementType } from "@prisma/client";
import { getCompanyId } from "./tenant";

/**
 * Records an inventory movement, updates product stock counts, and writes logs.
 * Wrapped in a Prisma transaction to guarantee consistency.
 */
export async function recordStockMovement(
  productId: string,
  quantity: number,
  movementType: MovementType,
  referenceType: string,
  referenceId: string,
  providedCompanyId?: string
) {
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  // Resolve companyId (from session if not explicitly provided)
  let companyId = providedCompanyId;
  if (!companyId) {
    companyId = await getCompanyId();
  }

  return await db.$transaction(async (tx) => {
    // 1. Fetch product
    const product = await tx.product.findFirst({
      where: { id: productId, companyId },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found under tenant ${companyId}`);
    }

    let newStockQty = product.stockQty;
    let newReservedQty = product.reservedQty;

    // 2. Adjust quantities based on movement type
    switch (movementType) {
      case MovementType.IN:
        newStockQty += quantity;
        break;
      case MovementType.OUT:
        newStockQty -= quantity;
        break;
      case MovementType.RESERVE:
        newReservedQty += quantity;
        break;
      case MovementType.RELEASE:
        newReservedQty -= quantity;
        break;
      default:
        throw new Error(`Unknown movement type: ${movementType}`);
    }

    // Validation: Stock cannot go below zero
    if (newStockQty < 0) {
      throw new Error(`Insufficient stock for product "${product.name}" (${product.sku}). Current stock: ${product.stockQty}, required deduction: ${quantity}.`);
    }

    if (newReservedQty < 0) {
      newReservedQty = 0;
    }

    // 3. Update Product record
    await tx.product.update({
      where: { id: productId },
      data: {
        stockQty: newStockQty,
        reservedQty: newReservedQty,
      },
    });

    // 4. Create InventoryMovement record
    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        quantity,
        movementType,
        referenceType,
        referenceId,
        balanceAfter: newStockQty,
        companyId,
      },
    });

    // 5. Create AuditLog entry for this movement
    await tx.auditLog.create({
      data: {
        entity: "Product",
        entityId: productId,
        action: `STOCK_${movementType}`,
        oldValue: JSON.stringify({ stockQty: product.stockQty, reservedQty: product.reservedQty }),
        newValue: JSON.stringify({ stockQty: newStockQty, reservedQty: newReservedQty, movementId: movement.id }),
        companyId,
      },
    });

    return movement;
  });
}
