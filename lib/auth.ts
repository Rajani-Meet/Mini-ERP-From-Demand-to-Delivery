import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import bcrypt from "bcryptjs";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required.");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("Invalid email or password.");
        }

        if (user.status !== "ACTIVE") {
          throw new Error("Account is inactive. Please contact an administrator.");
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Invalid email or password.");
        }

        // Auditing: Write login record in AuditLog
        await db.auditLog.create({
          data: {
            entity: "User",
            entityId: user.id,
            action: "LOGIN",
            userId: user.id,
            companyId: user.companyId,
            newValue: JSON.stringify({ email: user.email, name: user.name, role: user.role }),
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          companyId: user.companyId,
          role: user.role,
          status: user.status,
          canAccessProducts: user.canAccessProducts,
          canAccessSales: user.canAccessSales,
          canAccessPurchases: user.canAccessPurchases,
          canAccessManufacturing: user.canAccessManufacturing,
          canAccessBoM: user.canAccessBoM,
          canAccessStockLedger: user.canAccessStockLedger,
          canAccessAuditLogs: user.canAccessAuditLogs,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.companyId = user.companyId;
        token.role = user.role;
        token.status = user.status;
        token.canAccessProducts = user.canAccessProducts;
        token.canAccessSales = user.canAccessSales;
        token.canAccessPurchases = user.canAccessPurchases;
        token.canAccessManufacturing = user.canAccessManufacturing;
        token.canAccessBoM = user.canAccessBoM;
        token.canAccessStockLedger = user.canAccessStockLedger;
        token.canAccessAuditLogs = user.canAccessAuditLogs;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.companyId = token.companyId;
        session.user.role = token.role;
        session.user.status = token.status;
        session.user.canAccessProducts = token.canAccessProducts;
        session.user.canAccessSales = token.canAccessSales;
        session.user.canAccessPurchases = token.canAccessPurchases;
        session.user.canAccessManufacturing = token.canAccessManufacturing;
        session.user.canAccessBoM = token.canAccessBoM;
        session.user.canAccessStockLedger = token.canAccessStockLedger;
        session.user.canAccessAuditLogs = token.canAccessAuditLogs;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
};
export default authOptions;
