import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!env.stripeSecretKey || !env.stripeWebhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const stripe = new Stripe(env.stripeSecretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      env.stripeWebhookSecret
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  const { data: existing } = await supabase
    .from("webhook_events")
    .select("status")
    .eq("provider_event_id", event.id)
    .maybeSingle();
  if (existing?.status === "processed") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const { error: eventError } = await supabase.from("webhook_events").upsert({
    provider_event_id: event.id,
    provider: "stripe",
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    status: "processing",
    error_message: null,
    processed_at: null
  }, { onConflict: "provider_event_id" });
  if (eventError) {
    return NextResponse.json({ error: "Could not record webhook event." }, { status: 500 });
  }

  try {
    if (
      event.type === "checkout.session.completed"
      || event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        if (session.currency?.toUpperCase() !== "USD") {
          throw new Error("Invalid paid Checkout Session currency.");
        }
        if (session.metadata?.kind === "donation") {
          const donationId = session.metadata?.donation_id;
          if (!donationId || !session.metadata?.product_id) {
            throw new Error("Invalid Donation Checkout Session metadata.");
          }
          const { error } = await supabase.rpc("fulfill_donation", {
            target_donation_id: donationId,
            target_stripe_session_id: session.id,
            target_payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
            target_amount_total: session.amount_total ?? 0,
            target_customer_email: session.customer_details?.email ?? null
          });
          if (error) throw error;
        } else {
          const orderId = session.metadata?.order_id;
          if (!orderId) {
            throw new Error("Invalid paid Checkout Session metadata.");
          }
          const { error } = await supabase.rpc("fulfill_paid_order", {
            target_order_id: orderId,
            target_stripe_session_id: session.id,
            target_payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
            target_amount_total: session.amount_total ?? 0,
            target_customer_email: session.customer_details?.email ?? null
          });
          if (error) throw error;
        }
      }
    }

    if (
      event.type === "checkout.session.expired"
      || event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object;
      const recordId = session.metadata?.kind === "donation"
        ? session.metadata?.donation_id
        : session.metadata?.order_id;
      if (recordId) {
        const { error } = await supabase
          .from(session.metadata?.kind === "donation" ? "donations" : "orders")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", recordId)
          .eq("status", "pending");
        if (error) throw error;
      }
    }

    const { error: processedError } = await supabase
      .from("webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        error_message: null
      })
      .eq("provider_event_id", event.id);
    if (processedError) throw processedError;
  } catch (error) {
    await supabase
      .from("webhook_events")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message.slice(0, 500) : "Processing failed"
      })
      .eq("provider_event_id", event.id);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
