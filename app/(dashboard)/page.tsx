import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Package,
  ShoppingCart,
  TrendingDown,
  Factory,
  Database,
  History,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const companyId = session.user.companyId;

  // Query counts for basic overview tiles
  const [productCount, salesCount, purchaseCount, moCount, recentLogs] = await Promise.all([
    db.product.count({ where: { companyId } }),
    db.salesOrder.count({ where: { companyId } }),
    db.purchaseOrder.count({ where: { companyId } }),
    db.manufacturingOrder.count({ where: { companyId } }),
    db.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const stats = [
    { name: "Total Products", value: productCount, icon: Package, color: "text-amber-500", border: "border-amber-500/20" },
    { name: "Sales Orders", value: salesCount, icon: ShoppingCart, color: "text-blue-500", border: "border-blue-500/20" },
    { name: "Purchase Orders", value: purchaseCount, icon: TrendingDown, color: "text-emerald-500", border: "border-emerald-500/20" },
    { name: "Manufacturing Orders", value: moCount, icon: Factory, color: "text-purple-500", border: "border-purple-500/20" },
  ];

  return (
    <div className="space-y-8">
      {/* Console Welcome */}
      <div className="border-b border-[#1E293B] pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100" id="dash-title">
            Operations Console
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time status monitor of your enterprise tenant
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-mono">
          <ShieldCheck className="w-4 h-4" />
          <span>System Healthy</span>
        </div>
      </div>

      {/* Grid of counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className={`bg-[#0E111A] border ${stat.border} rounded-xl p-6 hover:shadow-lg transition-all duration-200`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {stat.name}
                  </p>
                  <p className="text-3xl font-bold mt-2 text-slate-100">{stat.value}</p>
                </div>
                <div className={`p-3 bg-slate-900 border border-slate-800 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Activity logs and workflow state explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Audit Trails */}
        <div className="bg-[#0E111A] border border-[#1E293B] rounded-xl p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-500" />
              Recent System Audits
            </h3>
            <span className="text-[10px] font-mono bg-[#1E293B] text-slate-300 px-2 py-0.5 rounded">
              Live Feed
            </span>
          </div>

          <div className="space-y-3.5">
            {recentLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-8 h-8 text-slate-600" />
                <p>No audit logs available in this tenant instance yet.</p>
              </div>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-3 bg-[#07080C] border border-[#1E293B]/40 rounded-lg text-xs"
                >
                  <div className="space-y-1">
                    <p className="text-slate-200 font-medium">
                      <span className="text-amber-500 font-mono font-bold mr-1.5">
                        [{log.action}]
                      </span>
                      Modified {log.entity}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Entity ID: <span className="font-mono text-slate-400">{log.entityId}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 font-semibold">{log.user?.name ?? "System"}</p>
                    <p className="text-[9px] text-slate-600 font-mono">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Workflow Quick-Reference Card */}
        <div className="bg-[#0E111A] border border-[#1E293B] rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-slate-200 border-b border-[#1E293B] pb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-500" />
            MTO Flow Reference
          </h3>
          <div className="space-y-4 text-xs">
            <p className="text-slate-400 leading-relaxed">
              Nexus ERP runs on a Make-To-Order (MTO) business workflow:
            </p>
            <div className="space-y-3 font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-5 h-5 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-[10px]">
                  1
                </div>
                <span>Sales Order Confirmed</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-5 h-5 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-[10px]">
                  2
                </div>
                <span>Draft MO Created for MAKE items</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-5 h-5 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-[10px]">
                  3
                </div>
                <span>Draft PO Triggered if components short</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-5 h-5 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-[10px]">
                  4
                </div>
                <span>MO Completed → Goods Delivered</span>
              </div>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-slate-400 leading-relaxed text-[11px]">
              <span className="font-semibold text-amber-500">Notice for developers:</span> Ensure
              to invoke <code className="text-slate-200 font-semibold bg-slate-900 px-1 py-0.5 rounded">recordStockMovement()</code> and <code className="text-slate-200 font-semibold bg-slate-900 px-1 py-0.5 rounded">logAudit()</code> from your respective modules!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
