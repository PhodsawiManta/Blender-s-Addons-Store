"use client";

import { LogOut, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { getSafeRedirectPath } from "@/lib/auth-redirect";

export function SignOutButton({
  className = "button-secondary",
  label = "Sign out",
  redirectTo = "/"
}: {
  className?: string;
  label?: string;
  redirectTo?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) throw new Error("Sign out failed.");
      window.location.replace(getSafeRedirectPath(redirectTo, "/"));
    } catch {
      setError("Unable to sign out. Please try again.");
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button className={className} disabled={loading} type="button" onClick={signOut}>
        {loading ? <LoaderCircle className="animate-spin" size={15} /> : <LogOut size={15} />}
        {loading ? "Signing out..." : label}
      </button>
      {error && <span className="text-[0.62rem] text-red-300" role="alert">{error}</span>}
    </span>
  );
}
