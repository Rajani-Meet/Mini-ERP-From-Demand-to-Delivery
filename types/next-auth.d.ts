import NextAuth, { DefaultSession } from "next-auth";
import { Role, UserStatus } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      companyId: string;
      role: Role;
      status: UserStatus;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    companyId: string;
    role: Role;
    status: UserStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    companyId: string;
    role: Role;
    status: UserStatus;
  }
}
