import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { Role, UserStatus, Prisma } from "@prisma/client";

// Local constant until Prisma client is regenerated with SUPER_ADMIN in Role enum
const SUPER_ADMIN = "SUPER_ADMIN" as const;
type AppRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";
// Import schema validation types
import { z } from "zod";

const updateSchema = z.object({
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"]).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  newPassword: z
    .string()
    .min(8)
    .refine((v) => /[A-Z]/.test(v))
    .refine((v) => /[a-z]/.test(v))
    .refine((v) => /[0-9]/.test(v))
    .refine((v) => /[^a-zA-Z0-9]/.test(v))
    .optional(),
  canAccessProducts: z.boolean().optional(),
  canAccessSales: z.boolean().optional(),
  canAccessPurchases: z.boolean().optional(),
  canAccessManufacturing: z.boolean().optional(),
  canAccessBoM: z.boolean().optional(),
  canAccessStockLedger: z.boolean().optional(),
  canAccessAuditLogs: z.boolean().optional(),
});

// PATCH — Update any user across any company (Super Admin only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    if ((session.user.role as AppRole) !== SUPER_ADMIN) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    // Prevent SUPER_ADMIN from demoting/deactivating themselves
    if (targetUser.id === session.user.id) {
      if (parsed.data.status === UserStatus.INACTIVE || (parsed.data.role && parsed.data.role !== SUPER_ADMIN)) {
        return NextResponse.json(
          { success: false, message: "Safety constraint: Cannot demote or deactivate your own account." },
          { status: 400 }
        );
      }
    }

    const updateData: Prisma.UserUpdateInput = {};
    const { role, status, newPassword, ...permissions } = parsed.data;

    if (role !== undefined) updateData.role = role as unknown as Role;
    if (status !== undefined) updateData.status = status;
    if (newPassword) {
      const salt = await bcrypt.genSalt(12);
      updateData.passwordHash = await bcrypt.hash(newPassword, salt);
    }
    Object.entries(permissions).forEach(([key, val]) => {
      if (val !== undefined) (updateData as Record<string, unknown>)[key] = val;
    });

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: "No fields to update." }, { status: 400 });
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        entity: "User",
        entityId: id,
        action: "UPDATE_BY_SUPER_ADMIN",
        userId: session.user.id,
        companyId: targetUser.companyId,
        oldValue: JSON.stringify({ role: targetUser.role, status: targetUser.status }),
        newValue: JSON.stringify({ role: updatedUser.role, status: updatedUser.status }),
      },
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// DELETE — Hard delete a user (Super Admin only; cannot delete self)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    if ((session.user.role as AppRole) !== SUPER_ADMIN) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

    const { id } = await params;

    if (id === session.user.id) {
      return NextResponse.json({ success: false, message: "Cannot delete your own account." }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    // Nullify audit log userId references before delete
    await db.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
    await db.user.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "User deleted." });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
