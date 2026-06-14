"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Plus, Trash2, AlertCircle, ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useBranding } from "@/contexts/BrandingContext";

interface Product {
  id: string;
  name: string;
  sku: string;
  stockPrice: number;
  procurementType: "BUY" | "MAKE";
}

interface OrderLine {
  id: string; // local UI key
  productId: string;
  qty: number;
  unitPrice: number;
  unitPriceRaw: string; // tracks the raw input string to avoid controlled→uncontrolled flicker
  qtyRaw: string;
}

export default function NewSalesOrderPage() {
  const { currencySymbol } = useBranding();
  const router = useRouter();

  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([{ id: crypto.randomUUID(), productId: "", qty: 1, unitPrice: 0, qtyRaw: "1", unitPriceRaw: "0" }]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProducts, setIsFetchingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        if (data.success) setProducts(data.data);
      } catch {
        setError("Failed to load products.");
      } finally {
        setIsFetchingProducts(false);
      }
    })();
  }, []);

  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  const addLine = () => {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), productId: "", qty: 1, unitPrice: 0, qtyRaw: "1", unitPriceRaw: "0" }]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof Omit<OrderLine, "id">, value: string | number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        // Auto-fill unit price from product's salesPrice when product changes
        if (field === "productId") {
          const product = products.find((p) => p.id === value);
          if (product) {
            updated.unitPrice = product.stockPrice;
            updated.unitPriceRaw = String(product.stockPrice);
          }
        }
        return updated;
      })
    );
  };

  const updateQtyRaw = (id: string, raw: string) => {
    const parsed = parseInt(raw);
    const qty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    setLines((prev) =>
      prev.map((l) => (l.id !== id ? l : { ...l, qtyRaw: raw, qty }))
    );
  };

  const updateUnitPriceRaw = (id: string, raw: string) => {
    const parsed = parseFloat(raw);
    const unitPrice = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setLines((prev) =>
      prev.map((l) => (l.id !== id ? l : { ...l, unitPriceRaw: raw, unitPrice }))
    );
  };

  const getFilteredProducts = (lineId: string) => {
    const q = (productSearch[lineId] || "").toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError("Customer name is required.");
      return;
    }

    const validLines = lines.filter((l) => l.productId && l.qty > 0);
    if (validLines.length === 0) {
      setError("Add at least one valid order line.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerAddress: customerAddress || undefined,
          lines: validLines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            unitPrice: l.unitPrice,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/sales-orders/${data.data.id}`);
      } else {
        setError(data.message || "Failed to create order.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#1E293B] pb-6">
        <Link
          href="/sales-orders"
          className="p-2 rounded-lg border border-[#1E293B] hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 transition-all"
          id="btn-back-so"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-indigo-400" />
            New Sales Order
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Create a draft order — you can confirm it later.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Details */}
        <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
            <span className="w-1 h-4 bg-indigo-500 rounded-full inline-block" />
            Customer Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Customer Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="input-customer-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full bg-[#07080C] border border-[#1E293B] hover:border-indigo-500/30 focus:border-indigo-500 text-slate-200 text-xs px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none placeholder-slate-600 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Status
              </label>
              <div className="w-full bg-[#07080C] border border-[#1E293B] text-slate-500 text-xs px-3 py-2.5 rounded-lg font-mono">
                DRAFT (auto-set)
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Customer Address
            </label>
            <textarea
              id="input-customer-address"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              rows={3}
              placeholder="Shipping / billing address (optional)"
              className="w-full bg-[#07080C] border border-[#1E293B] hover:border-indigo-500/30 focus:border-indigo-500 text-slate-200 text-xs px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none placeholder-slate-600 transition-all resize-none"
            />
          </div>
        </div>

        {/* Order Lines */}
        <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="w-1 h-4 bg-cyan-500 rounded-full inline-block" />
              Order Lines
            </h2>
            <button
              type="button"
              onClick={addLine}
              id="btn-add-line"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg text-[11px] font-bold font-mono transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Line
            </button>
          </div>

          {/* Lines Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-slate-500 font-mono uppercase text-[10px]">
                  <th className="pb-2 text-left pr-3">Product</th>
                  <th className="pb-2 text-right w-24 px-2">Qty</th>
                  <th className="pb-2 text-right w-32 px-2">Unit Price ({currencySymbol})</th>
                  <th className="pb-2 text-right w-32 px-2">Subtotal ({currencySymbol})</th>
                  <th className="pb-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/30">
                {lines.map((line, idx) => {
                  const filtered = getFilteredProducts(line.id);
                  const selectedProduct = products.find((p) => p.id === line.productId);
                  return (
                    <tr key={line.id} className="group">
                      {/* Product select */}
                      <td className="py-2.5 pr-3">
                        <div className="space-y-1">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search product…"
                              value={productSearch[line.id] ?? (selectedProduct?.name || "")}
                              onChange={(e) => {
                                setProductSearch((s) => ({ ...s, [line.id]: e.target.value }));
                                if (!e.target.value) updateLine(line.id, "productId", "");
                              }}
                              id={`line-product-search-${idx}`}
                              className="w-full bg-[#07080C] border border-[#1E293B] focus:border-indigo-500/60 text-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none placeholder-slate-600 transition-all"
                              disabled={isFetchingProducts}
                            />
                            {productSearch[line.id] && filtered.length > 0 && (
                              <div className="absolute z-20 left-0 right-0 mt-1 bg-[#0E111A] border border-[#1E293B] rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                                {filtered.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className="w-full px-3 py-2 text-left hover:bg-indigo-500/10 text-slate-200 text-xs flex items-center justify-between gap-2 transition-colors"
                                    onClick={() => {
                                      updateLine(line.id, "productId", p.id);
                                      setProductSearch((s) => ({ ...s, [line.id]: p.name }));
                                    }}
                                  >
                                    <div>
                                      <span className="font-semibold">{p.name}</span>
                                      <span className="ml-2 font-mono text-slate-500 text-[10px]">{p.sku}</span>
                                    </div>
                                    <span
                                      className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                                        p.procurementType === "MAKE"
                                          ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                                          : "bg-cyan-500/10 text-cyan-400 border-cyan-500/25"
                                      }`}
                                    >
                                      {p.procurementType}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {selectedProduct && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[9px] text-slate-500">{selectedProduct.sku}</span>
                              <span
                                className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                                  selectedProduct.procurementType === "MAKE"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                                    : "bg-cyan-500/10 text-cyan-400 border-cyan-500/25"
                                }`}
                              >
                                {selectedProduct.procurementType}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Qty */}
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          min={1}
                          value={line.qtyRaw}
                          onChange={(e) => updateQtyRaw(line.id, e.target.value)}
                          onBlur={() => updateQtyRaw(line.id, String(line.qty))}
                          id={`line-qty-${idx}`}
                          className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs px-2 py-2 rounded-lg text-right focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                        />
                      </td>
                      {/* Unit Price */}
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitPriceRaw}
                          onChange={(e) => updateUnitPriceRaw(line.id, e.target.value)}
                          onBlur={() => updateUnitPriceRaw(line.id, String(line.unitPrice))}
                          id={`line-price-${idx}`}
                          className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs px-2 py-2 rounded-lg text-right focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                        />
                      </td>
                      {/* Subtotal */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-300">
                        {currencySymbol}{(line.qty * line.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {/* Remove */}
                      <td className="py-2.5 pl-2">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length === 1}
                          id={`btn-remove-line-${idx}`}
                          className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#1E293B]">
                  <td colSpan={3} className="pt-4 pr-2 text-right text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Order Total
                  </td>
                  <td className="pt-4 px-2 text-right font-mono font-extrabold text-indigo-400 text-base">
                    {currencySymbol}{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link
            href="/sales-orders"
            className="px-5 py-2.5 rounded-xl border border-[#1E293B] hover:bg-slate-900 transition-colors text-xs font-semibold text-slate-300 font-mono"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            id="btn-save-so-draft"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition-all active:scale-95 text-xs font-mono shadow-lg shadow-indigo-600/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save as Draft"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
