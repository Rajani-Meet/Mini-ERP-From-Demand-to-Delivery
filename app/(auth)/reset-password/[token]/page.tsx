"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield, Lock, Eye, EyeOff, Loader2, CheckCircle,
  AlertTriangle, ArrowLeft, XCircle,
} from "lucide-react";

type PageState = "validating" | "valid" | "invalid" | "success";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter", ok: /[a-z]/.test(password) },
    { label: "Number", ok: /[0-9]/.test(password) },
    { label: "Special character", ok: /[^a-zA-Z0-9]/.test(password) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const strength = passed <= 2 ? "weak" : passed <= 4 ? "medium" : "strong";

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i === 1 && passed >= 1 ? (strength === "weak" ? "bg-red-500" : strength === "medium" ? "bg-amber-500" : "bg-emerald-500") :
              i === 2 && passed >= 3 ? (strength === "medium" ? "bg-amber-500" : "bg-emerald-500") :
              i === 3 && passed === 5 ? "bg-emerald-500" : "bg-[#1E293B]"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map((c) => (
          <div key={c.label} className={`flex items-center gap-1.5 text-[10px] font-mono ${c.ok ? "text-emerald-400" : "text-slate-500"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${c.ok ? "bg-emerald-400" : "bg-slate-700"}`} />
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [pageState, setPageState] = useState<PageState>("validating");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) { setPageState("invalid"); return; }

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => setPageState(data.valid ? "valid" : "invalid"))
      .catch(() => setPageState("invalid"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setPageState("success");
      } else {
        setErrorMsg(data.message || "Failed to reset password.");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07080C] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-amber-500/8 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-slate-900/30 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0E111A] border border-[#1E293B] rounded-2xl shadow-2xl p-8 z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Nexus ERP</h1>
          <p className="text-sm text-slate-400 mt-1">Password Reset</p>
        </div>

        {/* ── Validating ── */}
        {pageState === "validating" && (
          <div className="text-center py-8 space-y-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-sm text-slate-400">Validating your reset link…</p>
          </div>
        )}

        {/* ── Invalid / Expired ── */}
        {pageState === "invalid" && (
          <div className="text-center space-y-5">
            <div className="flex justify-center">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 mb-2">Link Invalid or Expired</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                This password reset link is no longer valid. Reset links expire after <strong className="text-slate-200">1 hour</strong>.
              </p>
            </div>
            <Link
              href="/forgot-password"
              className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-600 text-[#07080C] font-bold text-sm rounded-xl transition-all active:scale-95"
            >
              Request New Reset Link →
            </Link>
            <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </Link>
          </div>
        )}

        {/* ── Success ── */}
        {pageState === "success" && (
          <div className="text-center space-y-5">
            <div className="flex justify-center">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 mb-2">Password Reset!</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-600 text-[#07080C] font-bold text-sm rounded-xl transition-all active:scale-95"
            >
              Sign In Now →
            </button>
          </div>
        )}

        {/* ── Valid — Reset Form ── */}
        {pageState === "valid" && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-100 mb-1">Set New Password</h2>
              <p className="text-sm text-slate-400">Choose a strong password for your account.</p>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-sm flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#07080C] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword && <PasswordStrength password={newPassword} />}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-10 py-2.5 bg-[#07080C] border rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-1 transition ${
                      confirmPassword && confirmPassword !== newPassword
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                        : "border-[#1E293B] focus:border-amber-500 focus:ring-amber-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match.</p>
                )}
              </div>

              <button
                type="submit"
                id="btn-reset-password"
                disabled={isLoading || !newPassword || !confirmPassword}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-[#07080C] font-bold text-sm rounded-xl hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none mt-2"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Resetting Password…</>
                ) : (
                  "Reset Password →"
                )}
              </button>
            </form>

            <div className="mt-5 text-center">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
