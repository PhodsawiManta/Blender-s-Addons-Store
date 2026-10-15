import type { Metadata } from "next";
import { Suspense } from "react";
import { Box, CheckCircle2 } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false }
};

export default function AuthPage() {
  return (
    <section className="shell grid min-h-[680px] items-center gap-10 py-12 lg:grid-cols-2">
      <div className="hidden min-h-[560px] flex-col justify-between overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-[#32170b] to-[#0b0c0e] p-9 lg:flex">
        <div>
          <p className="eyebrow">Your Aoupa account</p>
          <h1 className="mt-5 text-5xl font-bold leading-[.95] tracking-[-.06em]">Your tools.<br /><span className="text-white/35">Always ready.</span></h1>
          <div className="mt-8 grid gap-3">
            {["Download every add-on you own", "Get updates and new versions", "Keep your account secure"].map((item) => (
              <p className="flex items-center gap-2 text-xs text-zinc-400" key={item}><CheckCircle2 size={14} className="text-forge" />{item}</p>
            ))}
          </div>
        </div>
        <div className="relative mx-auto h-44 w-44 animate-float">
          <div className="absolute inset-0 rotate-[22deg] rounded-[32%] border border-forge-soft/40 bg-forge/75 shadow-glow" />
          <Box className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-ink" size={45} />
        </div>
      </div>
      <div className="flex justify-center">
        <div className="w-full max-w-md">
          <p className="eyebrow">Welcome to Aoupa</p>
          <h1 className="section-title mt-4">Your account.</h1>
          <p className="mb-8 mt-4 text-sm text-zinc-500">Sign in to access your add-ons, downloads, and updates.</p>
          <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-panel" />}>
            <AuthForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
