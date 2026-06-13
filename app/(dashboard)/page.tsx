import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Package,
  ShoppingCart,
  TrendingDown,
  Factory,
  Database,
  History,
  ShieldCheck,
  AlertCircle,
  Truck,
  Clock,
  PackageOpen,
  AlertTriangle,
  Wrench,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const companyId = session.user.companyId;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    productCount,
    salesCount,
    purchaseCount,
    moCount,
    pendingDeliveriesCount,
    delayedOrdersCount,
    partialReceiptsCount,
    lowStockCount,
    openMOsCount,
    recentLogs,
    pendingDeliveries,
    delayedOrders,
    partialReceipts,
  ] = await Promise.all([
    // Basic counts
    db.product.count({ where: { companyId } }),
    db.salesOrder.count({ where: { companyId } }),
    db.purchaseOrder.count({ where: { companyId } }),
    db.manufacturingOrder.count({ where: { companyId } }),

    // KPI: Confirmed SOs awaiting delivery
    db.salesOrder.count({
      where: { companyId, status: "CONFIRMED" },
    }),

    // KPI: Confirmed SOs older than 7 days (overdue)
    db.salesOrder.count({
      where: { companyId, status: "CONFIRMED", updatedAt: { lt: sevenDaysAgo } },
    }),

    // KPI: POs partially received
    db.purchaseOrder.count({
      where: { companyId, status: "PARTIALLY_RECEIVED" },
    }),

    // KPI: Products at or below reorder point
    db.product.findMany({
      where: { companyId, reorderPoint: { gt: 0 } },
      select: { stockQty: true, reorderPoint: true },
    }).then((products) => products.filter((p) => p.stockQty <= p.reorderPoint).length),

    // KPI: Open Manufacturing Orders (DRAFT or STARTED)
    db.manufacturingOrder.count({
      where: { companyId, status: { in: ["DRAFT", "STARTED"] } },
    }),

    // Recent audit logs
    db.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),

    // Detail: pending deliveries list (top 5)
    db.salesOrder.findMany({
      where: { companyId, status: "CONFIRMED" },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: { id: true, orderNumber: true, customerName: true, totalAmount: true, updatedAt: true },
    }),

    // Detail: delayed orders list (top 5)
    db.salesOrder.findMany({
      where: { companyId, status: "CONFIRMED", updatedAt: { lt: sevenDaysAgo } },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: { id: true, orderNumber: true, customerName: true, totalAmount: true, updatedAt: true },
    }),

    // Detail: partial receipts list (top 5)
    db.purchaseOrder.findMany({
      where: { companyId, status: "PARTIALLY_RECEIVED" },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: {
        id: true,
        poNumber: true,
        totalAmount: true,
        updatedAt: true,
        vendor: { select: { name: true } },
      },
    }),
  ]);

  // Base overview stats
  const overviewStats = [
    {
      name: "Total Products",
      value: productCount,
      icon: Package,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      href: "/products",
    },
    {
      name: "Sales Orders",
      value: salesCount,
      icon: ShoppingCart,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      href: "/sales-orders",
    },
    {
      name: "Purchase Orders",
      value: purchaseCount,
      icon: TrendingDown,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      href: "/purchase-orders",
    },
    {
      name: "Manufacturing Orders",
      value: moCount,
      icon: Factory,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      href: "/manufacturing-orders",
    },
  ];

  // KPI alert tiles
  const kpiStats = [
    {
      name: "Pending Deliveries",
      value: pendingDeliveriesCount,
      icon: Truck,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: pendingDeliveriesCount > 0 ? "border-indigo-500/40" : "border-[#1E293B]",
      href: "/sales-orders",
      description: "Confirmed SOs awaiting shipment",
    },
    {
      name: "Delayed Orders",
      value: delayedOrdersCount,
      icon: Clock,
      color: delayedOrdersCount > 0 ? "text-rose-400" : "text-slate-400",
      bg: delayedOrdersCount > 0 ? "bg-rose-500/10" : "bg-slate-500/10",
      border: delayedOrdersCount > 0 ? "border-rose-500/40" : "border-[#1E293B]",
      href: "/sales-orders",
      description: "Confirmed but undelivered for 7+ days",
    },
    {
      name: "Partial Receipts",
      value: partialReceiptsCount,
      icon: PackageOpen,
      color: partialReceiptsCount > 0 ? "text-amber-400" : "text-slate-400",
      bg: partialReceiptsCount > 0 ? "bg-amber-500/10" : "bg-slate-500/10",
      border: partialReceiptsCount > 0 ? "border-amber-500/40" : "border-[#1E293B]",
      href: "/purchase-orders",
      description: "POs partially received from vendor",
    },
    {
      name: "Low Stock Items",
      value: lowStockCount,
      icon: AlertTriangle,
      color: lowStockCount > 0 ? "text-orange-400" : "text-slate-400",
      bg: lowStockCount > 0 ? "bg-orange-500/10" : "bg-slate-500/10",
      border: lowStockCount > 0 ? "border-orange-500/40" : "border-[#1E293B]",
      href: "/products",
      description: "Products at or below reorder point",
    },
    {
      name: "Open MOs",
      value: openMOsCount,
      icon: Wrench,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: openMOsCount > 0 ? "border-cyan-500/40" : "border-[#1E293B]",
      href: "/manufacturing-orders",
      description: "Draft or in-progress manufacturing orders",
    },
  ];

  const daysSince = (date: Date) => {
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-[#1E293B] pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100" id="dash-title">
            Operations Console
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time status monitor — {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-mono">
          <ShieldCheck className="w-4 h-4" />
          <span>System Healthy</span>
        </div>
      </div>

      {/* Overview Counts */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono mb-4">
          Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.name}
                href={stat.href}
                className={`bg-[#0E111A] border ${stat.border} rounded-xl p-5 hover:shadow-lg hover:brightness-110 transition-all duration-200 group`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {stat.name}
                    </p>
                    <p className="text-3xl font-bold mt-2 text-slate-100">{stat.value}</p>
                  </div>
                  <div className={`p-2.5 ${stat.bg} border ${stat.border} rounded-lg ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* KPI Alert Tiles */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono mb-4">
          Operational KPIs
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpiStats.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Link
                key={kpi.name}
                href={kpi.href}
                className={`bg-[#0E111A] border ${kpi.border} rounded-xl p-4 hover:brightness-110 transition-all duration-200 space-y-3`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 ${kpi.bg} rounded-lg ${kpi.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-2xl font-extrabold font-mono ${kpi.color}`}>
                    {kpi.value}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-300">{kpi.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{kpi.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Detail Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pending Deliveries */}
        <div className="bg-[#0E111A] border border-[#1E293B] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B]">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-indigo-400" />
              Pending Deliveries
            </h3>
            <Link href="/sales-orders" className="text-[10px] text-indigo-400 hover:underline font-mono">
              View all →
            </Link>
          </div>
          {pendingDeliveries.length === 0 ? (
            <div className="py-8 text-center text-slate-600 text-xs">No pending deliveries</div>
          ) : (
            <div className="divide-y divide-[#1E293B]/40">
              {pendingDeliveries.map((so) => (
                <Link
                  key={so.id}
                  href={`/sales-orders/${so.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-[#07080C] transition-colors"
                >
                  <div>
                    <p className="text-xs font-bold font-mono text-indigo-400">{so.orderNumber}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{so.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-300">
                      ₹{so.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] text-slate-600 font-mono">
                      {daysSince(so.updatedAt)}d ago
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Delayed Orders */}
        <div className="bg-[#0E111A] border border-[#1E293B] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B]">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              Delayed Orders
              {delayedOrdersCount > 0 && (
                <span className="ml-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {delayedOrdersCount}
                </span>
              )}
            </h3>
            <Link href="/sales-orders" className="text-[10px] text-rose-400 hover:underline font-mono">
              View all →
            </Link>
          </div>
          {delayedOrders.length === 0 ? (
            <div className="py-8 text-center text-slate-600 text-xs">No delayed orders 🎉</div>
          ) : (
            <div className="divide-y divide-[#1E293B]/40">
              {delayedOrders.map((so) => {
                const days = daysSince(so.updatedAt);
                return (
                  <Link
                    key={so.id}
                    href={`/sales-orders/${so.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-[#07080C] transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold font-mono text-rose-400">{so.orderNumber}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{so.customerName}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                        days >= 14
                          ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                          : "bg-orange-500/20 text-orange-400 border-orange-500/30"
                      }`}>
                        {days}d overdue
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Partial Receipts */}
        <div className="bg-[#0E111A] border border-[#1E293B] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B]">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <PackageOpen className="w-3.5 h-3.5 text-amber-400" />
              Partial Receipts
            </h3>
            <Link href="/purchase-orders" className="text-[10px] text-amber-400 hover:underline font-mono">
              View all →
            </Link>
          </div>
          {partialReceipts.length === 0 ? (
            <div className="py-8 text-center text-slate-600 text-xs">No partial receipts</div>
          ) : (
            <div className="divide-y divide-[#1E293B]/40">
              {partialReceipts.map((po) => (
                <Link
                  key={po.id}
                  href={`/purchase-orders/${po.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-[#07080C] transition-colors"
                >
                  <div>
                    <p className="text-xs font-bold font-mono text-amber-400">{po.poNumber}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{po.vendor.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-300">
                      ₹{po.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] text-slate-600 font-mono">
                      {daysSince(po.updatedAt)}d ago
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Audit log + Workflow reference */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Audit Trails */}
        <div className="bg-[#0E111A] border border-[#1E293B] rounded-xl p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
            <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm">
              <History className="w-4 h-4 text-amber-500" />
              Recent System Audits
            </h3>
            <Link href="/audit-logs" className="text-[10px] font-mono bg-[#1E293B] text-slate-300 px-2 py-0.5 rounded hover:text-amber-400 transition-colors">
              View all →
            </Link>
          </div>

          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-slate-600" />
                <p>No audit logs yet.</p>
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
                      {log.entity}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">{log.entityId}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-slate-400 font-semibold">{log.user?.name ?? "System"}</p>
                    <p className="text-[9px] text-slate-600 font-mono">
                      {new Date(log.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Workflow Reference */}
        <div className="bg-[#0E111A] border border-[#1E293B] rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-slate-200 border-b border-[#1E293B] pb-4 flex items-center gap-2 text-sm">
            <Database className="w-4 h-4 text-amber-500" />
            MTO Flow Reference
          </h3>
          <div className="space-y-3 text-xs font-mono">
            {[
              { step: "1", label: "Sales Order Confirmed", color: "bg-indigo-500/10 text-indigo-400" },
              { step: "2", label: "MO Created for MAKE items", color: "bg-amber-500/10 text-amber-400" },
              { step: "3", label: "PO Triggered if stock short", color: "bg-emerald-500/10 text-emerald-400" },
              { step: "4", label: "MO Completed → Deliver SO", color: "bg-purple-500/10 text-purple-400" },
            ].map(({ step, label, color }) => (
              <div key={step} className="flex items-center gap-3 text-slate-300">
                <div className={`w-6 h-6 rounded-lg ${color} flex items-center justify-center font-bold text-[11px] flex-shrink-0`}>
                  {step}
                </div>
                <span className="text-[11px]">{label}</span>
              </div>
            ))}
          </div>
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-[11px] text-slate-400 leading-relaxed">
            <span className="font-semibold text-amber-500">Reminder:</span> Always call{" "}
            <code className="text-slate-200 bg-slate-900 px-1 py-0.5 rounded">recordStockMovement()</code>{" "}
            and{" "}
            <code className="text-slate-200 bg-slate-900 px-1 py-0.5 rounded">logAudit()</code>{" "}
            in your modules.
          </div>
        </div>
      </div>
    </div>
  );
}
