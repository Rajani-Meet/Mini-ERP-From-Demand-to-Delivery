import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role, UserStatus, Prisma } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    // Role check: Admin or Super Admin only
    if (session.user.role !== Role.ADMIN && session.user.role !== "SUPER_ADMIN" as Role) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin access only." }, { status: 403 });
    }

    const { id } = await params;
    const companyId = session.user.companyId;
    const body = await req.json();

    const {
      role,
      status,
      canAccessProducts,
      canAccessSales,
      canAccessPurchases,
      canAccessManufacturing,
      canAccessBoM,
      canAccessStockLedger,
      canAccessAuditLogs,
    } = body;

    const isSuperAdmin = session.user.role === "SUPER_ADMIN" as Role;

    // Fetch user to edit
    const where: any = { id };
    if (!isSuperAdmin) {
      where.companyId = companyId;
      where.role = { not: "SUPER_ADMIN" as Role };
    }

    const targetUser = await db.user.findFirst({
      where,
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, message: "User not found under this company." }, { status: 404 });
    }

    // Safeguard: Cannot deactivate or demote oneself
    if (targetUser.id === session.user.id) {
      if (status === UserStatus.INACTIVE || (role && role !== Role.ADMIN && role !== "SUPER_ADMIN" as Role)) {
        return NextResponse.json(
          { success: false, message: "Safety constraint: You cannot demote or deactivate your own admin account." },
          { status: 400 }
        );
      }
    }

    // Guard role elevation
    if (!isSuperAdmin && role === "SUPER_ADMIN" as Role) {
      return NextResponse.json(
        { success: false, message: "Forbidden: You cannot promote a user to Super Admin." },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: Prisma.UserUpdateInput = {};
    if (role !== undefined) {
      if (!Object.values(Role).includes(role)) {
        return NextResponse.json({ success: false, message: "Invalid role value." }, { status: 400 });
      }
      updateData.role = role;
    }
    if (status !== undefined) {
      if (!Object.values(UserStatus).includes(status)) {
        return NextResponse.json({ success: false, message: "Invalid status value." }, { status: 400 });
      }
      updateData.status = status;
    }
    if (canAccessProducts !== undefined) updateData.canAccessProducts = canAccessProducts;
    if (canAccessSales !== undefined) updateData.canAccessSales = canAccessSales;
    if (canAccessPurchases !== undefined) updateData.canAccessPurchases = canAccessPurchases;
    if (canAccessManufacturing !== undefined) updateData.canAccessManufacturing = canAccessManufacturing;
    if (canAccessBoM !== undefined) updateData.canAccessBoM = canAccessBoM;
    if (canAccessStockLedger !== undefined) updateData.canAccessStockLedger = canAccessStockLedger;
    if (canAccessAuditLogs !== undefined) updateData.canAccessAuditLogs = canAccessAuditLogs;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: "No fields provided to update." }, { status: 400 });
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
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

    // Log Audit Trail
    await db.auditLog.create({
      data: {
        entity: "User",
        entityId: id,
        action: "UPDATE",
        userId: session.user.id,
        companyId: targetUser.companyId,
        oldValue: JSON.stringify({
          role: targetUser.role,
          status: targetUser.status,
          canAccessProducts: targetUser.canAccessProducts,
          canAccessSales: targetUser.canAccessSales,
          canAccessPurchases: targetUser.canAccessPurchases,
          canAccessManufacturing: targetUser.canAccessManufacturing,
          canAccessBoM: targetUser.canAccessBoM,
          canAccessStockLedger: targetUser.canAccessStockLedger,
          canAccessAuditLogs: targetUser.canAccessAuditLogs,
        }),
        newValue: JSON.stringify({
          role: updatedUser.role,
          status: updatedUser.status,
          canAccessProducts: updatedUser.canAccessProducts,
          canAccessSales: updatedUser.canAccessSales,
          canAccessPurchases: updatedUser.canAccessPurchases,
          canAccessManufacturing: updatedUser.canAccessManufacturing,
          canAccessBoM: updatedUser.canAccessBoM,
          canAccessStockLedger: updatedUser.canAccessStockLedger,
          canAccessAuditLogs: updatedUser.canAccessAuditLogs,
        }),
      },
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
