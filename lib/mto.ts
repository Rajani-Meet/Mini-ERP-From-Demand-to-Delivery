import { db } from "./db";
import { logAudit } from "./audit";

/**
 * Creates a Draft Manufacturing Order linked to a Sales Order line item (MTO).
 * Since the database schema does not have a direct foreign key for salesOrderItemId,
 * we store the relationship by encoding it into the moNumber field:
 * `MTO-${salesOrderItemId}`.
 * 
 * Returns the newly created MO's ID.
 */
export async function createManufacturingOrderFromSO(salesOrderItemId: string): Promise<string> {
  // 1. Fetch Sales Order Item with its product and Sales Order context
  const salesOrderItem = await db.salesOrderItem.findUnique({
    where: { id: salesOrderItemId },
    include: {
      salesOrder: true,
      product: true,
    },
  });

  if (!salesOrderItem) {
    throw new Error(`Sales Order Item with ID ${salesOrderItemId} not found.`);
  }

  const companyId = salesOrderItem.salesOrder.companyId;

  // 2. Generate a unique MO number containing the salesOrderItemId
  const moNumber = `MTO-${salesOrderItemId}`;

  // 3. Check if an MO already exists for this Sales Order item
  const existingMO = await db.manufacturingOrder.findUnique({
    where: { moNumber },
  });

  if (existingMO) {
    return existingMO.id;
  }

  // 4. Create the Manufacturing Order in DRAFT status
  const mo = await db.manufacturingOrder.create({
    data: {
      moNumber,
      productId: salesOrderItem.productId,
      quantity: salesOrderItem.quantity,
      status: "DRAFT",
      companyId,
    },
  });

  // 5. Log audit trail for MO creation
  await logAudit(
    companyId,
    null, // System-triggered creation (usually during Sales Order confirmation)
    "ManufacturingOrder",
    mo.id,
    "CREATE",
    {
      after: {
        id: mo.id,
        moNumber,
        productId: mo.productId,
        quantity: mo.quantity,
        status: mo.status,
      },
    }
  );

  return mo.id;
}
