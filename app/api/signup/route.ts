import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

// Password rules from user-management.md: Min 8 chars, uppercase, lowercase, number, special char.
const signupSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  name: z.string().min(2, "User name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine((val) => /[A-Z]/.test(val), "Password must contain at least one uppercase letter")
    .refine((val) => /[a-z]/.test(val), "Password must contain at least one lowercase letter")
    .refine((val) => /[0-9]/.test(val), "Password must contain at least one number")
    .refine((val) => /[^a-zA-Z0-9]/.test(val), "Password must contain at least one special character"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0].message,
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { companyName, name, email, password } = parsed.data;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "A user with this email address already exists.",
          code: "USER_ALREADY_EXISTS",
        },
        { status: 409 }
      );
    }

    // Hash the password securely
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create Company & User within a transaction
    const result = await db.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "ADMIN", // First user is the Admin
          status: "ACTIVE",
          companyId: company.id,
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          entity: "User",
          entityId: user.id,
          action: "SIGNUP",
          userId: user.id,
          companyId: company.id,
          newValue: JSON.stringify({ email: user.email, name: user.name, role: user.role }),
        },
      });

      return {
        userId: user.id,
        companyId: company.id,
        userName: user.name,
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An internal server error occurred.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
