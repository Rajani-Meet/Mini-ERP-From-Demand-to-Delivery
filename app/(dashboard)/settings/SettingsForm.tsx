"use client";

import React, { useEffect, useState } from "react";
import {
  User as UserIcon,
  Lock,
  Building2,
  Palette,
  Sliders,
  DollarSign,
  Mail,
  Phone,
  MapPin,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Shield,
} from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

interface SettingsFormProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

type TabType = "profile" | "branding" | "system";

export default function SettingsForm({ user }: SettingsFormProps) {
  const branding = useBranding();
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const [activeTab, setActiveTab] = useState<TabType>("profile");

  // Profile Form State
  const [profileName, setProfileName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<"idle" | "success" | "error">("idle");
  const [profileMessage, setProfileMessage] = useState("");

  // Branding Form State
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [accentColor, setAccentColor] = useState("#6366f1");
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingStatus, setBrandingStatus] = useState<"idle" | "success" | "error">("idle");
  const [brandingMessage, setBrandingMessage] = useState("");

  // System Settings State
  const [currency, setCurrency] = useState("USD");
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [autoCreateMO, setAutoCreateMO] = useState(true);
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<"idle" | "success" | "error">("idle");
  const [systemMessage, setSystemMessage] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch current company settings (Admins only)
  useEffect(() => {
    if (!isAdmin) {
      setInitialLoading(false);
      return;
    }

    fetch("/api/company")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setCompanyName(json.data.name ?? "");
          setLogoUrl(json.data.logoUrl ?? "");
          setAccentColor(json.data.accentColor ?? "#6366f1");
          setCurrency(json.data.currency ?? "USD");
          setAllowNegativeStock(json.data.allowNegativeStock ?? false);
          setAutoCreateMO(json.data.autoCreateMO ?? false);
          setCompanyEmail(json.data.email ?? "");
          setCompanyPhone(json.data.phone ?? "");
          setCompanyAddress(json.data.address ?? "");
        }
      })
      .catch((err) => console.error("Error loading settings:", err))
      .finally(() => setInitialLoading(false));
  }, [isAdmin]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus("idle");
    setProfileMessage("");

    if (newPassword && newPassword !== confirmPassword) {
      setProfileStatus("error");
      setProfileMessage("New passwords do not match.");
      return;
    }

    setProfileLoading(true);
    try {
      const payload: { name?: string; currentPassword?: string; newPassword?: string } = { name: profileName };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        setProfileStatus("error");
        setProfileMessage(data.message ?? "Failed to update profile.");
      } else {
        setProfileStatus("success");
        setProfileMessage("Profile updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        // Reload page or session details in real-world, but state sync is enough
      }
    } catch {
      setProfileStatus("error");
      setProfileMessage("Network error. Please try again.");
    } finally {
      setProfileLoading(false);
      setTimeout(() => setProfileStatus("idle"), 4000);
    }
  };

  const handleBrandingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingStatus("idle");
    setBrandingMessage("");
    setBrandingLoading(true);

    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          logoUrl: logoUrl || "",
          accentColor,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setBrandingStatus("error");
        setBrandingMessage(data.message ?? "Failed to save branding.");
      } else {
        setBrandingStatus("success");
        setBrandingMessage("Branding updated successfully!");

        // Update live branding context
        branding.setBranding({
          companyName: data.data.name,
          logoUrl: data.data.logoUrl || null,
          accentColor: data.data.accentColor || "#6366f1",
        });
      }
    } catch {
      setBrandingStatus("error");
      setBrandingMessage("Network error. Please try again.");
    } finally {
      setBrandingLoading(false);
      setTimeout(() => setBrandingStatus("idle"), 4000);
    }
  };

  const handleSystemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemStatus("idle");
    setSystemMessage("");
    setSystemLoading(true);

    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency,
          allowNegativeStock,
          autoCreateMO,
          email: companyEmail,
          phone: companyPhone,
          address: companyAddress,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setSystemStatus("error");
        setSystemMessage(data.message ?? "Failed to save system settings.");
      } else {
        setSystemStatus("success");
        setSystemMessage("System settings updated successfully!");

        // Update live branding context
        branding.setBranding({
          currency: data.data.currency,
        });
      }
    } catch {
      setSystemStatus("error");
      setSystemMessage("Network error. Please try again.");
    } finally {
      setSystemLoading(false);
      setTimeout(() => setSystemStatus("idle"), 4000);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 text-sm gap-3">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="font-medium tracking-wide">Loading settings module…</span>
      </div>
    );
  }

  // Live validation checks
  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(accentColor);
  const activeColorClass = isValidHex ? accentColor : "#6366f1";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div className="flex items-center gap-4">
          <div
            className="p-3 bg-slate-900 border border-[#1E293B] rounded-2xl shadow-inner transition-colors duration-300"
            style={{ borderColor: activeColorClass + "33" }}
          >
            <Sparkles className="w-6 h-6" style={{ color: activeColorClass }} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
              System Settings
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Configure profile credentials, branding themes, and ERP workflow constraints.
            </p>
          </div>
        </div>

        {/* Optional quick badge showing current role */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-slate-900/60 border border-[#1E293B] px-3.5 py-1.5 rounded-xl">
          <Shield className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            {user.role} Privilege
          </span>
        </div>
      </div>

      {/* Tab Switcher (Only visible to Admins) */}
      {isAdmin && (
        <div className="flex border-b border-[#1E293B]/60 p-1 bg-[#0A0D14]/80 rounded-xl max-w-md">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-300 ${
              activeTab === "profile"
                ? "bg-slate-800 text-slate-100 shadow-md border border-slate-700/50"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab("branding")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-300 ${
              activeTab === "branding"
                ? "bg-slate-800 text-slate-100 shadow-md border border-slate-700/50"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Branding
          </button>
          <button
            onClick={() => setActiveTab("system")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-300 ${
              activeTab === "system"
                ? "bg-slate-800 text-slate-100 shadow-md border border-slate-700/50"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            System
          </button>
        </div>
      )}

      {/* Form Container */}
      <div className="bg-[#0E111A]/80 border border-[#1E293B] backdrop-blur-md rounded-2xl shadow-xl p-6 md:p-8">
        {/* ==================== TAB 1: PROFILE SETTINGS ==================== */}
        {activeTab === "profile" && (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-amber-500" />
                Profile Credentials
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Update your name and account password
              </p>
            </div>

            <hr className="border-[#1E293B]/60" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Email (Disabled) */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Account Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none cursor-not-allowed opacity-60"
                />
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Email logins are system-locked. Contact administrator to modify.
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            <div className="bg-[#07080C]/40 border border-[#1E293B]/60 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                Change Password
              </h3>
              <p className="text-[11px] text-slate-400">
                To update password, fill in the fields below. Passwords require a minimum of 8 characters, with an uppercase letter, lowercase letter, number, and special character.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Current Password */}
                <div className="relative">
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase">
                    Current Password
                  </label>
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl pl-4 pr-10 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3.5 top-9 text-slate-500 hover:text-slate-300"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* New Password */}
                <div className="relative">
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase">
                    New Password
                  </label>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl pl-4 pr-10 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-9 text-slate-500 hover:text-slate-300"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Status alerts */}
            {profileStatus === "success" && (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {profileMessage}
              </div>
            )}
            {profileStatus === "error" && (
              <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {profileMessage}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={profileLoading}
                className="px-6 py-3 text-sm font-semibold text-white rounded-xl transition flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
                style={{
                  backgroundColor: profileLoading ? undefined : activeColorClass,
                }}
              >
                {profileLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        )}

        {/* ==================== TAB 2: COMPANY BRANDING ==================== */}
        {activeTab === "branding" && isAdmin && (
          <form onSubmit={handleBrandingSubmit} className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-500" />
                Branding & Aesthetics
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize colors and logos to skin the system layout
              </p>
            </div>

            <hr className="border-[#1E293B]/60" />

            <div className="space-y-5">
              {/* Company Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Industries"
                  required
                  className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Logo URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                  Logo URL <span className="text-slate-500 normal-case font-normal">(optional)</span>
                </label>
                <div className="flex gap-4">
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="flex-1 bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {/* Live preview thumbnail */}
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
              </div>

              {/* Accent Color */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                  Accent Theme Color
                </label>
                <div className="flex gap-4 items-center">
                  {/* Native color picker */}
                  <input
                    type="color"
                    value={isValidHex ? accentColor : "#6366f1"}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-12 h-12 rounded-xl border border-[#1E293B] bg-[#07080C] cursor-pointer overflow-hidden p-1"
                  />
                  {/* Hex text input */}
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#6366f1"
                    maxLength={7}
                    className="flex-1 bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {/* Color swatch */}
                  <div
                    className="w-12 h-12 rounded-xl border border-[#1E293B] flex-shrink-0 transition-colors duration-200"
                    style={{ backgroundColor: activeColorClass }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Applies color signatures to menus, headers, buttons, and loading gauges.
                </p>
              </div>
            </div>

            {/* Status feedback */}
            {brandingStatus === "success" && (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {brandingMessage}
              </div>
            )}
            {brandingStatus === "error" && (
              <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {brandingMessage}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={brandingLoading}
                className="px-6 py-3 text-sm font-semibold text-white rounded-xl transition flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
                style={{
                  backgroundColor: brandingLoading ? undefined : activeColorClass,
                }}
              >
                {brandingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Branding
              </button>
            </div>
          </form>
        )}

        {/* ==================== TAB 3: SYSTEM & ERP SETTINGS ==================== */}
        {activeTab === "system" && isAdmin && (
          <form onSubmit={handleSystemSubmit} className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500" />
                ERP & System Rules
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Set transactional behaviors, pricing currency, and contact info
              </p>
            </div>

            <hr className="border-[#1E293B]/60" />

            <div className="space-y-6">
              {/* Currency Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                  Default Pricing Currency
                </label>
                <div className="relative max-w-xs">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                  >
                    <option value="USD">USD ($ - US Dollars)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pounds)</option>
                    <option value="INR">INR (₹ - Indian Rupees)</option>
                    <option value="JPY">JPY (¥ - Japanese Yen)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Re-formats price representations across products, sales quotes, and vendor invoices.
                </p>
              </div>

              {/* Toggles Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Allow Negative Stock */}
                <div className="flex items-start justify-between p-4 bg-[#07080C]/40 border border-[#1E293B]/60 rounded-2xl">
                  <div className="space-y-1 flex-1 pr-4">
                    <h3 className="text-sm font-semibold text-slate-200">Allow Negative Stock</h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Permit warehouse dispatches to exceed current physical inventory levels. If disabled, sales completions will block on low stock.
                    </p>
                  </div>
                  {/* Animated toggle switch */}
                  <button
                    type="button"
                    onClick={() => setAllowNegativeStock(!allowNegativeStock)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none mt-1 ${
                      allowNegativeStock ? "bg-indigo-600" : "bg-slate-700"
                    }`}
                    style={{
                      backgroundColor: allowNegativeStock ? activeColorClass : undefined,
                    }}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                        allowNegativeStock ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Auto-create MO */}
                <div className="flex items-start justify-between p-4 bg-[#07080C]/40 border border-[#1E293B]/60 rounded-2xl">
                  <div className="space-y-1 flex-1 pr-4">
                    <h3 className="text-sm font-semibold text-slate-200">Auto-create Manufacturing Orders (MTO)</h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Instantly spawn Draft Manufacturing Orders (MOs) on Sales Order confirmations for MAKE products or out-of-stock items.
                    </p>
                  </div>
                  {/* Animated toggle switch */}
                  <button
                    type="button"
                    onClick={() => setAutoCreateMO(!autoCreateMO)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none mt-1 ${
                      autoCreateMO ? "bg-indigo-600" : "bg-slate-700"
                    }`}
                    style={{
                      backgroundColor: autoCreateMO ? activeColorClass : undefined,
                    }}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                        autoCreateMO ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Contact Info Sub-Section */}
              <div className="bg-[#07080C]/30 border border-[#1E293B]/50 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-500" />
                  Official Contact Details
                </h3>
                <p className="text-[11px] text-slate-400">
                  These details will be used as default contact values in system documents and reports.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Company Email */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-500" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="support@company.com"
                      className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  {/* Company Phone */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-500" />
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="+1 (555) 019-2834"
                      className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                {/* Company Address */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    Physical Address
                  </label>
                  <textarea
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="123 Enterprise Suite, Silicon Valley, CA"
                    rows={3}
                    className="w-full bg-[#07080C] border border-[#1E293B] text-slate-100 rounded-xl px-4 py-3 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Status alerts */}
            {systemStatus === "success" && (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {systemMessage}
              </div>
            )}
            {systemStatus === "error" && (
              <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {systemMessage}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={systemLoading}
                className="px-6 py-3 text-sm font-semibold text-white rounded-xl transition flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
                style={{
                  backgroundColor: systemLoading ? undefined : activeColorClass,
                }}
              >
                {systemLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save System Rules
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
