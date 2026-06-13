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

    // Fetch basic information of all users in the same company
    const users = await db.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Failed to fetch user list for selector:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
