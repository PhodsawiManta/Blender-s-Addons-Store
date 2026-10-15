import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  ReceiptText,
  TriangleAlert
} from "lucide-react";
import { ClearCartOnSuccess } from "@/components/clear-cart-on-success";
import { getCurrentProfile } from "@/lib/auth";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type OrderStatus = "pending" | "paid" | "failed";

function isStripeSessionId(value: string | undefined): value is string {
  return Boolean(value && /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(value) && value.length <= 255);
}

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!isStripeSessionId(sessionId)) redirect("/addons");

  const profile = await getCurrentProfile();
  if (!profile) {
    const next = `/checkout/success?session_id=${encodeURIComponent(sessionId)}`;
    redirect(`/auth?next=${encodeURIComponent(next)}`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: order } = supabase
    ? await supabase
        .from("orders")
        .select("id,status")
        .eq("stripe_session_id", sessionId)
        .eq("user_id", profile.id)
        .maybeSingle()
    : { data: null };

  if (!order) redirect("/library");

  let status = order.status as OrderStatus;
  if (status === "pending" && env.stripeSecretKey && supabase) {
    try {
      const stripe = new Stripe(env.stripeSecretKey);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (
        session.payment_status === "paid"
        && session.currency?.toUpperCase() === "USD"
        && session.metadata?.order_id === order.id
        && session.metadata?.user_id === profile.id
      ) {
        const fulfillment = await supabase.rpc("fulfill_paid_order", {
          target_order_id: order.id,
          target_stripe_session_id: session.id,
          target_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          target_amount_total: session.amount_total ?? 0,
          target_customer_email: session.customer_details?.email ?? null
        });
        if (!fulfillment.error) status = "paid";
      }
    } catch {
      // The signed Stripe webhook remains the durable fulfillment path.
    }
  }

  const paid = status === "paid";
  const pending = status === "pending";
  const Icon = paid ? CheckCircle2 : pending ? Clock3 : TriangleAlert;

  const eyebrow = paid
    ? "Payment confirmed"
    : pending
      ? "Payment processing"
      : "Payment not completed";
  const heading = paid
    ? "Your add-ons are ready."
    : pending
      ? "We are confirming your payment."
      : "This order needs attention.";
  const description = paid
    ? "The purchased add-ons are now available in your library."
    : pending
      ? "Stripe is still reporting the result. Access appears in your library after the signed webhook is verified."
      : "The payment could not be completed. You can return to the catalog and try again.";

  return (
    <section className="shell grid min-h-[680px] place-items-center py-16">
      {paid && <ClearCartOnSuccess />}
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-panel p-7 text-center sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-forge/25 bg-forge/10 text-forge">
          <Icon size={31} />
        </div>
        <p className="eyebrow mt-7">{eyebrow}</p>
        <h1 className="section-title mt-4">{heading}</h1>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-zinc-500">{description}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link className="button-primary" href="/library">
            <Download size={15} /> Open my library
          </Link>
          <Link className="button-secondary" href="/addons">
            <ArrowRight size={15} /> Browse add-ons
          </Link>
        </div>
        {paid && (
          <p className="mt-6 flex items-center justify-center gap-2 text-[0.62rem] text-zinc-600">
            <ReceiptText size={13} /> Receipt details use your verified account email.
          </p>
        )}
      </div>
    </section>
  );
}
