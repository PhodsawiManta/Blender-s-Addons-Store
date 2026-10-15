"use client";

import { HandHeart, LoaderCircle } from "lucide-react";
import { useState } from "react";
import {
  MAX_DONATION_USD_CENTS,
  MIN_DONATION_USD_CENTS
} from "@/lib/donation-constants";

const PRESETS = [3, 5, 10, 20];

export function DonationBox({
  productId,
  enabled
}: {
  productId: string;
  enabled: boolean;
}) {
  const [amount, setAmount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function donate() {
    const usdAmountCents = Math.round(amount * 100);
    if (
      !Number.isFinite(amount)
      || usdAmountCents < MIN_DONATION_USD_CENTS
      || usdAmountCents > MAX_DONATION_USD_CENTS
    ) {
      setError("Enter a donation of at least USD 3.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/donations/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, usdAmountCents })
      });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Unable to start donation checkout.");
      }
      window.location.assign(data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start donation checkout.");
      setLoading(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-forge/20 bg-forge/[0.035] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-forge/10 text-forge">
          <HandHeart size={17} />
        </span>
        <div>
          <p className="text-xs font-bold">Support this free add-on</p>
          <p className="mt-1 text-[0.62rem] leading-4 text-zinc-600">
            Optional one-time donation. Minimum USD 3.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {PRESETS.map((preset) => (
          <button
            className={`button-secondary !min-h-9 !px-2 text-xs ${amount === preset ? "!border-forge/50 !text-forge" : ""}`}
            key={preset}
            onClick={() => setAmount(preset)}
            type="button"
          >
            ${preset}
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="sr-only">Custom donation amount in USD</span>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-600">$</span>
          <input
            className="field !min-h-10 !pl-7"
            max={MAX_DONATION_USD_CENTS / 100}
            min={MIN_DONATION_USD_CENTS / 100}
            onChange={(event) => setAmount(Number(event.target.value))}
            step="0.01"
            type="number"
            value={Number.isFinite(amount) ? amount : ""}
          />
        </div>
      </label>
      <button
        className="button-primary mt-3 w-full"
        disabled={!enabled || loading}
        onClick={donate}
        type="button"
      >
        {loading ? <LoaderCircle className="animate-spin" size={16} /> : <HandHeart size={16} />}
        {loading ? "Opening Stripe..." : enabled ? `Donate $${amount.toFixed(2)}` : "Donations unavailable"}
      </button>
      {error && (
        <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
