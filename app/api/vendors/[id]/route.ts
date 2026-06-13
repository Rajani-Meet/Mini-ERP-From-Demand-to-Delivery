import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { z } from "zod";

const vendorSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100).optional(),
  email: z.string().email("Invalid email address.").optional(),
  phone: z.string().min(1, "Phone is required.").max(30).optional(),
});

// PUT /api/vendors/[id]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role as Role, "write", "PurchaseOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;

    const existing = await db.vendor.findFirst({ where: { id, companyId } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = vendorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const updated = await db.vendor.update({
      where: { id },
      data: parsed.data,
    });

    await logAudit(companyId, session.user.id, "Vendor", id, "UPDATE", {
      before: existing,
      after: updated,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update vendor:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// DELETE /api/vendors/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    if (!can(session.user.role as Role, "write", "PurchaseOrder")) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    const companyId = session.user.companyId;

    const existing = await db.vendor.findFirst({ where: { id, companyId } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    // Block deletion if vendor has any purchase orders
    const poCount = await db.purchaseOrder.count({ where: { vendorId: id } });
    if (poCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot delete vendor — ${poCount} purchase order(s) are linked to them.`,
        },
        { status: 400 }
      );
    }

    await db.vendor.delete({ where: { id } });

    await logAudit(companyId, session.user.id, "Vendor", id, "DELETE", {
      before: existing,
    });

    return NextResponse.json({ success: true, message: "Vendor deleted." });
  } catch (error) {
    console.error("Failed to delete vendor:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
