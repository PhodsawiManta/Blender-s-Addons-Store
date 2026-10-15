"use client";

import { LoaderCircle, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSafeRedirectPath } from "@/lib/auth-redirect";

export function PasswordResetRequestForm() {
  const searchParams = useSearchParams();
  const next = getSafeRedirectPath(searchParams.get("next"));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), next })
      });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to request a recovery link.");
        return;
      }
      setMessage(data.message ?? "If that account exists, a recovery link is on its way.");
    } catch {
      setError("Unable to request a recovery link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-xl border border-line bg-panel p-5" onSubmit={handleSubmit}>
      <label>
        <span className="mb-2 block text-[0.68rem] font-bold uppercase tracking-wider text-zinc-500">Email address</span>
        <span className="relative block">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
          <input className="field !pl-10" autoComplete="email" type="email" name="email" placeholder="you@example.com" required />
        </span>
      </label>
      {message && <p className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-300" aria-live="polite">{message}</p>}
      {error && <p className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300" aria-live="polite">{error}</p>}
      <button className="button-primary w-full" disabled={loading} type="submit">
        {loading && <LoaderCircle className="animate-spin" size={16} />}
        {loading ? "Sending..." : "Send recovery link"}
      </button>
      <Link className="text-center text-xs font-semibold text-zinc-500 hover:text-white" href={`/auth?next=${encodeURIComponent(next)}`}>
        Back to sign in
      </Link>
    </form>
  );
}
