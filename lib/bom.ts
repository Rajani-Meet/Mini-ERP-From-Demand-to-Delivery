import { db } from "./db";

/**
 * Validates if a Bill of Materials exists for the given product ID
 * and contains at least one component.
 * Called by Manufacturing Orders before completing production.
 */
export async function validateBoMExists(productId: string): Promise<boolean> {
  const bom = await db.billOfMaterials.findFirst({
    where: { productId },
    include: {
      components: true,
    },
  });

  return !!bom && bom.components.length > 0;
}
