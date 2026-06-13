"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, Package, AlertCircle, Pencil, Trash2 } from "lucide-react";
import ProductDrawer, { type ProductRow } from "@/components/products/ProductDrawer";

type FilterType = "ALL" | "BUY" | "MAKE" | "LOW_STOCK";
type SortType = "name" | "stock" | "price";

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [sort, setSort] = useState<SortType>("name");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filter === "BUY" || filter === "MAKE") params.set("procurementType", filter);
    if (filter === "LOW_STOCK") params.set("lowStock", "true");
    params.set("sort", sort);

    const res = await fetch(`/api/products?${params.toString()}`);
    const json = await res.json();
    if (json.success) setProducts(json.data);
    setLoading(false);
  }, [search, filter, sort]);

  useEffect(() => {
    const debounce = setTimeout(fetchProducts, 250);
    return () => clearTimeout(debounce);
  }, [fetchProducts]);

  const openCreate = () => {
    setEditProduct(null);
    setDrawerOpen(true);
  };

  const openEdit = (p: ProductRow) => {
    setEditProduct(p);
    setDrawerOpen(true);
  };

  const handleSaved = () => {
    setDrawerOpen(false);
    fetchProducts();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    await fetch(`/api/products/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    setDeleteLoading(false);
    fetchProducts();
  };

  const stockColor = (p: ProductRow) => {
    if (p.onHandQty <= p.reorderPoint) return "text-rose-400";
    if (p.onHandQty <= p.reorderPoint * 1.2 + 1) return "text-amber-400";
    return "text-emerald-400";
  };

  const filterOptions: { label: string; value: FilterType }[] = [
    { label: "All", value: "ALL" },
    { label: "BUY", value: "BUY" },
    { label: "MAKE", value: "MAKE" },
    { label: "Low Stock", value: "LOW_STOCK" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Products</h1>
          <p className="text-sm text-slate-400 mt-1">Manage your product reference catalog</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition"
          id="btn-new-product"
        >
          <Plus className="w-4 h-4" />
          New Product
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU…"
            className="w-full bg-[#0E111A] border border-[#1E293B] text-slate-100 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                filter === opt.value
                  ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                  : "bg-[#0E111A] border-[#1E293B] text-slate-400 hover:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortType)}
          className="bg-[#0E111A] border border-[#1E293B] text-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
        >
          <option value="name">Sort: Name</option>
          <option value="stock">Sort: Stock</option>
          <option value="price">Sort: Price</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0E111A] border border-[#1E293B] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2">
            <span className="w-5 h-5 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
            Loading products…
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
            <Package className="w-12 h-12 text-slate-700" />
            <div className="text-center">
              <p className="font-semibold text-slate-400">No products yet.</p>
              <p className="text-sm mt-1">
                Add your first product{" "}
                <button onClick={openCreate} className="text-indigo-400 hover:text-indigo-300">
                  →
                </button>
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B] text-slate-500 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3.5 text-left w-8">#</th>
                  <th className="px-5 py-3.5 text-left">Name</th>
                  <th className="px-5 py-3.5 text-left">SKU</th>
                  <th className="px-5 py-3.5 text-right">Cost</th>
                  <th className="px-5 py-3.5 text-right">Sales</th>
                  <th className="px-5 py-3.5 text-right">On Hand</th>
                  <th className="px-5 py-3.5 text-right">Available</th>
                  <th className="px-5 py-3.5 text-center">Type</th>
                  <th className="px-5 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-b border-[#1E293B]/50 hover:bg-[#0D1120] transition h-11"
                  >
                    <td className="px-5 py-3 text-slate-600 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-slate-100">{p.name}</td>
                    <td className="px-5 py-3 font-mono text-slate-400 text-xs">{p.sku}</td>
                    <td className="px-5 py-3 text-right text-slate-300">
                      ₹{p.costPrice.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-300">
                      ₹{p.salesPrice.toLocaleString("en-IN")}
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${stockColor(p)}`}>
                      {p.onHandQty}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300">
                      {p.onHandQty - p.reservedQty}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {p.procurementType === "MAKE" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          MAKE
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-700/50 text-slate-400 border border-slate-600/20">
                          BUY
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Drawer */}
      <ProductDrawer
        open={drawerOpen}
        product={editProduct}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
      />

      {/* Delete Confirm Dialog */}
      {deleteTarget && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setDeleteTarget(null)}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-[#0E111A] border border-[#1E293B] rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-100 text-base">Delete Product</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-slate-200">{deleteTarget.name}</span>
                    {" "}({deleteTarget.sku})? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-5 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 rounded-lg border border-[#1E293B] hover:border-slate-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="px-5 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition disabled:opacity-60 flex items-center gap-2"
                >
                  {deleteLoading && (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
