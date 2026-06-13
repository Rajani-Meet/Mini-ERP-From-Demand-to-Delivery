import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import DashboardShell from "@/components/DashboardShell";
import { BrandingProvider } from "@/contexts/BrandingContext";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Fetch company branding information from the database
  const company = await db.company.findUnique({
    where: { id: session.user.companyId },
    select: { name: true, logoUrl: true, accentColor: true, currency: true },
  });

  const initialBranding = {
    companyName: company?.name ?? "Nexus ERP",
    logoUrl: company?.logoUrl ?? null,
    accentColor: company?.accentColor ?? "#6366f1",
    currency: company?.currency ?? "USD",
  };

  const user = {
    id: session.user.id,
    name: session.user.name ?? "Operator",
    email: session.user.email ?? "",
    role: session.user.role,
    canAccessProducts: session.user.canAccessProducts,
    canAccessSales: session.user.canAccessSales,
    canAccessPurchases: session.user.canAccessPurchases,
    canAccessManufacturing: session.user.canAccessManufacturing,
    canAccessBoM: session.user.canAccessBoM,
    canAccessStockLedger: session.user.canAccessStockLedger,
    canAccessAuditLogs: session.user.canAccessAuditLogs,
  };

  return (
    <BrandingProvider initial={initialBranding}>
      <DashboardShell branding={initialBranding} user={user}>
        {children}
      </DashboardShell>
    </BrandingProvider>
  );
}
