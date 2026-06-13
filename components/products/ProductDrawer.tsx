"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { X, Loader2, ExternalLink } from "lucide-react";

// Plain string-based form values (HTML inputs always produce strings)
type RawFormValues = {
  name: string;
  sku: string;
  costPrice: string;
  salesPrice: string;
  onHandQty: string;
  reorderPoint: string;
  procurementType: "BUY" | "MAKE";
  description: string;
};

export interface ProductRow {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  costPrice: number;
  salesPrice: number;
  onHandQty: number;
  reservedQty: number;
  reorderPoint: number;
  procurementType: "BUY" | "MAKE";
}

import { useBranding } from "@/contexts/BrandingContext";

interface BomInfo {
  id: string;
  productId: string;
}

interface ProductDrawerProps {
  open: boolean;
  product: ProductRow | null; // null = create mode
  onClose: () => void;
  onSaved: () => void;
}

type FieldErrors = Partial<Record<keyof RawFormValues, string>>;

function validate(values: RawFormValues): FieldErrors {
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
}

export default function ProductDrawer({
  open,
  product,
  onClose,
  onSaved,
}: ProductDrawerProps) {
  const { currencySymbol } = useBranding();
  const isEdit = !!product;
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [bom, setBom] = useState<BomInfo | null>(null);
  const [bomLoading, setBomLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, watch, setValue, reset } = useForm<RawFormValues>({
    defaultValues: {
      name: "",
      sku: "",
      costPrice: "0",
      salesPrice: "0",
      onHandQty: "0",
      reorderPoint: "0",
      procurementType: "BUY",
      description: "",
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          name: product.name,
          sku: product.sku,
          costPrice: String(product.costPrice),
          salesPrice: String(product.salesPrice),
          onHandQty: String(product.onHandQty),
          reorderPoint: String(product.reorderPoint),
          procurementType: product.procurementType,
          description: product.description ?? "",
        });
      } else {
        reset({
          name: "",
          sku: "",
          costPrice: "0",
          salesPrice: "0",
          onHandQty: "0",
          reorderPoint: "0",
          procurementType: "BUY",
          description: "",
        });
      }
      setServerError("");
      setFieldErrors({});
      setBom(null);
    }
  }, [product, open, reset]);

  const procurementType = watch("procurementType");
  const costPriceStr = watch("costPrice") ?? "0";
  const salesPriceStr = watch("salesPrice") ?? "0";
  const onHandQtyStr = watch("onHandQty") ?? "0";
  const reservedQty = product?.reservedQty ?? 0;

  const costPrice = parseFloat(costPriceStr) || 0;
  const salesPrice = parseFloat(salesPriceStr) || 0;
  const onHandQty = parseInt(onHandQtyStr, 10) || 0;

  const availableToSell = Math.max(0, onHandQty - reservedQty);
  const margin =
    salesPrice > 0 ? (((salesPrice - costPrice) / salesPrice) * 100).toFixed(1) : "—";

  // Fetch linked BoM when procurementType is MAKE and editing
  useEffect(() => {
    if (procurementType !== "MAKE" || !product?.id) {
      setBom(null);
      return;
    }
    setBomLoading(true);
    fetch(`/api/bom?productId=${product.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.length > 0) {
          setBom(json.data[0] as BomInfo);
        } else {
          setBom(null);
        }
      })
      .catch(() => setBom(null))
      .finally(() => setBomLoading(false));
  }, [procurementType, product?.id]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = {
      name: watch("name"),
      sku: watch("sku"),
      costPrice: watch("costPrice"),
      salesPrice: watch("salesPrice"),
      onHandQty: watch("onHandQty"),
      reorderPoint: watch("reorderPoint"),
      procurementType: watch("procurementType"),
      description: watch("description"),
    };

    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setServerError("");
    setIsSubmitting(true);

    const payload = {
      name: values.name.trim(),
      sku: values.sku.trim(),
      costPrice: parseFloat(values.costPrice),
      salesPrice: parseFloat(values.salesPrice),
      onHandQty: parseInt(values.onHandQty, 10),
      reorderPoint: parseInt(values.reorderPoint, 10),
      procurementType: values.procurementType,
      description: values.description?.trim() || undefined,
    };

    const url = isEdit ? `/api/products/${product!.id}` : "/api/products";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setIsSubmitting(false);

    if (!json.success) {
      setServerError(json.message ?? "Something went wrong.");
      return;
    }
    onSaved();
  };

  if (!open) return null;

  const inputClass =
    "w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#0E111A] border-l border-[#1E293B] z-50 flex flex-col shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit product" : "New product"}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1E293B]">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {isEdit ? "Edit Product" : "New Product"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEdit ? `Editing ${product!.name}` : "Add a new product to your catalog"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            aria-label="Close drawer"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form
          onSubmit={handleFormSubmit}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-5"
          noValidate
        >
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
              Product Name
            </label>
            <input
              {...register("name")}
              placeholder="e.g. Hydraulic Pump"
              className={inputClass}
            />
            {fieldErrors.name && (
              <p className="text-rose-400 text-xs mt-1">{fieldErrors.name}</p>
            )}
          </div>

          {/* SKU */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
              SKU
            </label>
            <input
              {...register("sku")}
              placeholder="e.g. HYD-PUMP-001"
              className={`${inputClass} font-mono`}
            />
            {fieldErrors.sku && (
              <p className="text-rose-400 text-xs mt-1">{fieldErrors.sku}</p>
            )}
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Cost Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{currencySymbol}</span>
                <input
                  {...register("costPrice")}
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-lg pl-7 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
              {fieldErrors.costPrice && (
                <p className="text-rose-400 text-xs mt-1">{fieldErrors.costPrice}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Sales Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{currencySymbol}</span>
                <input
                  {...register("salesPrice")}
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-lg pl-7 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
              {fieldErrors.salesPrice && (
                <p className="text-rose-400 text-xs mt-1">{fieldErrors.salesPrice}</p>
              )}
            </div>
          </div>

          {/* Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                On Hand Qty
              </label>
              <input
                {...register("onHandQty")}
                type="number"
                min="0"
                step="1"
                className={inputClass}
              />
              {fieldErrors.onHandQty && (
                <p className="text-rose-400 text-xs mt-1">{fieldErrors.onHandQty}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Reorder Point
              </label>
              <input
                {...register("reorderPoint")}
                type="number"
                min="0"
                step="1"
                className={inputClass}
              />
              {fieldErrors.reorderPoint && (
                <p className="text-rose-400 text-xs mt-1">{fieldErrors.reorderPoint}</p>
              )}
            </div>
          </div>

          {/* Procurement Type — segmented control */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
              Procurement Type
            </label>
            <div className="flex rounded-lg border border-[#1E293B] overflow-hidden">
              {(["BUY", "MAKE"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue("procurementType", type)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition ${
                    procurementType === type
                      ? "bg-indigo-600 text-white"
                      : "bg-[#07080C] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
              Description{" "}
              <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              {...register("description")}
              rows={2}
              placeholder="Brief product description…"
              className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none"
            />
          </div>

          {/* Computed preview card */}
          <div className="bg-[#07080C] border border-[#1E293B] rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Computed Preview
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Available to Sell</span>
              <span className="font-mono text-slate-100">{availableToSell}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Margin</span>
              <span
                className={`font-mono font-semibold ${
                  margin !== "—" && parseFloat(margin) >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {margin === "—" ? margin : `${margin}%`}
              </span>
            </div>
          </div>

          {/* Linked BoM (MAKE only) */}
          {procurementType === "MAKE" && (
            <div className="bg-[#07080C] border border-[#1E293B] rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Linked Bill of Materials
              </p>
              {bomLoading ? (
                <span className="text-slate-500 text-sm">Loading…</span>
              ) : bom ? (
                <a
                  href="/bill-of-materials"
                  className="inline-flex items-center gap-1.5 text-cyan-400 text-sm hover:text-cyan-300 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View BoM
                </a>
              ) : (
                <span className="text-slate-500 text-sm italic">
                  No BoM yet — create one in{" "}
                  <a href="/bill-of-materials" className="text-amber-500 hover:underline">
                    Bill of Materials
                  </a>
                </span>
              )}
            </div>
          )}

          {serverError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3 text-rose-400 text-sm">
              {serverError}
            </div>
          )}
        </form>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#1E293B] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 rounded-lg border border-transparent hover:border-[#1E293B] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleFormSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-60 flex items-center gap-2"
            type="button"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </aside>
    </>
  );
}
