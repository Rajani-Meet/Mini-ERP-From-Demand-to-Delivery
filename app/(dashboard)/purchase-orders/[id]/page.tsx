"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  TrendingDown,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Send,
  PackageCheck,
  Loader2,
  X,
  Building2,
  Mail,
  Phone,
  Calendar,
  Hash,
} from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

type POStatus = "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

interface POLine {
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
  vendor: { id: string; name: string; email: string; phone: string };
  items: POLine[];
}

function StatusBadge({ status }: { status: POStatus }) {
  const map: Record<POStatus, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-slate-500/10 text-slate-400 border-slate-500/25" },
    SENT: { label: "Sent", className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25" },
    PARTIALLY_RECEIVED: { label: "Partially Received", className: "bg-amber-500/10 text-amber-400 border-amber-500/25" },
    RECEIVED: { label: "Received", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" },
    CANCELLED: { label: "Cancelled", className: "bg-rose-500/10 text-rose-400 border-rose-500/25" },
  };
  const { label, className } = map[status] ?? map.DRAFT;
  return (
    <span className={`inline-flex items-center text-[11px] font-bold font-mono px-2.5 py-1 border rounded-lg ${className}`}>
      {label}
    </span>
  );
}

function ProgressBar({ received, ordered }: { received: number; ordered: number }) {
  const pct = ordered > 0 ? Math.min(100, (received / ordered) * 100) : 0;
  const colorClass = pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-slate-700";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-slate-500 w-14 text-right">
        {received}/{ordered}
      </span>
    </div>
  );
}

// ─── Receipt Drawer ──────────────────────────────────────────────────────────
interface ReceiptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder;
  onSuccess: () => void;
}

