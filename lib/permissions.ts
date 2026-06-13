import { Role } from "@prisma/client";

/**
 * Checks if a user role is allowed to perform a specific action on a resource.
 * Rules:
 * - VIEWER can only "read" any resource.
 * - OPERATOR can "read" + "write" on orders and stock, but not users or settings.
 * - MANAGER can do everything except user management ("user") and company settings ("company").
 * - ADMIN can do everything (always returns true).
 */
export function can(
  userOrRole: Role | {
    role: Role;
    canAccessProducts?: boolean;
    canAccessSales?: boolean;
    canAccessPurchases?: boolean;
    canAccessManufacturing?: boolean;
    canAccessBoM?: boolean;
    canAccessStockLedger?: boolean;
    canAccessAuditLogs?: boolean;
  },
  action: string,
  resource: string
): boolean {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole.role;
  const act = action.toLowerCase();
  const res = resource.toLowerCase();

  // SUPER_ADMIN has full access to all resources and actions
  if (role === "SUPER_ADMIN" as Role) {
    return true;
  }

  // ADMIN has full access to all resources and actions
  if (role === Role.ADMIN) {
    return true;
  }

  // If we have a user object, verify modular checkboxes for non-admin roles
  if (typeof userOrRole === "object") {
    if (res === "product" && userOrRole.canAccessProducts === false) return false;
    if (res === "salesorder" && userOrRole.canAccessSales === false) return false;
    if (res === "purchaseorder" && userOrRole.canAccessPurchases === false) return false;
    if (res === "manufacturingorder" && userOrRole.canAccessManufacturing === false) return false;
    if (res === "billofmaterials" && userOrRole.canAccessBoM === false) return false;
    if (res === "bom" && userOrRole.canAccessBoM === false) return false;
    if (res === "inventorymovement" && userOrRole.canAccessStockLedger === false) return false;
    if (res === "auditlog" && userOrRole.canAccessAuditLogs === false) return false;
  }

  // VIEWER can only "read" any resource
  if (role === Role.VIEWER) {
    return act === "read";
  }

  // OPERATOR can "read" + "write" on orders and stock, but not users or settings
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
