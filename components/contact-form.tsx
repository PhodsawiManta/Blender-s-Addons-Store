"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          topic: form.get("topic"),
          message: form.get("message"),
          company: form.get("company")
        })
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not send your message.");
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not send your message.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="grid min-h-80 place-items-center rounded-xl border border-line bg-panel p-8 text-center">
        <div>
          <CheckCircle2 className="mx-auto text-forge" size={34} />
          <h2 className="mt-4 text-xl font-bold">Message received.</h2>
          <p className="mt-2 text-sm text-zinc-500">We&apos;ll get back to you within two business days.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="grid gap-4 rounded-xl border border-line bg-panel p-6" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Name</span>
          <input className="field" autoComplete="name" name="name" minLength={2} maxLength={100} required />
        </label>
        <label>
          <span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Email</span>
          <input className="field" autoComplete="email" name="email" type="email" maxLength={320} required />
        </label>
      </div>
      <label>
        <span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Topic</span>
        <select className="field" name="topic">
          <option value="product-support">Product support</option>
          <option value="order-payment">Order or payment</option>
          <option value="general">General</option>
          <option value="partnership">Partnership</option>
        </select>
      </label>
      <label>
        <span className="mb-2 block text-[0.62rem] font-bold uppercase tracking-wider text-zinc-500">Message</span>
        <textarea className="field min-h-40 resize-y" name="message" minLength={10} maxLength={5000} required />
      </label>
      <label className="hidden" aria-hidden="true">
        Company
        <input name="company" tabIndex={-1} autoComplete="off" />
      </label>
      {error && <p className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">{error}</p>}
      <button className="button-primary w-fit" disabled={loading} type="submit">
        {loading ? <LoaderCircle className="animate-spin" size={14} /> : <Send size={14} />}
        {loading ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
