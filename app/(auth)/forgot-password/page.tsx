"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, Mail, Loader2, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        setErrorMsg(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07080C] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-amber-500/8 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-slate-900/30 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0E111A] border border-[#1E293B] rounded-2xl shadow-2xl p-8 z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Nexus ERP</h1>
          <p className="text-sm text-slate-400 mt-1">Password Recovery</p>
        </div>

        {submitted ? (
          /* ── Success State ── */
          <div className="text-center space-y-5">
            <div className="flex justify-center">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 mb-2">Check your inbox</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                If an account exists for{" "}
                <span className="text-amber-400 font-mono font-semibold">{email}</span>, we&apos;ve
                sent a password reset link. It expires in <strong className="text-slate-200">1 hour</strong>.
              </p>
            </div>
            <div className="p-3 bg-[#07080C] border border-[#1E293B] rounded-xl text-xs text-slate-400 text-left space-y-1.5">
              <p className="font-semibold text-slate-300">Didn&apos;t receive it?</p>
              <p>• Check your spam/junk folder</p>
              <p>• Make sure the email is correct</p>
              <p>• Wait a minute and try again</p>
            </div>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-2.5 border border-[#1E293B] rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        ) : (
          /* ── Form State ── */
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-100 mb-1">Forgot your password?</h2>
              <p className="text-sm text-slate-400">
                Enter your work email and we&apos;ll send you a secure reset link.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-sm flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 bg-[#07080C] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-slate-600 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-send-reset"
                disabled={isLoading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-[#07080C] font-bold text-sm rounded-xl hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  "Send Reset Link →"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
