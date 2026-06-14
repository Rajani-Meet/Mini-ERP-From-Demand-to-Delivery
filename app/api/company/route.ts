import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { Role } from "@prisma/client";

const updateSchema = z.object({
  name: z.string().min(1, "Company name is required").optional(),
  logoUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #6366f1)")
    .optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "JPY"]).optional(),
  allowNegativeStock: z.boolean().optional(),
  autoCreateMO: z.boolean().optional(),
  email: z.string().email("Must be a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const companyId = session.user.companyId;

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        accentColor: true,
        currency: true,
        allowNegativeStock: true,
        autoCreateMO: true,
        email: true,
        phone: true,
        address: true,
      },
    });

    if (!company) {
      return NextResponse.json({ success: false, message: "Company not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: company });
  } catch (error) {
    console.error("Failed to fetch company:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    // Admin-only
    if (session.user.role !== Role.ADMIN && session.user.role !== Role.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Admin access only." },
        { status: 403 }
      );
    }

    const companyId = session.user.companyId;
    const body = await req.json();

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      name,
      logoUrl,
      accentColor,
      currency,
      allowNegativeStock,
      autoCreateMO,
      email,
      phone,
      address,
    } = parsed.data;

    if (
      name === undefined &&
      logoUrl === undefined &&
      accentColor === undefined &&
      currency === undefined &&
      allowNegativeStock === undefined &&
      autoCreateMO === undefined &&
      email === undefined &&
      phone === undefined &&
      address === undefined
    ) {
      return NextResponse.json(
        { success: false, message: "No fields provided to update." },
        { status: 400 }
      );
    }

    const before = await db.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        logoUrl: true,
        accentColor: true,
        currency: true,
        allowNegativeStock: true,
        autoCreateMO: true,
        email: true,
        phone: true,
        address: true,
      },
    });

    const after = await db.company.update({
      where: { id: companyId },
      data: {
        ...(name !== undefined && { name }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        ...(accentColor !== undefined && { accentColor }),
        ...(currency !== undefined && { currency }),
        ...(allowNegativeStock !== undefined && { allowNegativeStock }),
        ...(autoCreateMO !== undefined && { autoCreateMO }),
        ...(email !== undefined && { email: email || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(address !== undefined && { address: address || null }),
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        accentColor: true,
        currency: true,
        allowNegativeStock: true,
        autoCreateMO: true,
        email: true,
        phone: true,
        address: true,
      },
    });

    await logAudit(companyId, session.user.id, "Company", companyId, "UPDATE", {
      before,
      after,
    });

    return NextResponse.json({ success: true, data: after });
  } catch (error) {
    console.error("Failed to update company:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
