import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

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
}
