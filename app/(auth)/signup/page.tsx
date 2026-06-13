"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Building2, User, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

const signupSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  name: z.string().min(2, "Your name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine((val) => /[A-Z]/.test(val), "Must contain an uppercase letter")
    .refine((val) => /[a-z]/.test(val), "Must contain a lowercase letter")
    .refine((val) => /[0-9]/.test(val), "Must contain a number")
    .refine((val) => /[^a-zA-Z0-9]/.test(val), "Must contain a special character"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyName: "",
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Something went wrong during sign up.");
      }

      // Automatically redirect to login page upon successful signup
      router.push("/login?signup=success");
    } catch (err) {
      const error = err as Error;
      setErrorMsg(error.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

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
          <p className="text-sm text-slate-400 mt-1">Establish your corporate tenant instance</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Company Name
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                {...register("companyName")}
                placeholder="Industrial Solutions Inc."
                className="w-full pl-10 pr-4 py-2.5 bg-[#07080C] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
              />
            </div>
            {errors.companyName && (
              <p className="text-xs text-red-400 mt-1">{errors.companyName.message}</p>
            )}
          </div>

          {/* User Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                {...register("name")}
                placeholder="John Doe"
                className="w-full pl-10 pr-4 py-2.5 bg-[#07080C] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
              />
            </div>
            {errors.name && (
              <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>
            )}
          </div>

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
                Provisioning Tenant...
              </>
            ) : (
              "Deploy Tenant Instance"
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Already registered?{" "}
          <Link href="/login" className="text-amber-500 hover:underline font-semibold">
            Access Terminal
          </Link>
        </div>
      </div>
    </main>
  );
}