function ReceiptDrawer({ isOpen, onClose, po, onSuccess }: ReceiptDrawerProps) {
  const [receiptQtys, setReceiptQtys] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      const defaults: Record<string, number> = {};
      po.items.forEach((item) => {
        defaults[item.id] = 0;
      });
      setReceiptQtys(defaults);
      setError(null);
    }
  }, [isOpen, po.items]);

  const handleSubmit = async () => {
    setError(null);
    const lines = po.items
      .map((item) => ({
        lineId: item.id,
        receivedQtyDelta: receiptQtys[item.id] || 0,
      }))
      .filter((l) => l.receivedQtyDelta > 0);

    if (lines.length === 0) {
      setError("Enter at least one received quantity greater than 0.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.message || "Failed to record receipt.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-[#0E111A] border-l border-[#1E293B] shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#1E293B] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-400" />
              Record Receipt
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              PO: {po.poNumber} — enter quantities received per line
            </p>
          </div>
          <button
            onClick={onClose}
            id="btn-close-receipt-drawer"
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent hover:border-[#1E293B] rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {po.items.map((item, idx) => {
            const remaining = item.quantity - item.receivedQty;
            const isFullyReceived = remaining <= 0;
            return (
              <div
                key={item.id}
                className={`p-4 bg-[#07080C] border rounded-xl space-y-3 ${
                  isFullyReceived
                    ? "border-emerald-500/20 opacity-50"
                    : "border-[#1E293B] hover:border-[#2A3A50] transition-colors"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{item.product.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{item.product.sku}</p>
                  </div>
                  {isFullyReceived && (
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded">
                      COMPLETE
                    </span>
                  )}
                </div>

                <ProgressBar received={item.receivedQty} ordered={item.quantity} />

                {!isFullyReceived && (
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Receive Qty
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      value={receiptQtys[item.id] ?? 0}
                      onChange={(e) =>
                        setReceiptQtys((prev) => ({
                          ...prev,
                          [item.id]: Math.min(
                            remaining,
                            Math.max(0, parseInt(e.target.value) || 0)
                          ),
                        }))
                      }
                      id={`receipt-qty-${idx}`}
                      className="flex-1 bg-[#0E111A] border border-[#1E293B] focus:border-emerald-500/60 text-slate-200 text-xs px-3 py-2 rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                      placeholder={`max ${remaining}`}
                    />
                    <span className="text-[10px] text-slate-600 font-mono whitespace-nowrap">
                      / {remaining} rem.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-6 border-t border-[#1E293B] flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#1E293B] hover:bg-slate-900 transition-colors text-xs font-semibold text-slate-300 font-mono"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            id="btn-submit-receipt"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-all active:scale-95 text-xs font-mono shadow-lg shadow-emerald-600/20"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <PackageCheck className="w-3.5 h-3.5" />
                Submit Receipt
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Detail Page ─────────────────────────────────────────────────────────────
export default function PurchaseOrderDetailPage() {
  const { currencySymbol } = useBranding();
  const params = useParams<{ id: string }>();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"send" | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchPO = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setPo(data.data);
      } else {
        setError(data.message || "Failed to load Purchase Order.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPO();
  }, [fetchPO]);

  const handleSend = async () => {
    setActionLoading("send");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/purchase-orders/${params.id}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Purchase Order sent to vendor.");
        await fetchPO();
      } else {
        setError(data.message || "Failed to send PO.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReceiptSuccess = async () => {
    setSuccess("Receipt recorded. Stock updated.");
    await fetchPO();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm font-mono animate-pulse">
        Loading Purchase Order…
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
        <AlertCircle className="w-10 h-10 text-rose-500/50" />
        <p className="text-sm font-semibold">{error || "Purchase Order not found."}</p>
        <Link href="/purchase-orders" className="text-xs text-emerald-400 hover:underline">
          ← Back to Purchase Orders
        </Link>
      </div>
    );
  }

  const canRecord = po.status === "SENT" || po.status === "PARTIALLY_RECEIVED";

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 border-b border-[#1E293B] pb-6">
          <Link
            href="/purchase-orders"
            className="p-2 rounded-lg border border-[#1E293B] hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 transition-all self-start mt-1"
            id="btn-back-to-po-list"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl font-extrabold text-cyan-400 tracking-widest">
                {po.poNumber}
              </span>
              <StatusBadge status={po.status} />

              {/* Action Buttons */}
              {po.status === "DRAFT" && (
                <button
                  onClick={handleSend}
                  disabled={actionLoading !== null}
                  id="btn-send-po"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs font-mono rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                >
                  {actionLoading === "send" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {actionLoading === "send" ? "Sending…" : "Send to Vendor"}
                </button>
              )}
              {canRecord && (
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  id="btn-record-receipt"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono rounded-lg transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  Record Receipt
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Created {new Date(po.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </span>
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {po.items.length} line{po.items.length !== 1 ? "s" : ""}
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

        {/* Vendor Details */}
        <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block" />
            <Building2 className="w-4 h-4 opacity-60" />
            Vendor Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <p className="text-slate-500 font-mono uppercase tracking-wider text-[10px]">Name</p>
              <p className="text-slate-200 font-semibold">{po.vendor.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-500 font-mono uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </p>
              <p className="text-slate-300">{po.vendor.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-500 font-mono uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone
              </p>
              <p className="text-slate-300">{po.vendor.phone || "—"}</p>
            </div>
          </div>
        </div>

        {/* Order Lines with Progress */}
        <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-[#1E293B]">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="w-1 h-4 bg-cyan-500 rounded-full inline-block" />
              <TrendingDown className="w-4 h-4 opacity-60" />
              Order Lines
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#07080C] border-b border-[#1E293B] text-slate-500 font-mono uppercase text-[10px]">
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-5 py-3 text-right">Unit Cost</th>
                  <th className="px-5 py-3 text-right">Ordered Qty</th>
                  <th className="px-5 py-3 text-right">Received Qty</th>
                  <th className="px-5 py-3 text-left w-44">Progress</th>
                  <th className="px-5 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/30">
                {po.items.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-[#07080C]/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-200">{item.product.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {item.product.sku}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-400">
                        {currencySymbol}{item.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-300">
                        {item.quantity}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold">
                        <span className={item.receivedQty >= item.quantity ? "text-emerald-400" : item.receivedQty > 0 ? "text-amber-400" : "text-slate-500"}>
                          {item.receivedQty}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <ProgressBar received={item.receivedQty} ordered={item.quantity} />
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-200">
                        {currencySymbol}{(item.quantity * item.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#1E293B] bg-[#07080C]">
                  <td colSpan={5} className="px-5 py-4 text-right font-mono text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                    Order Total
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-extrabold text-emerald-400 text-base">
                    {currencySymbol}{po.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Receipt Drawer */}
      {po && (
        <ReceiptDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          po={po}
          onSuccess={handleReceiptSuccess}
        />
      )}
    </>
  );
}
