"use client";

import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSafeRedirectPath } from "@/lib/auth-redirect";

type Mode = "signin" | "signup";
type Message = { kind: "error" | "success"; text: string } | null;

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.19-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.42l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.88A6.01 6.01 0 0 1 6.08 12c0-.65.11-1.29.32-1.88V7.5H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.5l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.5l3.35 2.62C7.19 7.76 9.4 6 12 6Z" />
    </svg>
  );
}

export function AuthForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(() => {
    const error = searchParams.get("error");
    return error ? { kind: "error", text: error } : null;
  });
  const next = getSafeRedirectPath(searchParams.get("next"));
  const googleSignInUrl = `/api/auth/google?next=${encodeURIComponent(next)}`;
  const forgotPasswordUrl = `/auth/forgot-password?next=${encodeURIComponent(next)}`;

  function selectMode(selected: Mode) {
    setMode(selected);
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          ...(mode === "signup" ? { next } : {})
        })
      });
      const data = await response.json() as {
        ok?: boolean;
        requiresEmailConfirmation?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setMessage({ kind: "error", text: data.error ?? "Account access failed. Please try again." });
        return;
      }

      if (mode === "signup" && data.requiresEmailConfirmation) {
        setMessage({
          kind: "success",
          text: "Check your inbox and confirm your email address to finish creating your account."
        });
        return;
      }

      window.location.assign(next);
    } catch {
      setMessage({ kind: "error", text: "Account access failed. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex rounded-lg border border-line bg-panel p-1">
        {(["signin", "signup"] as const).map((item) => (
          <button
            className={`flex-1 rounded-md px-3 py-2 text-xs font-bold transition ${mode === item ? "bg-zinc-700 text-white" : "text-zinc-500"}`}
            key={item}
            onClick={() => selectMode(item)}
            type="button"
          >
            {item === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <a className="button-secondary w-full bg-white !text-zinc-900 hover:bg-zinc-100" href={googleSignInUrl}>
        <GoogleMark />
        Continue with Google
      </a>
      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-zinc-600">or use email</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label>
          <span className="mb-2 block text-[0.68rem] font-bold uppercase tracking-wider text-zinc-500">Email address</span>
          <span className="relative block">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
            <input className="field !pl-10" autoComplete="email" type="email" name="email" placeholder="you@example.com" required />
          </span>
        </label>
        <label>
          <span className="mb-2 block text-[0.68rem] font-bold uppercase tracking-wider text-zinc-500">Password</span>
          <span className="relative block">
            <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
            <input
              className="field !px-10"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="8 characters minimum"
              minLength={8}
              maxLength={128}
              required
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </span>
        </label>
        {message && (
          <p
            aria-live="polite"
            className={`rounded-md border px-3 py-2 text-xs ${
              message.kind === "success"
                ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300"
                : "border-red-500/20 bg-red-500/[0.06] text-red-300"
            }`}
          >
            {message.text}
          </p>
        )}
        <button className="button-primary mt-2 w-full" disabled={loading} type="submit">
          {loading && <LoaderCircle className="animate-spin" size={16} />}
          {loading ? "Please wait..." : mode === "signin" ? "Sign in to Aoupa" : "Create my account"}
        </button>
      </form>
      <div className="mt-5 flex items-center justify-between text-[0.66rem] text-zinc-600">
        <Link className="hover:text-zinc-300" href={forgotPasswordUrl}>Forgot password?</Link>
        <span>Secure account access</span>
      </div>
    </div>
  );
}
