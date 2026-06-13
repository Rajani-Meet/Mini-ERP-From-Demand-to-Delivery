import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import CompanySettingsForm from "./SettingsForm";

export default async function CompanySettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== Role.ADMIN) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-[#0E111A] border border-rose-500/20 rounded-2xl p-8 max-w-md text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-100">Access Denied</h2>
          <p className="text-slate-400 text-sm">
            Company settings are restricted to Admin users only.
          </p>
        </div>
      </div>
    );
  }

  return <CompanySettingsForm />;
}
