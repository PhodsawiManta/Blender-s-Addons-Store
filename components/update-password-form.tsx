"use client";

import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSafeRedirectPath } from "@/lib/auth-redirect";

export function UpdatePasswordForm() {
  const searchParams = useSearchParams();
  const next = getSafeRedirectPath(searchParams.get("next"));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password !== confirmation) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/password/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to update your password.");
        return;
      }
      window.location.assign(next);
    } catch {
      setError("Unable to update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-xl border border-line bg-panel p-5" onSubmit={handleSubmit}>
      {[
        ["password", "New password"],
        ["confirmation", "Confirm new password"]
      ].map(([name, label]) => (
        <label key={name}>
          <span className="mb-2 block text-[0.68rem] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
          <span className="relative block">
            <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
            <input
              className="field !px-10"
              autoComplete="new-password"
              type={showPassword ? "text" : "password"}
              name={name}
              minLength={8}
              maxLength={128}
              required
            />
          </span>
        </label>
      ))}
      <button
        className="text-left text-xs font-semibold text-zinc-500 hover:text-white"
        type="button"
        onClick={() => setShowPassword((value) => !value)}
      >
        {showPassword ? <EyeOff className="mr-1 inline" size={14} /> : <Eye className="mr-1 inline" size={14} />}
        {showPassword ? "Hide passwords" : "Show passwords"}
      </button>
      {error && <p className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300" aria-live="polite">{error}</p>}
      <button className="button-primary w-full" disabled={loading} type="submit">
        {loading && <LoaderCircle className="animate-spin" size={16} />}
        {loading ? "Updating..." : "Update password"}
      </button>
      <Link className="text-center text-xs font-semibold text-zinc-500 hover:text-white" href="/auth/forgot-password">
        Request another recovery link
      </Link>
    </form>
  );
}
