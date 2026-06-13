import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const resetSchema = z.object({
  token: z.string().min(1, "Token is required."),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .refine((v) => /[A-Z]/.test(v), "Must include an uppercase letter.")
    .refine((v) => /[a-z]/.test(v), "Must include a lowercase letter.")
    .refine((v) => /[0-9]/.test(v), "Must include a number.")
    .refine((v) => /[^a-zA-Z0-9]/.test(v), "Must include a special character."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, newPassword } = parsed.data;

    // Look up token
    const resetToken = await db.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date() > resetToken.expiresAt) {
      await db.passwordResetToken.delete({ where: { token } });
      return NextResponse.json(
        { success: false, message: "This reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Find user
    const user = await db.user.findUnique({ where: { email: resetToken.email } });
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "Account not found or inactive." },
        { status: 404 }
      );
    }

    // Hash new password and update
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Delete used token (single-use)
    await db.passwordResetToken.delete({ where: { token } });

    // Audit log
    await db.auditLog.create({
      data: {
        entity: "User",
        entityId: user.id,
        action: "PASSWORD_RESET",
        userId: user.id,
        companyId: user.companyId,
        newValue: JSON.stringify({ email: user.email, resetAt: new Date().toISOString() }),
      },
    });

    return NextResponse.json({ success: true, message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// GET — validate token (used by the frontend to check if the link is still valid)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ valid: false, message: "No token provided." });
    }

    const resetToken = await db.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken || new Date() > resetToken.expiresAt) {
      return NextResponse.json({ valid: false, message: "Invalid or expired link." });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json({ valid: false, message: "Server error." });
  }
}
