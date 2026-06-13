import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const companyId = session.user.companyId;

    const vendors = await db.vendor.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: vendors });
  } catch (error) {
    console.error("Failed to fetch vendors:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
