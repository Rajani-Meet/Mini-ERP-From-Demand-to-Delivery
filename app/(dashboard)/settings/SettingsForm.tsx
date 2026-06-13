"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Settings, CheckCircle, AlertCircle } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

const schema = z.object({
  name: z.string().min(1, "Company name is required"),
  logoUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #6366f1)")
    .optional(),
});

type FormData = {
  name: string;
  logoUrl?: string;
  accentColor?: string;
};

export default function CompanySettingsForm() {
  const branding = useBranding();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      logoUrl: "",
      accentColor: "#6366f1",
    },
  });

  // Fetch current company settings
  useEffect(() => {
    fetch("/api/company")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          reset({
            name: json.data.name ?? "",
            logoUrl: json.data.logoUrl ?? "",
            accentColor: json.data.accentColor ?? "#6366f1",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [reset]);

  const logoUrl = watch("logoUrl");
  const accentColor = watch("accentColor");
  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(accentColor ?? "");

  const onSubmit = async (data: FormData) => {
    setStatus("idle");
    const res = await fetch("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        logoUrl: data.logoUrl || "",
        accentColor: data.accentColor,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      setStatus("error");
      setStatusMsg(json.message ?? "Failed to save settings.");
      return;
    }

    setStatus("success");
    setStatusMsg("Company settings saved successfully.");

    // Update BrandingContext — Sidebar & TopBar update immediately, no page reload
    branding.setBranding({
      companyName: json.data.name,
      logoUrl: json.data.logoUrl ?? null,
      accentColor: json.data.accentColor ?? "#6366f1",
    });

    setTimeout(() => setStatus("idle"), 4000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500 text-sm gap-2">
        <span className="w-5 h-5 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#1E293B] pb-5">
        <div className="p-2.5 bg-slate-800 border border-[#1E293B] rounded-xl">
          <Settings className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
            Company Settings
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage your company branding and appearance
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-[#0E111A] border border-[#1E293B] rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide pb-3 border-b border-[#1E293B]">
            Branding
          </h2>

          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
              Company Name
            </label>
            <input
              {...register("name")}
              placeholder="e.g. Acme Industries"
              className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
            {errors.name && (
              <p className="text-rose-400 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
              Logo URL{" "}
              <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </label>
            <div className="flex gap-3">
              <input
                {...register("logoUrl")}
                placeholder="https://example.com/logo.png"
                className="flex-1 bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
              {/* Live logo preview thumbnail */}
              <div className="w-12 h-12 flex-shrink-0 bg-[#07080C] border border-[#1E293B] rounded-xl flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-slate-600 text-xs font-mono">IMG</span>
                )}
              </div>
            </div>
            {errors.logoUrl && (
              <p className="text-rose-400 text-xs mt-1">{errors.logoUrl.message}</p>
            )}
          </div>

          {/* Accent Color */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
              Accent Color
            </label>
            <div className="flex gap-3 items-center">
              {/* Native color picker */}
              <input
                type="color"
                value={isValidHex ? accentColor : "#6366f1"}
                onChange={(e) => {
                  // Sync the text field as well
                  const el = document.querySelector<HTMLInputElement>('input[name="accentColor"]');
                  if (el) el.value = e.target.value;
                  reset((prev) => ({ ...prev, accentColor: e.target.value }));
                }}
                className="w-12 h-12 rounded-xl border border-[#1E293B] bg-[#07080C] cursor-pointer overflow-hidden p-1"
              />
              {/* Hex text input */}
              <input
                {...register("accentColor")}
                placeholder="#6366f1"
                className="flex-1 bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
              {/* Color swatch */}
              <div
                className="w-12 h-12 rounded-xl border border-[#1E293B] flex-shrink-0 transition-colors"
                style={{ backgroundColor: isValidHex ? accentColor : "#6366f1" }}
              />
            </div>
            {errors.accentColor && (
              <p className="text-rose-400 text-xs mt-1">{errors.accentColor.message}</p>
            )}
            <p className="text-xs text-slate-500 mt-1.5">
              Used for the navigation active state, company avatar, and UI accents across the app.
            </p>
          </div>
        </div>

        {/* Status feedback */}
        {status === "success" && (
          <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {statusMsg}
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {statusMsg}
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-7 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition disabled:opacity-60 flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
