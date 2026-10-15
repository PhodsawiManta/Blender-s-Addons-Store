import type { Metadata } from "next";
import { Suspense } from "react";
import { UpdatePasswordForm } from "@/components/update-password-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false }
};

export default function UpdatePasswordPage() {
  return (
    <section className="shell flex min-h-[680px] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <p className="eyebrow">Aoupa account recovery</p>
        <h1 className="section-title mt-4">Choose a new password.</h1>
        <p className="mb-8 mt-4 text-sm leading-6 text-zinc-500">Use at least 8 characters and keep this password unique to Aoupa.</p>
        <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-panel" />}>
          <UpdatePasswordForm />
        </Suspense>
      </div>
    </section>
  );
}
