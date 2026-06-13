"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Truck,
  Factory,
  Loader2,
  ExternalLink,
  User,
  MapPin,
  Calendar,
  Hash,
  XCircle,
  ShoppingBag,
} from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

type SOStatus = "DRAFT" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

interface OrderLine {
  id: string;
  quantity: number;
  unitPrice: number;
  product: {
    id: string;
    name: string;
    sku: string;
    procurementType: "BUY" | "MAKE";
  };
}

interface LinkedMO {
  id: string;
  moNumber: string;
  status: string;
}

interface LinkedPO {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerAddress?: string | null;
  status: SOStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderLine[];
  linkedMOs?: LinkedMO[];
  linkedPOs?: LinkedPO[];
}

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
      className={`inline-flex items-center text-[11px] font-bold font-mono px-2.5 py-1 border rounded-lg ${className}`}
    >
      {label}
    </span>
  );
}

function SectionHeader({ icon: Icon, label, accent }: { icon: React.ElementType; label: string; accent: string }) {
  return (
    <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
      <span className={`w-1 h-4 rounded-full inline-block ${accent}`} />
      <Icon className="w-4 h-4 opacity-60" />
      {label}
    </h2>
  );
}

export default function SalesOrderDetailPage() {
  const { currencySymbol } = useBranding();
  const params = useParams<{ id: string }>();

  const [so, setSo] = useState<SalesOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"confirm" | "deliver" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSO = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales-orders/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setSo(data.data);
      } else {
        setError(data.message || "Failed to load Sales Order.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchSO();
  }, [fetchSO]);

  const handleConfirm = async () => {
    setActionLoading("confirm");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/sales-orders/${params.id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccess("Sales Order confirmed successfully! Stock reserved / MOs created.");
        await fetchSO();
      } else {
        setError(data.message || "Failed to confirm order.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeliver = async () => {
    setActionLoading("deliver");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/sales-orders/${params.id}/deliver`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccess("Sales Order marked as Delivered. Stock decremented.");
        await fetchSO();
      } else {
        setError(data.message || "Failed to deliver order.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this Sales Order? This cannot be undone.")) return;
    setActionLoading("cancel");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/sales-orders/${params.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccess("Sales Order has been cancelled. Reserved stock released.");
        await fetchSO();
      } else {
        setError(data.message || "Failed to cancel order.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm font-mono animate-pulse">
        Loading Sales Order…
      </div>
    );
  }

  if (!so) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
        <AlertCircle className="w-10 h-10 text-rose-500/50" />
        <p className="text-sm font-semibold">{error || "Sales Order not found."}</p>
        <Link href="/sales-orders" className="text-xs text-indigo-400 hover:underline">
          ← Back to Sales Orders
        </Link>
      </div>
    );
  }

  const linkedMOs = so.linkedMOs ?? [];
  const linkedPOs = so.linkedPOs ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 border-b border-[#1E293B] pb-6">
        <Link
          href="/sales-orders"
          className="p-2 rounded-lg border border-[#1E293B] hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 transition-all self-start mt-1"
          id="btn-back-to-so-list"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl font-extrabold text-cyan-400 tracking-widest">
              {so.orderNumber}
            </span>
            <StatusBadge status={so.status} />

            {/* Action Buttons */}
            {so.status === "DRAFT" && (
              <button
                onClick={handleConfirm}
                disabled={actionLoading !== null}
                id="btn-confirm-so"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs font-mono rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
              >
                {actionLoading === "confirm" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {actionLoading === "confirm" ? "Confirming…" : "Confirm Order"}
              </button>
            )}
            {so.status === "CONFIRMED" && (
              <button
                onClick={handleDeliver}
                disabled={actionLoading !== null}
                id="btn-deliver-so"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs font-mono rounded-lg transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
              >
                {actionLoading === "deliver" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Truck className="w-3.5 h-3.5" />
                )}
                {actionLoading === "deliver" ? "Processing…" : "Mark Delivered"}
              </button>
            )}
            {(so.status === "DRAFT" || so.status === "CONFIRMED") && (
              <button
                onClick={handleCancel}
                disabled={actionLoading !== null}
                id="btn-cancel-so"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 hover:border-rose-500/70 disabled:opacity-50 text-rose-400 font-bold text-xs font-mono rounded-lg transition-all active:scale-95"
              >
                {actionLoading === "cancel" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                {actionLoading === "cancel" ? "Cancelling…" : "Cancel Order"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Created {new Date(so.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </span>
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {so.items.length} line{so.items.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Customer Details */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl p-6 space-y-4">
        <SectionHeader icon={User} label="Customer Details" accent="bg-indigo-500" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <p className="text-slate-500 font-mono uppercase tracking-wider text-[10px]">Name</p>
            <p className="text-slate-200 font-semibold">{so.customerName}</p>
          </div>
          {so.customerAddress && (
            <div className="space-y-1">
              <p className="text-slate-500 font-mono uppercase tracking-wider text-[10px] flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Address
              </p>
              <p className="text-slate-300 whitespace-pre-line">{so.customerAddress}</p>
            </div>
          )}
        </div>
      </div>

      {/* Order Lines */}
      <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#1E293B]">
          <SectionHeader icon={ShoppingCart} label="Order Lines" accent="bg-cyan-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#07080C] border-b border-[#1E293B] text-slate-500 font-mono uppercase text-[10px]">
                <th className="px-5 py-3 text-left">Product</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">Unit Price</th>
                <th className="px-5 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/30">
              {so.items.map((item) => (
                <tr key={item.id} className="hover:bg-[#07080C]/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-200">{item.product.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{item.product.sku}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                        item.product.procurementType === "MAKE"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                          : "bg-cyan-500/10 text-cyan-400 border-cyan-500/25"
                      }`}
                    >
                      {item.product.procurementType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-300">
                    {item.quantity}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-400">
                    {currencySymbol}{item.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-200">
                    {currencySymbol}{(item.quantity * item.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#1E293B] bg-[#07080C]">
                <td colSpan={4} className="px-5 py-4 text-right font-mono text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                  Order Total
                </td>
                <td className="px-5 py-4 text-right font-mono font-extrabold text-indigo-400 text-base">
                  {currencySymbol}{so.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Linked Manufacturing Orders */}
      {linkedMOs.length > 0 && (
        <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl p-6 space-y-4">
          <SectionHeader icon={Factory} label="Linked Manufacturing Orders" accent="bg-amber-500" />
          <div className="space-y-2">
            {linkedMOs.map((mo) => (
              <div
                key={mo.id}
                className="flex items-center justify-between p-3 bg-[#07080C] border border-[#1E293B]/60 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Factory className="w-4 h-4 text-amber-500/60" />
                  <div>
                    <span className="text-xs font-semibold text-slate-300">Manufacturing Order: </span>
                    <span className="font-mono text-xs text-amber-400 font-bold">{mo.moNumber}</span>
                  </div>
                  <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border bg-slate-500/10 text-slate-400 border-slate-500/25">
                    {mo.status}
                  </span>
                </div>
                <Link
                  href={`/manufacturing-orders`}
                  id={`mo-link-${mo.id}`}
                  className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold font-mono transition-colors"
                >
                  View →
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked Purchase Orders */}
      {linkedPOs.length > 0 && (
        <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl p-6 space-y-4">
          <SectionHeader icon={ShoppingBag} label="Linked Purchase Orders" accent="bg-cyan-500" />
          <div className="space-y-2">
            {linkedPOs.map((po) => (
              <div
                key={po.id}
                className="flex items-center justify-between p-3 bg-[#07080C] border border-[#1E293B]/60 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-4 h-4 text-cyan-500/60" />
                  <div>
                    <span className="text-xs font-semibold text-slate-300">Purchase Order: </span>
                    <span className="font-mono text-xs text-cyan-400 font-bold">{po.poNumber}</span>
                  </div>
                  <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border bg-slate-500/10 text-slate-400 border-slate-500/25">
                    {po.status}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ₹{po.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <Link
                  href={`/purchase-orders`}
                  id={`po-link-${po.id}`}
                  className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold font-mono transition-colors"
                >
                  View →
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
