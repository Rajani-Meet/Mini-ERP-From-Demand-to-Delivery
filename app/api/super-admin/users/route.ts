import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine((v) => /[A-Z]/.test(v), "Must contain an uppercase letter")
    .refine((v) => /[a-z]/.test(v), "Must contain a lowercase letter")
    .refine((v) => /[0-9]/.test(v), "Must contain a number")
    .refine((v) => /[^a-zA-Z0-9]/.test(v), "Must contain a special character"),
  role: z.nativeEnum(Role),
  companyId: z.string().uuid("Invalid company ID"),
  canAccessProducts: z.boolean().default(true),
  canAccessSales: z.boolean().default(true),
  canAccessPurchases: z.boolean().default(true),
  canAccessManufacturing: z.boolean().default(true),
  canAccessBoM: z.boolean().default(true),
  canAccessStockLedger: z.boolean().default(true),
  canAccessAuditLogs: z.boolean().default(true),
});

// GET — All users across all companies (Super Admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        companyId: true,
        company: { select: { id: true, name: true, accentColor: true } },
        canAccessProducts: true,
        canAccessSales: true,
        canAccessPurchases: true,
        canAccessManufacturing: true,
        canAccessBoM: true,
        canAccessStockLedger: true,
        canAccessAuditLogs: true,
      },
      orderBy: [{ company: { name: "asc" } }, { createdAt: "asc" }],
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Failed to fetch all users:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// POST — Create user for any company (Super Admin only)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
    }

    const { name, email, password, role, companyId, ...permissions } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ success: false, message: "A user with this email already exists." }, { status: 409 });

    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ success: false, message: "Company not found." }, { status: 404 });

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await db.user.create({
      data: { name, email, passwordHash, role, status: "ACTIVE", companyId, ...permissions },
      select: { id: true, name: true, email: true, role: true, status: true, companyId: true, createdAt: true },
    });

    await db.auditLog.create({
      data: {
        entity: "User",
        entityId: newUser.id,
        action: "CREATE_BY_SUPER_ADMIN",
        userId: session.user.id,
        companyId,
        newValue: JSON.stringify({ email, name, role, companyId }),
      },
    });

    return NextResponse.json({ success: true, data: newUser }, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
