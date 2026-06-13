"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, ChevronLeft, Loader2 } from "lucide-react";

type FormValues = {
  name: string;
  sku: string;
  costPrice: string;
  salesPrice: string;
  onHandQty: string;
  reorderPoint: string;
  procurementType: "BUY" | "MAKE";
  description: string;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

export default function NewProductPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormValues>({
    name: "",
    sku: "",
    costPrice: "0",
    salesPrice: "0",
    onHandQty: "0",
    reorderPoint: "0",
    procurementType: "BUY",
    description: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validate = (values: FormValues): FieldErrors => {
    const errors: FieldErrors = {};
    if (!values.name.trim()) errors.name = "Name is required";
    if (!values.sku.trim()) errors.sku = "SKU is required";
    if (values.sku.length > 50) errors.sku = "SKU must be 50 chars or fewer";

    const cost = parseFloat(values.costPrice);
    if (isNaN(cost) || cost < 0) errors.costPrice = "Must be a non-negative number";

    const sales = parseFloat(values.salesPrice);
    if (isNaN(sales) || sales < 0) errors.salesPrice = "Must be a non-negative number";

    const qty = parseInt(values.onHandQty, 10);
    if (isNaN(qty) || qty < 0) errors.onHandQty = "Must be a non-negative integer";

    const reorder = parseInt(values.reorderPoint, 10);
    if (isNaN(reorder) || reorder < 0) errors.reorderPoint = "Must be a non-negative integer";

    return errors;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleProcurementSelect = (type: "BUY" | "MAKE") => {
    setForm((f) => ({ ...f, procurementType: type }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim() || undefined,
        costPrice: parseFloat(form.costPrice),
        salesPrice: parseFloat(form.salesPrice),
        onHandQty: parseInt(form.onHandQty, 10),
        reorderPoint: parseInt(form.reorderPoint, 10),
        procurementType: form.procurementType,
      };

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      setIsLoading(false);

      if (!json.success) {
        setServerError(json.message ?? "Something went wrong.");
        return;
      }

      router.push("/products");
      router.refresh();
    } catch {
      setServerError("Network error. Please try again.");
      setIsLoading(false);
    }
  };

  const cost = parseFloat(form.costPrice) || 0;
  const sales = parseFloat(form.salesPrice) || 0;
  const margin = sales > 0 ? (((sales - cost) / sales) * 100).toFixed(1) : "—";

  const inputClass =
    "w-full bg-[#0E111A] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/products"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors font-mono uppercase tracking-wider"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Products
        </Link>
      </div>

      {/* Header */}
      <div className="border-b border-[#1E293B] pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
          <Package className="w-8 h-8 text-amber-500" />
          Create New Product
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Add a new reference item to your system inventory catalog
        </p>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className="bg-[#0E111A]/60 border border-[#1E293B] rounded-2xl p-6 space-y-5">
          {/* Product Name */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Product Name
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Hydraulic Pump"
              className={inputClass}
            />
            {fieldErrors.name && (
              <p className="text-rose-400 text-xs font-mono">{fieldErrors.name}</p>
            )}
          </div>

          {/* SKU */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              SKU Reference
            </label>
            <input
              type="text"
              name="sku"
              value={form.sku}
              onChange={handleChange}
              placeholder="e.g. HYD-PUMP-001"
              className={`${inputClass} font-mono`}
            />
            {fieldErrors.sku && (
              <p className="text-rose-400 text-xs font-mono">{fieldErrors.sku}</p>
            )}
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Cost Price
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                <input
                  type="number"
                  name="costPrice"
                  value={form.costPrice}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full bg-[#0E111A] border border-[#1E293B] text-slate-100 rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
              {fieldErrors.costPrice && (
                <p className="text-rose-400 text-xs font-mono">{fieldErrors.costPrice}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Sales Price
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                <input
                  type="number"
                  name="salesPrice"
                  value={form.salesPrice}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full bg-[#0E111A] border border-[#1E293B] text-slate-100 rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
              {fieldErrors.salesPrice && (
                <p className="text-rose-400 text-xs font-mono">{fieldErrors.salesPrice}</p>
              )}
            </div>
          </div>

          {/* Inventory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Initial On-Hand Quantity
              </label>
              <input
                type="number"
                name="onHandQty"
                value={form.onHandQty}
                onChange={handleChange}
                min="0"
                step="1"
                className={inputClass}
              />
              {fieldErrors.onHandQty && (
                <p className="text-rose-400 text-xs font-mono">{fieldErrors.onHandQty}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Reorder Point
              </label>
              <input
                type="number"
                name="reorderPoint"
                value={form.reorderPoint}
                onChange={handleChange}
                min="0"
                step="1"
                className={inputClass}
              />
              {fieldErrors.reorderPoint && (
                <p className="text-rose-400 text-xs font-mono">{fieldErrors.reorderPoint}</p>
              )}
            </div>
          </div>

          {/* Procurement Type Selection */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Procurement Method
            </label>
            <div className="flex rounded-xl border border-[#1E293B] overflow-hidden">
              {(["BUY", "MAKE"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleProcurementSelect(type)}
                  className={`flex-1 py-3 text-sm font-semibold transition-all ${
                    form.procurementType === type
                      ? "bg-indigo-600 text-white"
                      : "bg-[#0E111A] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {type === "BUY" ? "BUY (Purchase from Vendors)" : "MAKE (Manufacture in Work Center)"}
                </button>
              ))}
            </div>
            {form.procurementType === "MAKE" && (
              <div className="mt-2.5 p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 font-mono leading-relaxed">
                ℹ️ <strong>Manufacturing (MAKE) selected</strong>: After creating this product, you should define a Bill of Materials (BoM) under the <Link href="/bill-of-materials" className="underline hover:text-indigo-200 font-bold">Bill of Materials</Link> panel to configure the ingredient materials required to produce it.
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Product Description <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Provide a detailed catalog specification details..."
              className="w-full bg-[#0E111A] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
            />
          </div>

          {/* Margin Computed Preview */}
          <div className="bg-[#07080C] border border-[#1E293B] rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Computed Margin
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Estimated gross markup profit margin</p>
            </div>
            <p className="text-xl font-extrabold text-emerald-400 font-mono">
              {margin === "—" ? "—" : `${margin}%`}
            </p>
          </div>
        </div>

        {serverError && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-sm font-mono">
            {serverError}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/products"
            className="px-5 py-2.5 rounded-xl border border-[#1E293B] hover:bg-slate-900 transition-all text-xs font-semibold text-slate-300 font-mono flex items-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition-all active:scale-95 text-xs font-mono shadow-lg shadow-indigo-600/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              "Save Product"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
