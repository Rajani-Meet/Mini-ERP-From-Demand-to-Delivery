"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Database, TrendingUp, TrendingDown, BarChart3, AlertCircle } from "lucide-react";

type MovementType = "IN" | "OUT" | "RESERVE" | "RELEASE";

interface Movement {
  id: string;
  productId: string;
  product: { id: string; name: string; sku: string };
  quantity: number;
  movementType: MovementType;
  referenceType: string;
  referenceId: string;
  balanceAfter: number;
  createdAt: string;
}

interface Summary {
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

const MOVEMENT_CONFIG: Record<
  MovementType,
  { label: string; bg: string; text: string; border: string; sign: string }
> = {
  IN: {
    label: "IN",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    sign: "+",
  },
  OUT: {
    label: "OUT",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    sign: "−",
  },
  RESERVE: {
    label: "RESERVE",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    sign: "↓",
  },
  RELEASE: {
    label: "RELEASE",
    bg: "bg-slate-600/20",
    text: "text-slate-400",
    border: "border-slate-600/30",
    sign: "↑",
  },
};

const REF_ROUTES: Record<string, string> = {
  SALES_ORDER: "/sales-orders",
  PURCHASE_ORDER: "/purchase-orders",
  MANUFACTURING_ORDER: "/manufacturing-orders",
};

export default function StockLedgerPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalOnHand: 0, totalReserved: 0, totalAvailable: 0 });
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [productId, setProductId] = useState("");
  const [typeFilter, setTypeFilter] = useState<MovementType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchProducts = useCallback(async () => {
    const res = await fetch("/api/products");
    const json = await res.json();
    if (json.success) setProducts(json.data);
  }, []);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (productId) params.set("productId", productId);
    if (typeFilter) params.set("type", typeFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("pageSize", "100");

    const res = await fetch(`/api/stock-ledger?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      setMovements(json.data);
      setSummary(json.summary);
    }
    setLoading(false);
  }, [productId, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const typeFilters: { label: string; value: MovementType | "" }[] = [
    { label: "All Types", value: "" },
    { label: "IN", value: "IN" },
    { label: "OUT", value: "OUT" },
    { label: "RESERVE", value: "RESERVE" },
    { label: "RELEASE", value: "RELEASE" },
  ];

  const summaryCards = [
    {
      label: "On Hand",
      value: summary.totalOnHand,
      icon: TrendingUp,
      color: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      pct: 100,
      barColor: "bg-emerald-500",
    },
    {
      label: "Reserved",
      value: summary.totalReserved,
      icon: BarChart3,
      color: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
      pct: summary.totalOnHand > 0 ? (summary.totalReserved / summary.totalOnHand) * 100 : 0,
      barColor: "bg-amber-500",
    },
    {
      label: "Available to Sell",
      value: summary.totalAvailable,
      icon: TrendingDown,
      color: "text-cyan-400",
      border: "border-cyan-500/20",
      bg: "bg-cyan-500/5",
      pct: summary.totalOnHand > 0 ? (summary.totalAvailable / summary.totalOnHand) * 100 : 0,
      barColor: "bg-cyan-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            <Database className="w-6 h-6 text-amber-500" />
            Stock Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1">Complete inventory movement history</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`${card.bg} border ${card.border} rounded-xl p-5 space-y-3`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {card.label}
                </span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className={`text-3xl font-bold ${card.color}`}>
                {card.value.toLocaleString("en-IN")}
              </p>
              {/* Indicator bar */}
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${card.barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(100, card.pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-center">
        {/* Product selector */}
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="bg-[#0E111A] border border-[#1E293B] text-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>

        {/* Type filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {typeFilters.map((opt) => {
            const cfg = opt.value ? MOVEMENT_CONFIG[opt.value] : null;
            const isActive = typeFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  isActive
                    ? cfg
                      ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                      : "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                    : "bg-[#0E111A] border-[#1E293B] text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Date range */}
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#0E111A] border border-[#1E293B] text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
          />
          <span className="text-slate-600 text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#0E111A] border border-[#1E293B] text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0E111A] border border-[#1E293B] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2">
            <span className="w-5 h-5 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
            Loading movements…
          </div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
            <AlertCircle className="w-12 h-12 text-slate-700" />
            <div className="text-center">
              <p className="font-semibold text-slate-400">No stock movements found.</p>
              <p className="text-sm mt-1">Try adjusting your filters.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B] text-slate-500 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3.5 text-left">Timestamp</th>
                  <th className="px-5 py-3.5 text-left">Product</th>
                  <th className="px-5 py-3.5 text-center">Type</th>
                  <th className="px-5 py-3.5 text-right">Quantity</th>
                  <th className="px-5 py-3.5 text-left">Reference</th>
                  <th className="px-5 py-3.5 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const cfg = MOVEMENT_CONFIG[m.movementType];
                  const refRoute = REF_ROUTES[m.referenceType];
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-[#1E293B]/50 hover:bg-[#0D1120] transition"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-slate-100 font-medium">{m.product.name}</p>
                        <p className="font-mono text-[10px] text-slate-500 mt-0.5">{m.product.sku}</p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-mono font-semibold ${cfg.text}`}>
                        {cfg.sign}
                        {m.quantity}
                      </td>
                      <td className="px-5 py-3">
                        {refRoute ? (
                          <a
                            href={`${refRoute}/${m.referenceId}`}
                            className="text-indigo-400 hover:text-indigo-300 text-xs font-mono transition"
                          >
                            {m.referenceType.replace(/_/g, " ")} · {m.referenceId.slice(0, 8)}…
                          </a>
                        ) : (
                          <span className="text-xs font-mono text-slate-500">
                            {m.referenceType} · {m.referenceId.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-slate-300">
                        {m.balanceAfter}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
