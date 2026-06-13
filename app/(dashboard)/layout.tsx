import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import DashboardShell from "@/components/DashboardShell";

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
    select: { name: true, logoUrl: true },
  });

  const branding = {
    companyName: company?.name ?? "Nexus ERP",
    logoUrl: company?.logoUrl ?? null,
  };

  const user = {
    id: session.user.id,
    name: session.user.name ?? "Operator",
    email: session.user.email ?? "",
    role: session.user.role,
  };

  return (
    <DashboardShell branding={branding} user={user}>
      {children}
    </DashboardShell>
  );
}
