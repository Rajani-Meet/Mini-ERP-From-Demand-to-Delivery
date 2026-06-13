import { db } from "./db";

/**
 * Generates a zero-padded sequential document number for the given company and prefix.
 * E.g. generateNumber(companyId, "SO") → "SO-0001"
 */
export async function generateNumber(
  companyId: string,
  prefix: "SO" | "PO" | "MO"
): Promise<string> {
  let count: number;

  if (prefix === "SO") {
    count = await db.salesOrder.count({ where: { companyId } });
  } else if (prefix === "PO") {
    count = await db.purchaseOrder.count({ where: { companyId } });
  } else {
    count = await db.manufacturingOrder.count({ where: { companyId } });
  }

  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}-${seq}`;
}
