"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Building2,
  Users,
  ShoppingCart,
  TrendingDown,
  Factory,
  Package,
  AlertTriangle,
  TrendingUp,
  Globe,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";

interface CompanyStats {
  id: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
  createdAt: string;
  staff: { total: number; active: number; inactive: number; admins: number };
  salesOrders: { total: number; draft: number; confirmed: number; delivered: number; cancelled: number; totalValue: number };
  purchaseOrders: { total: number; draft: number; sent: number; received: number; totalValue: number };
  manufacturingOrders: { total: number; draft: number; started: number; completed: number };
  products: { total: number; buy: number; make: number };
}

interface GlobalStats {
  totalCompanies: number;
  totalStaff: number;
  totalSalesOrders: number;
  totalSalesValue: number;
  totalPurchaseOrders: number;
  totalPurchaseValue: number;
  totalManufacturingOrders: number;
  totalProducts: number;
}

function formatCurrency(val: number) {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toLocaleString("en-IN")}`;
}

function StatCard({
  label, value, icon: Icon, color, sub,
}: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className={`bg-[#0E111A] border border-[#1E293B]/70 rounded-xl p-5 flex items-start justify-between gap-4 hover:border-[#1E293B] transition-all group`}>
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">{label}</p>
        <p className="text-2xl font-extrabold text-slate-100">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-1 font-mono">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-lg border ${color} bg-[#07080C] group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase border ${color}`}>
      {count} {label}
    </span>
  );
}

