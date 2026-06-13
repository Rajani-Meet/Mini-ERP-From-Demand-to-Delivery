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
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden: Super Admin only." }, { status: 403 });
    }

    // Fetch all companies with their aggregated stats in a single query
    const companies = await db.company.findMany({
      include: {
        users: {
          select: { id: true, role: true, status: true },
        },
        salesOrders: {
          select: { id: true, status: true, totalAmount: true },
        },
        purchaseOrders: {
          select: { id: true, status: true, totalAmount: true },
        },
        manufacturingOrders: {
          select: { id: true, status: true },
        },
        products: {
          select: { id: true, procurementType: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Build per-company stats
    const companyStats = companies.map((company) => {
      const totalSalesValue = company.salesOrders.reduce((sum, so) => sum + so.totalAmount, 0);
      const totalPurchaseValue = company.purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);

      return {
        id: company.id,
        name: company.name,
        logoUrl: company.logoUrl,
        accentColor: company.accentColor,
        createdAt: company.createdAt,
        staff: {
          total: company.users.length,
          active: company.users.filter((u) => u.status === "ACTIVE").length,
          inactive: company.users.filter((u) => u.status === "INACTIVE").length,
          admins: company.users.filter((u) => u.role === "ADMIN").length,
        },
        salesOrders: {
          total: company.salesOrders.length,
          draft: company.salesOrders.filter((s) => s.status === "DRAFT").length,
          confirmed: company.salesOrders.filter((s) => s.status === "CONFIRMED").length,
          delivered: company.salesOrders.filter((s) => s.status === "DELIVERED").length,
          cancelled: company.salesOrders.filter((s) => s.status === "CANCELLED").length,
          totalValue: totalSalesValue,
        },
        purchaseOrders: {
          total: company.purchaseOrders.length,
          draft: company.purchaseOrders.filter((p) => p.status === "DRAFT").length,
          sent: company.purchaseOrders.filter((p) => p.status === "SENT").length,
          received: company.purchaseOrders.filter((p) => p.status === "RECEIVED").length,
          totalValue: totalPurchaseValue,
        },
        manufacturingOrders: {
          total: company.manufacturingOrders.length,
          draft: company.manufacturingOrders.filter((m) => m.status === "DRAFT").length,
          started: company.manufacturingOrders.filter((m) => m.status === "STARTED").length,
          completed: company.manufacturingOrders.filter((m) => m.status === "COMPLETED").length,
        },
        products: {
          total: company.products.length,
          buy: company.products.filter((p) => p.procurementType === "BUY").length,
          make: company.products.filter((p) => p.procurementType === "MAKE").length,
        },
      };
    });

    // Global aggregate across all companies
    const global = {
      totalCompanies: companies.length,
      totalStaff: companyStats.reduce((s, c) => s + c.staff.total, 0),
      totalSalesOrders: companyStats.reduce((s, c) => s + c.salesOrders.total, 0),
      totalSalesValue: companyStats.reduce((s, c) => s + c.salesOrders.totalValue, 0),
      totalPurchaseOrders: companyStats.reduce((s, c) => s + c.purchaseOrders.total, 0),
      totalPurchaseValue: companyStats.reduce((s, c) => s + c.purchaseOrders.totalValue, 0),
      totalManufacturingOrders: companyStats.reduce((s, c) => s + c.manufacturingOrders.total, 0),
      totalProducts: companyStats.reduce((s, c) => s + c.products.total, 0),
    };

    return NextResponse.json({ success: true, data: { global, companies: companyStats } });
  } catch (error) {
    console.error("Failed to fetch super admin analytics:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
