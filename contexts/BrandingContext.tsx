"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export interface Branding {
  companyName: string;
  logoUrl: string | null;
  accentColor: string;
  currency: string;
}

interface BrandingContextValue extends Branding {
  currencySymbol: string;
  setBranding: (b: Partial<Branding>) => void;
  refresh: () => Promise<void>;
}

export function getCurrencySymbol(currency: string): string {
  switch (currency) {
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "INR":
      return "₹";
    case "JPY":
      return "¥";
    case "USD":
    default:
      return "$";
  }
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: Branding;
}) {
  const [branding, setBrandingState] = useState<Branding>(initial);

  const setBranding = useCallback((partial: Partial<Branding>) => {
    setBrandingState((prev) => ({ ...prev, ...partial }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/company");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setBrandingState({
            companyName: json.data.name ?? "Nexus ERP",
            logoUrl: json.data.logoUrl ?? null,
            accentColor: json.data.accentColor ?? "#6366f1",
            currency: json.data.currency ?? "USD",
          });
        }
      }
    } catch {
      // silently fail — branding is non-critical
    }
  }, []);

  const currencySymbol = getCurrencySymbol(branding.currency ?? "USD");

  return (
    <BrandingContext.Provider value={{ ...branding, currencySymbol, setBranding, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return ctx;
}
