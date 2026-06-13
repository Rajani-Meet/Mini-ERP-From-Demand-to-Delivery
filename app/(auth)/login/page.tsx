"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("signup") === "success") {
      setSuccessMsg("Tenant provisioned successfully. Sign in to access your dashboard.");
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (res?.error) {
        throw new Error(res.error || "Failed to sign in.");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      const error = err as Error;
      setErrorMsg(error.message || "Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-lg text-emerald-200 text-sm flex items-start">
          <CheckCircle className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-200 text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Work Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              {...register("email")}
              placeholder="doe@nexus.com"
              className="w-full pl-10 pr-4 py-2.5 bg-[#07080C] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              {...register("password")}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 bg-[#07080C] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-[#07080C] font-semibold text-sm rounded-lg hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Initializing Session...
            </>
          ) : (
            "Authenticate Console"
          )}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#07080C] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Dark Industrial Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#1E293B]/20 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-[#0E111A] border border-[#1E293B] rounded-xl shadow-2xl p-8 z-10 backdrop-blur-md">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-3">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Nexus ERP</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to tenant terminal</p>
        </div>

        <Suspense fallback={<div className="text-center text-sm py-4 text-slate-400">Loading URL params...</div>}>
          <LoginFields />
        </Suspense>

        <div className="mt-6 text-center text-xs text-slate-400">
          First-time deployment?{" "}
          <Link href="/signup" className="text-amber-500 hover:underline font-semibold">
            Deploy New Tenant
          </Link>
        </div>
      </div>
    </main>
  );
}
