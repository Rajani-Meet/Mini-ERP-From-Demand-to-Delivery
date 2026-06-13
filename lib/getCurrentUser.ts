import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { Role } from "@prisma/client";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string;
  canAccessProducts: boolean;
  canAccessSales: boolean;
  canAccessPurchases: boolean;
  canAccessManufacturing: boolean;
  canAccessBoM: boolean;
  canAccessStockLedger: boolean;
  canAccessAuditLogs: boolean;
}

/**
 * Returns the current authenticated user from the Next-Auth session.
 * Returns null if the user is not authenticated.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    companyId: session.user.companyId,
    canAccessProducts: session.user.canAccessProducts,
    canAccessSales: session.user.canAccessSales,
    canAccessPurchases: session.user.canAccessPurchases,
    canAccessManufacturing: session.user.canAccessManufacturing,
    canAccessBoM: session.user.canAccessBoM,
    canAccessStockLedger: session.user.canAccessStockLedger,
    canAccessAuditLogs: session.user.canAccessAuditLogs,
  };
}
