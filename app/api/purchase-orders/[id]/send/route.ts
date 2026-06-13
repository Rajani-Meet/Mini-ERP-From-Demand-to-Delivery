import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { Role } from "@prisma/client";

// POST /api/purchase-orders/[id]/send
export async function POST(
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

    const po = await db.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!po) {
      return NextResponse.json({ success: false, message: "Purchase Order not found." }, { status: 404 });
    }

    if (po.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, message: "Only DRAFT Purchase Orders can be sent." },
        { status: 400 }
      );
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: { status: "SENT" },
    });

    await logAudit(companyId, session.user.id, "PurchaseOrder", po.id, "STATUS_CHANGE", {
      before: { status: "DRAFT" },
      after: { status: "SENT" },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to send Purchase Order:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
