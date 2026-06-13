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

    // Role check: Admin only
    if (session.user.role !== Role.ADMIN) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin access only." }, { status: 403 });
    }

    const { id } = await params;
    const companyId = session.user.companyId;
    const body = await req.json();

    const { role, status } = body;

    // Fetch user to edit
    const targetUser = await db.user.findFirst({
      where: { id, companyId },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, message: "User not found under this company." }, { status: 404 });
    }

    // Safeguard: Cannot deactivate or demote oneself
    if (targetUser.id === session.user.id) {
      if (status === UserStatus.INACTIVE || (role && role !== Role.ADMIN)) {
        return NextResponse.json(
          { success: false, message: "Safety constraint: You cannot demote or deactivate your own admin account." },
          { status: 400 }
        );
      }
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
      },
    });

    // Log Audit Trail
    await db.auditLog.create({
      data: {
        entity: "User",
        entityId: id,
        action: "UPDATE",
        userId: session.user.id,
        companyId,
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
