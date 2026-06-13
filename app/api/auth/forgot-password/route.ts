import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { randomUUID } from "crypto";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, message: "A valid email address is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Always return the same response to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: "If an account with that email exists, a reset link has been sent.",
    });

    const user = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.status !== "ACTIVE") {
      return successResponse; // Silent — do not reveal if account exists
    }

    // Delete any existing tokens for this email (one at a time policy)
    await db.passwordResetToken.deleteMany({ where: { email: normalizedEmail } });

    // Create new token — expires in 1 hour
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.passwordResetToken.create({
      data: { email: normalizedEmail, token, expiresAt },
    });

    const resetLink = `${APP_URL}/reset-password/${token}`;

    // Fire email non-blocking
    sendPasswordResetEmail(normalizedEmail, user.name, resetLink).catch((e) =>
      console.error("[mailer] password reset email failed:", e)
    );

    return successResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
