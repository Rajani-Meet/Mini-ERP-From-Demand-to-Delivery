import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";

// Validate user invite input
const inviteSchema = z.object({
  name: z.string().min(2, "User name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(Role),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine((val) => /[A-Z]/.test(val), "Password must contain at least one uppercase letter")
    .refine((val) => /[a-z]/.test(val), "Password must contain at least one lowercase letter")
    .refine((val) => /[0-9]/.test(val), "Password must contain at least one number")
    .refine((val) => /[^a-zA-Z0-9]/.test(val), "Password must contain at least one special character"),
  canAccessProducts: z.boolean().default(true),
  canAccessSales: z.boolean().default(true),
  canAccessPurchases: z.boolean().default(true),
  canAccessManufacturing: z.boolean().default(true),
  canAccessBoM: z.boolean().default(true),
  canAccessStockLedger: z.boolean().default(true),
  canAccessAuditLogs: z.boolean().default(true),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    // List page is Admin or Super Admin-only
    if (session.user.role !== Role.ADMIN && session.user.role !== "SUPER_ADMIN" as Role) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin access only." }, { status: 403 });
    }

    const companyId = session.user.companyId;

    const users = await db.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        canAccessProducts: true,
        canAccessSales: true,
        canAccessPurchases: true,
        canAccessManufacturing: true,
        canAccessBoM: true,
        canAccessStockLedger: true,
        canAccessAuditLogs: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    // Inviting users is Admin or Super Admin-only
    if (session.user.role !== Role.ADMIN && session.user.role !== "SUPER_ADMIN" as Role) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin access only." }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const body = await req.json();

    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      name,
      email,
      role,
      password,
      canAccessProducts,
      canAccessSales,
      canAccessPurchases,
      canAccessManufacturing,
      canAccessBoM,
      canAccessStockLedger,
      canAccessAuditLogs,
    } = parsed.data;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "A user with this email address already exists." },
        { status: 409 }
      );
    }

    // Hash the password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user in DB
    const newUser = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        status: "ACTIVE",
        companyId,
        canAccessProducts,
        canAccessSales,
        canAccessPurchases,
        canAccessManufacturing,
        canAccessBoM,
        canAccessStockLedger,
        canAccessAuditLogs,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        canAccessProducts: true,
        canAccessSales: true,
        canAccessPurchases: true,
        canAccessManufacturing: true,
        canAccessBoM: true,
        canAccessStockLedger: true,
        canAccessAuditLogs: true,
      },
    });

    // Audit Log
    await db.auditLog.create({
      data: {
        entity: "User",
        entityId: newUser.id,
        action: "INVITE",
        userId: session.user.id,
        companyId,
        newValue: JSON.stringify({ email: newUser.email, name: newUser.name, role: newUser.role }),
      },
    });

    return NextResponse.json({ success: true, data: newUser });
  } catch (error) {
    console.error("Failed to invite user:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
