import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import {
  CheckCircle2,
  Clock3,
  HandHeart,
  TriangleAlert
} from "lucide-react";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DonationStatus = "pending" | "paid" | "failed";

type CheckoutSessionWithPresentment = Stripe.Checkout.Session & {
  presentment_details?: {
    presentment_amount: number;
    presentment_currency: string;
  } | null;
};

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF"
]);

function isStripeSessionId(value: string | undefined): value is string {
  return Boolean(
    value
      && /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(value)
      && value.length <= 255
  );
}

function formatMoney(amountMinor: number, currency: string): string {
  const normalizedCurrency = currency.toUpperCase();
  const divisor = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 1 : 100;

  try {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: normalizedCurrency
    }).format(amountMinor / divisor);
  } catch {
    return `${normalizedCurrency} ${(amountMinor / divisor).toLocaleString("th-TH")}`;
  }
}

export default async function DonationSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!isStripeSessionId(sessionId)) redirect("/addons");

  const supabase = createSupabaseAdminClient();
  if (!supabase) redirect("/addons");

  const { data: donation } = await supabase
    .from("donations")
    .select("id,product_id,usd_amount_cents,currency,status")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (!donation) redirect("/addons");

  let status = donation.status as DonationStatus;
  let displayedAmountMinor: number | null = null;
  let displayedCurrency: string | null = null;

  if (env.stripeSecretKey) {
    try {
      const stripe = new Stripe(env.stripeSecretKey);
      const session = await stripe.checkout.sessions.retrieve(
        sessionId
      ) as CheckoutSessionWithPresentment;

      displayedAmountMinor =
        session.presentment_details?.presentment_amount
        ?? session.amount_total
        ?? null;

      displayedCurrency =
        session.presentment_details?.presentment_currency
        ?? session.currency
        ?? null;

      const metadataMatches =
        session.metadata?.kind === "donation"
        && session.metadata?.donation_id === donation.id
        && session.metadata?.product_id === donation.product_id;

      if (
        status === "pending"
        && session.payment_status === "paid"
        && metadataMatches
      ) {
        const fulfillment = await supabase.rpc("fulfill_donation", {
          target_donation_id: donation.id,
          target_stripe_session_id: session.id,
          target_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          // amount_total remains in the integration currency (THB in the
          // updated Checkout route), which is what the fulfillment RPC should store.
          target_amount_total: session.amount_total ?? 0,
          target_customer_email: session.customer_details?.email ?? null
        });

        if (!fulfillment.error) status = "paid";
      }
    } catch (error) {
      console.error("Could not verify Stripe donation session.", error);
      // The signed Stripe webhook remains the durable fulfillment path.
    }
  }

  const { data: product } = await supabase
    .from("products")
    .select("title,slug")
    .eq("id", donation.product_id)
    .maybeSingle();

  const paid = status === "paid";
  const pending = status === "pending";
  const Icon = paid ? CheckCircle2 : pending ? Clock3 : TriangleAlert;

  const heading = paid
    ? "Thank you for your support."
    : pending
      ? "Your donation is processing."
      : "The donation was not completed.";

  const receivedAmount =
    displayedAmountMinor !== null && displayedCurrency
      ? formatMoney(displayedAmountMinor, displayedCurrency)
      : null;

  const description = paid
    ? receivedAmount
      ? `${receivedAmount} was received for ${product?.title ?? "this free add-on"}.`
      : `Your donation was received for ${product?.title ?? "this free add-on"}.`
    : pending
      ? "Stripe is still confirming the payment. This page can be refreshed shortly."
      : "No support payment was recorded. You can return to the add-on and try again.";

  return (
    <section className="shell grid min-h-[680px] place-items-center py-16">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-panel p-7 text-center sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-forge/25 bg-forge/10 text-forge">
          <Icon size={31} />
        </div>

        <p className="eyebrow mt-7">Add-on donation</p>
        <h1 className="section-title mt-4">{heading}</h1>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-zinc-500">
          {description}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            className="button-primary"
            href={product?.slug ? `/product/${product.slug}` : "/addons"}
          >
            <HandHeart size={15} /> Return to add-on
          </Link>
          <Link className="button-secondary" href="/addons">
            Explore add-ons
          </Link>
        </div>
      </div>
    </section>
  );
}
