import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * Retrieves the currently authenticated company ID from the session.
 * Throws an unauthorized error if the user is not signed in or doesn't belong to a tenant.
 */
export async function getCompanyId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    throw new Error("UNAUTHORIZED: Session does not contain a company tenant ID.");
  }
  return session.user.companyId;
}

/**
 * Executes a database operation or query, injecting the tenant's companyId automatically.
 * Helps prevent cross-tenant data leaks.
 */
export async function withCompanyScope<T>(
  operation: (companyId: string) => Promise<T>
): Promise<T> {
  const companyId = await getCompanyId();
  return operation(companyId);
}
