import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

<<<<<<< HEAD
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
}

/**
 * Returns the current authenticated user from the Next-Auth session.
 * Throws if the user is not authenticated.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("UNAUTHORIZED: No active session.");
  }
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    companyId: session.user.companyId,
  };
=======
/**
 * Returns the full session user object, or null if not authenticated.
 * Convenience wrapper for server components and API routes.
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
>>>>>>> d44af0d (feat: add Products, Stock Ledger, and Company Settings modules)
}
