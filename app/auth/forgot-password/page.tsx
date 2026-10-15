import type { Metadata } from "next";
import { Suspense } from "react";
import { PasswordResetRequestForm } from "@/components/password-reset-request-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false }
};

export default function ForgotPasswordPage() {
  return (
    <section className="shell flex min-h-[680px] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <p className="eyebrow">Aoupa account recovery</p>
        <h1 className="section-title mt-4">Reset your password.</h1>
        <p className="mb-8 mt-4 text-sm leading-6 text-zinc-500">Enter your account email and we will send a secure recovery link.</p>
        <Suspense fallback={<div className="h-60 animate-pulse rounded-xl bg-panel" />}>
          <PasswordResetRequestForm />
        </Suspense>
      </div>
    </section>
  );
}
