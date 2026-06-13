"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingDown, Plus, Trash2, AlertCircle, ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useBranding } from "@/contexts/BrandingContext";

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
}

interface Vendor {
  id: string;
  name: string;
  email: string;
}

interface OrderLine {
  id: string;
  productId: string;
  orderedQty: number;
  unitCost: number;
}

export default function NewPurchaseOrderPage() {
  const { currencySymbol } = useBranding();
  const router = useRouter();

  const [vendorId, setVendorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([
    { id: crypto.randomUUID(), productId: "", orderedQty: 1, unitCost: 0 },
  ]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const [prodRes, vendRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/vendors"),
        ]);
        const prodData = await prodRes.json();
        const vendData = await vendRes.json();
        if (prodData.success) setProducts(prodData.data);
        if (vendData.success) setVendors(vendData.data);
      } catch {
        setError("Failed to load data.");
      } finally {
        setIsFetching(false);
      }
    })();
  }, []);

  const total = lines.reduce((s, l) => s + l.orderedQty * l.unitCost, 0);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), productId: "", orderedQty: 1, unitCost: 0 },
    ]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (
    id: string,
    field: keyof Omit<OrderLine, "id">,
    value: string | number
  ) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        if (field === "productId") {
          const product = products.find((p) => p.id === value);
          if (product) updated.unitCost = product.costPrice;
        }
        return updated;
      })
    );
  };

  const getFilteredProducts = (lineId: string) => {
    const q = (productSearch[lineId] || "").toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  };

  const filteredVendors = vendors.filter(
    (v) =>
      !vendorSearch ||
      v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      v.email.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vendorId) {
      setError("Please select a vendor.");
      return;
    }

    const validLines = lines.filter((l) => l.productId && l.orderedQty > 0);
    if (validLines.length === 0) {
      setError("Add at least one valid order line.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          lines: validLines.map((l) => ({
            productId: l.productId,
            orderedQty: l.orderedQty,
            unitCost: l.unitCost,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/purchase-orders/${data.data.id}`);
      } else {
        setError(data.message || "Failed to create purchase order.");
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
          href="/purchase-orders"
          className="p-2 rounded-lg border border-[#1E293B] hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 transition-all"
          id="btn-back-po"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-emerald-400" />
            New Purchase Order
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create a draft PO — send to vendor when ready.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vendor Details */}
        <div className="bg-[#0E111A] border border-[#1E293B]/60 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block" />
            Vendor Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Vendor Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Vendor <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={isFetching ? "Loading vendors…" : "Search vendor…"}
                  value={vendorSearch || (selectedVendor?.name ?? "")}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    if (!e.target.value) setVendorId("");
                  }}
                  id="input-vendor-search"
                  disabled={isFetching}
                  className="w-full bg-[#07080C] border border-[#1E293B] hover:border-emerald-500/30 focus:border-emerald-500 text-slate-200 text-xs px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:outline-none placeholder-slate-600 transition-all"
                />
                {vendorSearch && filteredVendors.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-[#0E111A] border border-[#1E293B] rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                    {filteredVendors.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="w-full px-3 py-2.5 text-left hover:bg-emerald-500/10 text-slate-200 text-xs flex flex-col transition-colors border-b border-[#1E293B]/30 last:border-0"
                        onClick={() => {
                          setVendorId(v.id);
                          setVendorSearch("");
                        }}
                      >
                        <span className="font-semibold">{v.name}</span>
                        <span className="text-slate-500 font-mono text-[10px]">{v.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedVendor && (
                <p className="text-[10px] text-slate-500 font-mono ml-1">{selectedVendor.email}</p>
              )}
            </div>

            {/* Status (fixed) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Status
              </label>
              <div className="w-full bg-[#07080C] border border-[#1E293B] text-slate-500 text-xs px-3 py-2.5 rounded-lg font-mono">
                DRAFT (auto-set)
              </div>
            </div>
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
              id="btn-add-po-line"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg text-[11px] font-bold font-mono transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Line
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] text-slate-500 font-mono uppercase text-[10px]">
                  <th className="pb-2 text-left pr-3">Product</th>
                  <th className="pb-2 text-right w-24 px-2">Ordered Qty</th>
                  <th className="pb-2 text-right w-32 px-2">Unit Cost ({currencySymbol})</th>
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
                      <td className="py-2.5 pr-3">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search product…"
                            value={
                              productSearch[line.id] ?? (selectedProduct?.name || "")
                            }
                            onChange={(e) => {
                              setProductSearch((s) => ({
                                ...s,
                                [line.id]: e.target.value,
                              }));
                              if (!e.target.value) updateLine(line.id, "productId", "");
                            }}
                            id={`po-line-product-${idx}`}
                            className="w-full bg-[#07080C] border border-[#1E293B] focus:border-emerald-500/60 text-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none placeholder-slate-600 transition-all"
                          />
                          {productSearch[line.id] && filtered.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-1 bg-[#0E111A] border border-[#1E293B] rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                              {filtered.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="w-full px-3 py-2 text-left hover:bg-emerald-500/10 text-slate-200 text-xs flex items-center justify-between gap-2 transition-colors"
                                  onClick={() => {
                                    updateLine(line.id, "productId", p.id);
                                    setProductSearch((s) => ({
                                      ...s,
                                      [line.id]: p.name,
                                    }));
                                  }}
                                >
                                  <span className="font-semibold">{p.name}</span>
                                  <span className="font-mono text-slate-500 text-[10px]">
                                    {p.sku}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {selectedProduct && (
                          <p className="text-[10px] text-slate-500 font-mono mt-1 ml-1">
                            {selectedProduct.sku}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          min={1}
                          value={line.orderedQty}
                          onChange={(e) =>
                            updateLine(
                              line.id,
                              "orderedQty",
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                          }
                          id={`po-line-qty-${idx}`}
                          className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs px-2 py-2 rounded-lg text-right focus:outline-none focus:border-emerald-500/60 transition-all"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitCost}
                          onChange={(e) =>
                            updateLine(line.id, "unitCost", parseFloat(e.target.value) || 0)
                          }
                          id={`po-line-cost-${idx}`}
                          className="w-full bg-[#07080C] border border-[#1E293B] text-slate-200 text-xs px-2 py-2 rounded-lg text-right focus:outline-none focus:border-emerald-500/60 transition-all"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-300">
                        {currencySymbol}
                        {(line.orderedQty * line.unitCost).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 pl-2">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length === 1}
                          id={`btn-remove-po-line-${idx}`}
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
                  <td
                    colSpan={3}
                    className="pt-4 pr-2 text-right text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider"
                  >
                    Order Total
                  </td>
                  <td className="pt-4 px-2 text-right font-mono font-extrabold text-emerald-400 text-base">
                    {currencySymbol}
                    {total.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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
            href="/purchase-orders"
            className="px-5 py-2.5 rounded-xl border border-[#1E293B] hover:bg-slate-900 transition-colors text-xs font-semibold text-slate-300 font-mono"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            id="btn-save-po-draft"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-all active:scale-95 text-xs font-mono shadow-lg shadow-emerald-600/20"
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
