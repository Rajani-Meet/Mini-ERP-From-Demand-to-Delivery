"use client";

import React from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingDown,
  Factory,
  Database,
  Shield,
  LogOut,
  Settings,
  Building2,
  Globe,
  Users,
  FileSpreadsheet,
} from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

interface DashboardShellProps {
  children: React.ReactNode;
  branding: {
    companyName: string;
    logoUrl: string | null;
    accentColor: string;
  };
  user: {
    id?: string;
    name: string;
    email: string;
    role: string;
    canAccessProducts?: boolean;
    canAccessSales?: boolean;
    canAccessPurchases?: boolean;
    canAccessManufacturing?: boolean;
    canAccessBoM?: boolean;
    canAccessStockLedger?: boolean;
    canAccessAuditLogs?: boolean;
  };
}

export default function DashboardShell({
  children,
  branding: initialBranding,
  user,
}: DashboardShellProps) {
  const pathname = usePathname();

  // Prefer live branding from context (updated after settings save)
  let branding = initialBranding;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ctx = useBranding();
    branding = {
      companyName: ctx.companyName,
      logoUrl: ctx.logoUrl,
      accentColor: ctx.accentColor,
    };
  } catch {
    // BrandingContext not available in some test contexts — fall back to props
  }

  // Navigation Items matching the 4-person modules
  const navItems = [
    { name: "Console", href: "/", icon: LayoutDashboard },
    { name: "Products", href: "/products", icon: Package },
    { name: "BoM", href: "/bill-of-materials", icon: FileSpreadsheet },
    { name: "Stock Ledger", href: "/stock-ledger", icon: Database },
    { name: "Sales", href: "/sales-orders", icon: ShoppingCart },
    { name: "Purchases", href: "/purchase-orders", icon: TrendingDown },
    { name: "Manufacturing", href: "/manufacturing-orders", icon: Factory },
    { name: "Users", href: "/users", icon: Users },
    { name: "Audit Logs", href: "/audit-logs", icon: Shield },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // For Super Admins, show dedicated super-admin pages only
  let filteredNavItems = navItems;
  if (user.role === "SUPER_ADMIN") {
    filteredNavItems = [
      { name: "Dashboard", href: "/super-admin", icon: Globe },
      { name: "Companies", href: "/super-admin/companies", icon: Building2 },
      { name: "Users", href: "/super-admin/users", icon: Users },
      { name: "Settings", href: "/settings", icon: Settings },
    ];
  } else {
    // Check user's granular module permission flags
    filteredNavItems = navItems.filter((item) => {
      if (item.name === "Products" && user.canAccessProducts === false) return false;
      if (item.name === "BoM" && user.canAccessBoM === false) return false;
      if (item.name === "Stock Ledger" && user.canAccessStockLedger === false) return false;
      if (item.name === "Sales" && user.canAccessSales === false) return false;
      if (item.name === "Purchases" && user.canAccessPurchases === false) return false;
      if (item.name === "Manufacturing" && user.canAccessManufacturing === false) return false;
      if (item.name === "Users" && user.role !== "ADMIN") return false;
      if (item.name === "Audit Logs" && user.canAccessAuditLogs === false) return false;
      return true;
    });
  }

  // Fallback avatar letter
  const avatarLetter = branding.companyName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#07080C] text-slate-100 flex flex-col relative">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[350px] bg-slate-900/40 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#07080C]/80 backdrop-blur-md border-b border-[#1E293B]/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${branding.companyName} Logo`}
              className="w-8 h-8 object-contain rounded border border-amber-500/20"
            />
          ) : (
            <div
              className="w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm border"
              style={{
                backgroundColor: branding.accentColor + "22",
                borderColor: branding.accentColor + "66",
                color: branding.accentColor,
              }}
            >
              {avatarLetter}
            </div>
          )}
          <div>
            <h2 className="font-bold text-sm tracking-wide text-slate-200">
              {branding.companyName}
            </h2>
            <p className="text-[10px] text-amber-500/80 font-mono uppercase tracking-wider">
              Tenant Terminal
            </p>
          </div>
        </div>

        {/* User profile dropdown and settings */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-200">{user.name}</p>
            <span className="inline-block text-[9px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded px-1.5 py-0.5 mt-0.5 uppercase tracking-wide">
              {user.role}
            </span>
          </div>

          <div className="h-8 w-[1px] bg-[#1E293B] hidden sm:block" />

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all duration-200"
            title="Sign Out Console"
            id="btn-signout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Full Canvas Content Area */}
      <main className="flex-1 overflow-y-auto px-6 py-8 pb-32 max-w-7xl w-full mx-auto relative">
        {children}
      </main>

      {/* Floating Bottom Dock Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <nav className="flex items-center gap-1 bg-[#0E111A]/90 border border-[#1E293B]/80 px-4 py-2.5 rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-lg">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
                id={`nav-${item.name.toLowerCase().replace(/\s/g, "-")}`}
              >
                <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                <span className="text-[10px] font-semibold hidden md:block">
                  {item.name}
                </span>

                {/* Tooltip for small screen */}
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#0E111A] border border-[#1E293B] text-slate-100 text-[10px] py-1 px-2.5 rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 md:hidden shadow-xl">
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
