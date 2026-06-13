"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { TrendingDown, Plus, AlertCircle, Eye } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

type POStatus = "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

interface PurchaseOrderLine {
  id: string;
  quantity: number;
  unitPrice: number;
  receivedQty: number;
  product: { id: string; name: string; sku: string };
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: POStatus;
  totalAmount: number;
  createdAt: string;
  vendor: { id: string; name: string; email: string };
  items: PurchaseOrderLine[];
}

const STATUS_FILTERS = ["ALL", "DRAFT", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"] as const;

function StatusBadge({ status }: { status: POStatus }) {
  const map: Record<POStatus, { label: string; className: string }> = {
    DRAFT: {
      label: "Draft",
      className: "bg-slate-500/10 text-slate-400 border-slate-500/25",
    },
    SENT: {
      label: "Sent",
      className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25",
    },
    PARTIALLY_RECEIVED: {
      label: "Partially Received",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    },
    RECEIVED: {
      label: "Received",
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

export default function PurchaseOrdersPage() {
  const { currencySymbol } = useBranding();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url =
        activeFilter === "ALL"
          ? "/api/purchase-orders"
          : `/api/purchase-orders?status=${activeFilter}`;
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
      SENT: "Sent",
      PARTIALLY_RECEIVED: "Partially Received",
      RECEIVED: "Received",
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
            <TrendingDown className="w-8 h-8 text-emerald-400" />
            Purchase Orders
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Procure materials from vendors, track receipts and inventory inflows.
          </p>
        </div>
        <Link
          href="/purchase-orders/new"
          id="btn-new-po"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20 text-xs"
        >
          <Plus className="w-4 h-4" />
          New Purchase Order
        </Link>
      </div>

      {/* Status filter pill-tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            id={`filter-po-${f.toLowerCase()}`}
            className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold border transition-colors ${
              activeFilter === f
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-[#07080C] border-[#1E293B] hover:border-emerald-500/20 text-slate-400 hover:text-slate-200"
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
            Loading purchase orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
            <TrendingDown className="w-12 h-12 text-slate-700" />
            <p className="text-sm font-semibold">No purchase orders found.</p>
            <Link
              href="/purchase-orders/new"
              className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
            >
              Create your first PO →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#07080C] border-b border-[#1E293B] text-slate-400 font-mono uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3.5">PO #</th>
                  <th className="px-5 py-3.5">Vendor</th>
                  <th className="px-5 py-3.5 text-right">Total ({currencySymbol})</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40">
                {orders.map((po) => (
                  <tr
                    key={po.id}
                    className="hover:bg-[#07080C]/60 transition-colors"
                    style={{ minHeight: "44px" }}
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="font-mono font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                        id={`po-link-${po.id}`}
                      >
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 font-medium">
                      {po.vendor.name}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-200">
                      {currencySymbol}{po.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono">
                      {new Date(po.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-[#1E293B] hover:border-emerald-500/30 text-slate-300 hover:text-emerald-300 rounded-lg text-[10px] font-bold font-mono transition-all"
                        id={`view-po-${po.id}`}
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
