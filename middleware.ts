import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/auth (NextAuth API handler)
     * - api/signup (Register API handler)
     * - login (Sign in UI)
     * - signup (Sign up UI)
     * - _next/static (Static resources)
     * - _next/image (Image optimization)
     * - favicon.ico (Icon files)
     */
    "/((?!api/auth|api/signup|login|signup|_next/static|_next/image|favicon.ico).*)",
  ],
};