export default function SuperAdminDashboardPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const [isLoading, setIsLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [companies, setCompanies] = useState<CompanyStats[]>([]);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userRole !== "SUPER_ADMIN") return;
    setIsLoading(true);
    fetch("/api/super-admin/analytics")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setGlobalStats(res.data.global);
          setCompanies(res.data.companies);
        } else {
          setError(res.message || "Failed to load analytics.");
        }
      })
      .catch(() => setError("Network error. Please refresh."))
      .finally(() => setIsLoading(false));
  }, [userRole]);

  if (userRole !== "SUPER_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Super Admin Access Required</h2>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="text-sm font-mono">Loading platform analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-[#1E293B] pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-3">
            <Globe className="w-8 h-8 text-amber-500" />
            Platform Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time analytics across all registered tenant companies
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-mono">
          <Activity className="w-4 h-4" />
          <span>Live</span>
        </div>
      </div>

      {/* Global KPI Strip */}
      {globalStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Companies" value={globalStats.totalCompanies} icon={Building2}
            color="text-amber-500 border-amber-500/20" sub="Active tenants" />
          <StatCard label="Total Staff" value={globalStats.totalStaff} icon={Users}
            color="text-blue-400 border-blue-500/20" sub="All roles combined" />
          <StatCard label="Sales Orders" value={globalStats.totalSalesOrders} icon={ShoppingCart}
            color="text-emerald-400 border-emerald-500/20"
            sub={formatCurrency(globalStats.totalSalesValue) + " total value"} />
          <StatCard label="Purchase Orders" value={globalStats.totalPurchaseOrders} icon={TrendingDown}
            color="text-purple-400 border-purple-500/20"
            sub={formatCurrency(globalStats.totalPurchaseValue) + " total value"} />
          <StatCard label="Mfg Orders" value={globalStats.totalManufacturingOrders} icon={Factory}
            color="text-orange-400 border-orange-500/20" sub="Across all tenants" />
          <StatCard label="Total Products" value={globalStats.totalProducts} icon={Package}
            color="text-cyan-400 border-cyan-500/20" sub="Catalog entries" />
          <StatCard label="Total Revenue" value={formatCurrency(globalStats.totalSalesValue)} icon={TrendingUp}
            color="text-emerald-400 border-emerald-500/20" sub="Sales order value" />
          <StatCard label="Total Spend" value={formatCurrency(globalStats.totalPurchaseValue)} icon={TrendingDown}
            color="text-red-400 border-red-500/20" sub="Purchase order value" />
        </div>
      )}

      {/* Per-Company Breakdown */}
      <div>
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-amber-500" />
          Company-Wise Breakdown
          <span className="ml-2 text-[10px] font-mono bg-[#1E293B] text-slate-400 px-2 py-0.5 rounded">
            {companies.length} Tenants
          </span>
        </h2>

        <div className="space-y-3">
          {companies.map((company) => {
            const isExpanded = expandedCompany === company.id;
            const accentColor = company.accentColor ?? "#6366f1";
            const initial = company.name.charAt(0).toUpperCase();

            return (
              <div key={company.id} className="bg-[#0E111A] border border-[#1E293B]/70 rounded-xl overflow-hidden">
                {/* Company Header Row */}
                <button
                  className="w-full p-5 flex items-center gap-4 hover:bg-[#07080C]/40 transition-colors text-left"
                  onClick={() => setExpandedCompany(isExpanded ? null : company.id)}
                >
                  {/* Logo / Avatar */}
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt={company.name}
                      className="w-10 h-10 object-contain rounded-lg border border-[#1E293B]" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border flex-shrink-0"
                      style={{ backgroundColor: accentColor + "22", borderColor: accentColor + "44", color: accentColor }}>
                      {initial}
                    </div>
                  )}

                  {/* Name + Date */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-100 text-sm">{company.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Provisioned: {new Date(company.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="hidden sm:flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                      <Users className="w-3 h-3" /> {company.staff.total} Staff
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                      <ShoppingCart className="w-3 h-3" /> {company.salesOrders.total} Sales
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                      <TrendingDown className="w-3 h-3" /> {company.purchaseOrders.total} Purchases
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
                      <Factory className="w-3 h-3" /> {company.manufacturingOrders.total} MOs
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                      <Package className="w-3 h-3" /> {company.products.total} Products
                    </span>
                  </div>

                  {/* Expand Icon */}
                  <div className="text-slate-500 ml-2 flex-shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-[#1E293B] px-5 pb-5 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Staff */}
                    <div className="bg-[#07080C] rounded-xl p-4 border border-[#1E293B]/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Staff</span>
                      </div>
                      <p className="text-2xl font-extrabold text-slate-100">{company.staff.total}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill label="Active" count={company.staff.active} color="text-emerald-400 border-emerald-500/20 bg-emerald-500/5" />
                        <StatusPill label="Inactive" count={company.staff.inactive} color="text-slate-500 border-[#1E293B] bg-transparent" />
                        <StatusPill label="Admins" count={company.staff.admins} color="text-amber-400 border-amber-500/20 bg-amber-500/5" />
                      </div>
                    </div>

                    {/* Sales Orders */}
                    <div className="bg-[#07080C] rounded-xl p-4 border border-[#1E293B]/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Sales Orders</span>
                      </div>
                      <div>
                        <p className="text-2xl font-extrabold text-slate-100">{company.salesOrders.total}</p>
                        <p className="text-[10px] text-emerald-400 font-mono font-bold mt-0.5">
                          {formatCurrency(company.salesOrders.totalValue)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill label="Draft" count={company.salesOrders.draft} color="text-slate-400 border-[#1E293B] bg-transparent" />
                        <StatusPill label="Confirmed" count={company.salesOrders.confirmed} color="text-blue-400 border-blue-500/20 bg-blue-500/5" />
                        <StatusPill label="Delivered" count={company.salesOrders.delivered} color="text-emerald-400 border-emerald-500/20 bg-emerald-500/5" />
                        <StatusPill label="Cancelled" count={company.salesOrders.cancelled} color="text-red-400 border-red-500/20 bg-red-500/5" />
                      </div>
                    </div>

                    {/* Purchase Orders */}
                    <div className="bg-[#07080C] rounded-xl p-4 border border-[#1E293B]/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Purchase Orders</span>
                      </div>
                      <div>
                        <p className="text-2xl font-extrabold text-slate-100">{company.purchaseOrders.total}</p>
                        <p className="text-[10px] text-purple-400 font-mono font-bold mt-0.5">
                          {formatCurrency(company.purchaseOrders.totalValue)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill label="Draft" count={company.purchaseOrders.draft} color="text-slate-400 border-[#1E293B] bg-transparent" />
                        <StatusPill label="Sent" count={company.purchaseOrders.sent} color="text-yellow-400 border-yellow-500/20 bg-yellow-500/5" />
                        <StatusPill label="Received" count={company.purchaseOrders.received} color="text-emerald-400 border-emerald-500/20 bg-emerald-500/5" />
                      </div>
                    </div>

                    {/* Manufacturing + Products */}
                    <div className="bg-[#07080C] rounded-xl p-4 border border-[#1E293B]/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Factory className="w-4 h-4 text-orange-400" />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Manufacturing</span>
                      </div>
                      <p className="text-2xl font-extrabold text-slate-100">{company.manufacturingOrders.total}</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <StatusPill label="Draft" count={company.manufacturingOrders.draft} color="text-slate-400 border-[#1E293B] bg-transparent" />
                        <StatusPill label="In Progress" count={company.manufacturingOrders.started} color="text-yellow-400 border-yellow-500/20 bg-yellow-500/5" />
                        <StatusPill label="Done" count={company.manufacturingOrders.completed} color="text-emerald-400 border-emerald-500/20 bg-emerald-500/5" />
                      </div>
                      <div className="border-t border-[#1E293B]/50 pt-2 flex items-center gap-3">
                        <Package className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[10px] text-slate-400 font-mono">
                          <span className="text-cyan-400 font-bold">{company.products.total}</span> Products —{" "}
                          {company.products.buy} BUY · {company.products.make} MAKE
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {companies.length === 0 && (
            <div className="text-center py-16 text-slate-500 text-sm font-mono">
              No companies provisioned yet. Use the Companies tab to add tenants.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
