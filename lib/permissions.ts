import { Role } from "@prisma/client";

/**
 * Checks if a user role is allowed to perform a specific action on a resource.
 * Rules:
 * - VIEWER can only "read" any resource.
 * - OPERATOR can "read" + "write" on orders and stock, but not users or settings.
 * - MANAGER can do everything except user management ("user") and company settings ("company").
 * - ADMIN can do everything (always returns true).
 */
export function can(role: Role, action: string, resource: string): boolean {
  const act = action.toLowerCase();
  const res = resource.toLowerCase();

  // ADMIN has full access to all resources and actions
  if (role === Role.ADMIN) {
    return true;
  }

  // VIEWER has read-only access to all resources
  if (role === Role.VIEWER) {
    return act === "read";
  }

  // OPERATOR has read/write access to orders and stock (no delete/user/company access)
  if (role === Role.OPERATOR) {
    const isOrdersOrStock = [
      "salesorder",
      "purchaseorder",
      "manufacturingorder",
      "product",
      "inventorymovement",
      "billofmaterials",
      "bom",
    ].includes(res);

    if (!isOrdersOrStock) {
      return false;
    }
    return act === "read" || act === "write";
  }

  // MANAGER can do everything except user management ("user") and company settings ("company")
  if (role === Role.MANAGER) {
    const isRestricted = ["user", "company"].includes(res);
    if (isRestricted) {
      return false;
    }
    return true;
  }

  return false;
}
