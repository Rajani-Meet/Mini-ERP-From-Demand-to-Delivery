import NextAuth, { DefaultSession } from "next-auth";
import { Role, UserStatus } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      companyId: string;
      role: Role;
      status: UserStatus;
      canAccessProducts: boolean;
      canAccessSales: boolean;
      canAccessPurchases: boolean;
      canAccessManufacturing: boolean;
      canAccessBoM: boolean;
      canAccessStockLedger: boolean;
      canAccessAuditLogs: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    companyId: string;
    role: Role;
    status: UserStatus;
    canAccessProducts: boolean;
    canAccessSales: boolean;
    canAccessPurchases: boolean;
    canAccessManufacturing: boolean;
    canAccessBoM: boolean;
    canAccessStockLedger: boolean;
    canAccessAuditLogs: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    companyId: string;
    role: Role;
    status: UserStatus;
    canAccessProducts: boolean;
    canAccessSales: boolean;
    canAccessPurchases: boolean;
    canAccessManufacturing: boolean;
    canAccessBoM: boolean;
    canAccessStockLedger: boolean;
    canAccessAuditLogs: boolean;
  }
}
