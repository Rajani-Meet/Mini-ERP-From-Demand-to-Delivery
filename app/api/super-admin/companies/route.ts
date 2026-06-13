import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createCompanySchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  adminName: z.string().min(2, "Admin name must be at least 2 characters"),
  adminEmail: z.string().email("Invalid email address"),
  adminPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine((val) => /[A-Z]/.test(val), "Password must contain at least one uppercase letter")
    .refine((val) => /[a-z]/.test(val), "Password must contain at least one lowercase letter")
    .refine((val) => /[0-9]/.test(val), "Password must contain at least one number")
    .refine((val) => /[^a-zA-Z0-9]/.test(val), "Password must contain at least one special character"),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden: Super Admin access only." }, { status: 403 });
    }

    const companies = await db.company.findMany({
      include: {
        users: {
          where: { role: "ADMIN" },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: companies });
  } catch (error) {
    console.error("Failed to fetch companies:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden: Super Admin access only." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createCompanySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { companyName, adminName, adminEmail, adminPassword } = parsed.data;

    // Verify unique email
    const existingUser = await db.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "A user with this email address already exists." },
        { status: 409 }
      );
    }

    // Securely hash the password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    // Create Company and Company Admin inside a transaction
    const result = await db.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
        },
      });

      const user = await tx.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: "ADMIN", // Creates a Company Admin
          status: "ACTIVE",
          companyId: company.id,
          // Give all modular access by default to the Company Admin
          canAccessProducts: true,
          canAccessSales: true,
          canAccessPurchases: true,
          canAccessManufacturing: true,
          canAccessBoM: true,
          canAccessStockLedger: true,
          canAccessAuditLogs: true,
        },
      });

      // Write Audit Logs
      await tx.auditLog.create({
        data: {
          entity: "Company",
          entityId: company.id,
          action: "CREATE",
          userId: session.user.id,
          companyId: company.id,
          newValue: JSON.stringify({ name: company.name }),
        },
      });

      await tx.auditLog.create({
        data: {
          entity: "User",
          entityId: user.id,
          action: "CREATE_ADMIN",
          userId: session.user.id,
          companyId: company.id,
          newValue: JSON.stringify({ email: user.email, name: user.name, role: user.role }),
        },
      });

      return { company, user };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Failed to provision company tenant:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
