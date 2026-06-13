"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ShoppingCart, Plus, AlertCircle, Eye } from "lucide-react";

type SOStatus = "DRAFT" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

interface SalesOrderLine {
  id: string;
  quantity: number;
  unitPrice: number;
  product: { id: string; name: string; sku: string };
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  status: SOStatus;
  totalAmount: number;
  createdAt: string;
  items: SalesOrderLine[];
}

const STATUS_FILTERS = ["ALL", "DRAFT", "CONFIRMED", "DELIVERED", "CANCELLED"] as const;

function StatusBadge({ status }: { status: SOStatus }) {
  const map: Record<SOStatus, { label: string; className: string }> = {
    DRAFT: {
      label: "Draft",
      className: "bg-slate-500/10 text-slate-400 border-slate-500/25",
    },
    CONFIRMED: {
      label: "Confirmed",
      className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25",
    },
    DELIVERED: {
      label: "Delivered",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    },
    CANCELLED: {
      label: "Cancelled",
      className: "bg-rose-500/10 text-rose-400 border-rose-500/25",
    },
  };
  const { label, className } = map[status] ?? map.DRAFT;
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold font-mono px-2 py-0.5 border rounded ${className}`}
    >
      {label}
    </span>
  );
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url =
        activeFilter === "ALL"
          ? "/api/sales-orders"
          : `/api/sales-orders?status=${activeFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
      } else {
        setError(data.message || "Failed to load orders.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filterLabel = (f: string) => {
    const map: Record<string, string> = {
      ALL: "All",
      DRAFT: "Draft",
      CONFIRMED: "Confirmed",
      DELIVERED: "Delivered",
      CANCELLED: "Cancelled",
    };
    return map[f] ?? f;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            <ShoppingCart className="w-8 h-8 text-indigo-400" />
            Sales Orders
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage customer demand, confirmations, and deliveries.
          </p>
        </div>
        <Link
          href="/sales-orders/new"
          id="btn-new-so"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/20 text-xs"
        >
          <Plus className="w-4 h-4" />
          New Sales Order
        </Link>
      </div>

      {/* Status filter pill-tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            id={`filter-so-${f.toLowerCase()}`}
            className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold border transition-colors ${
              activeFilter === f
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                : "bg-[#07080C] border-[#1E293B] hover:border-indigo-500/20 text-slate-400 hover:text-slate-200"
            }`}
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table Panel */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="text-center py-20 text-slate-500 text-xs font-mono animate-pulse">
            Loading sales orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
            <ShoppingCart className="w-12 h-12 text-slate-700" />
            <p className="text-sm font-semibold">No sales orders found.</p>
            <Link
              href="/sales-orders/new"
              className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              Create your first order →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#07080C] border-b border-[#1E293B] text-slate-400 font-mono uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3.5">Order #</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5 text-right">Total (₹)</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40">
                {orders.map((so) => (
                  <tr
                    key={so.id}
                    className="hover:bg-[#07080C]/60 transition-colors"
                    style={{ minHeight: "44px" }}
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/sales-orders/${so.id}`}
                        className="font-mono font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                        id={`so-link-${so.id}`}
                      >
                        {so.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 font-medium">
                      {so.customerName}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-200">
                      ₹{so.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={so.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono">
                      {new Date(so.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/sales-orders/${so.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-[#1E293B] hover:border-indigo-500/30 text-slate-300 hover:text-indigo-300 rounded-lg text-[10px] font-bold font-mono transition-all"
                        id={`view-so-${so.id}`}
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
