import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCurrentProfile } from "@/lib/auth";
import {
  hasTrustedRequestOrigin,
  readJsonBody
} from "@/lib/auth-http";
import { donationCheckoutSchema } from "@/lib/donation-validation";
import { env, getCanonicalSiteUrl, hasStripe } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A Thailand Stripe account settles in THB. Adaptive Pricing then converts this
// THB integration price to the customer's local currency during Checkout.
const STRIPE_INTEGRATION_CURRENCY = "thb" as const;
const DEFAULT_THB_PER_USD = 34;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

function getThbPerUsd(): number {
  const configured = Number(
    process.env.DONATION_THB_PER_USD ?? DEFAULT_THB_PER_USD
  );

  if (!Number.isFinite(configured) || configured <= 0) {
    throw new Error("DONATION_THB_PER_USD must be a positive number.");
  }

  return configured;
}

/**
 * Keeps the existing frontend payload (`usdAmountCents`) working while the
 * Stripe integration price is changed to THB. Because 1 USD = 100 cents and
 * 1 THB = 100 satang, multiplying USD cents by THB-per-USD gives satang.
 *
 * Example at 34 THB/USD: 300 USD cents -> 10,200 satang -> THB 102.00.
 */
function usdCentsToThbSatang(usdAmountCents: number): number {
  const amount = Math.round(usdAmountCents * getThbPerUsd());

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("The converted donation amount is invalid.");
  }

  return amount;
}

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonError("Untrusted request origin.", 403);
  }
  if (!env.paidCheckoutEnabled) {
    return jsonError("Stripe payments are not enabled yet.", 503);
  }
  if (!hasStripe || !env.stripeSecretKey) {
    return jsonError(
      "Stripe and its signed webhook are not fully configured.",
      503
    );
  }

  const parsed = donationCheckoutSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return jsonError("Enter a valid donation of at least USD 3.", 400);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return jsonError("Donation storage is not configured.", 503);

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,title,slug,type,status,is_free")
    .eq("id", parsed.data.productId)
    .maybeSingle();

  if (productError) return jsonError("Could not verify this add-on.", 500);
  if (
    !product ||
    product.type !== "ADDON" ||
    product.status !== "PUBLISHED" ||
    product.is_free !== true
  ) {
    return jsonError(
      "Donations are available only for published free add-ons.",
      409
    );
  }

  let stripeAmountMinor: number;
  try {
    stripeAmountMinor = usdCentsToThbSatang(parsed.data.usdAmountCents);
  } catch (error) {
    console.error("Donation amount conversion failed.", error);
    return jsonError("Donation pricing is not configured correctly.", 503);
  }

  const profile = await getCurrentProfile();
  const donationId = crypto.randomUUID();
  const donationInsert = await supabase.from("donations").insert({
    id: donationId,
    product_id: product.id,
    user_id: profile?.id ?? null,
    customer_email: profile?.email ?? null,

    // Kept for compatibility with the existing migration and frontend.
    // This is the nominal amount selected on the website, not the amount
    // Stripe charges after changing the integration currency to THB.
    usd_amount_cents: parsed.data.usdAmountCents,
    // currency: STRIPE_INTEGRATION_CURRENCY.toUpperCase(),
    currency: "USD",
    status: "pending"
  });

  if (donationInsert.error) {
    console.error("Donation insert failed.", {
      code: donationInsert.error.code,
      message: donationInsert.error.message
    });
    if (
      donationInsert.error.code === "PGRST205" ||
      donationInsert.error.code === "42P01"
    ) {
      return jsonError(
        "Donation database migration is not installed. Apply migration 202607260004_addon_donations.sql.",
        503
      );
    }
    return jsonError("Could not create the donation.", 500);
  }

  try {
    const stripe = new Stripe(env.stripeSecretKey);
    const siteUrl = getCanonicalSiteUrl();
    if (!siteUrl) throw new Error("The canonical site URL is invalid.");

    const metadata: Record<string, string> = {
      kind: "donation",
      donation_id: donationId,
      product_id: product.id,
      reference_currency: "USD",
      reference_amount_minor: String(parsed.data.usdAmountCents),
      integration_currency: STRIPE_INTEGRATION_CURRENCY.toUpperCase(),
      integration_amount_minor: String(stripeAmountMinor),
      ...(profile ? { user_id: profile.id } : {})
    };

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        adaptive_pricing: {
          enabled: true
        },
        submit_type: "donate",
        ...(profile ? { customer_email: profile.email } : {}),
        line_items: [
          {
            price_data: {
              // Must be a settlement currency for Adaptive Pricing.
              currency: STRIPE_INTEGRATION_CURRENCY,
              unit_amount: stripeAmountMinor,
              product_data: {
                name: `Support ${product.title}`,
                description:
                  "A voluntary donation to support this free Aoupa add-on.",
                metadata: {
                  aoupa_product_id: product.id,
                  aoupa_donation_id: donationId
                }
              }
            },
            quantity: 1
          }
        ],
        metadata,
        payment_intent_data: { metadata },
        success_url: `${siteUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/product/${product.slug}?donation=cancelled`
      },
      {
        idempotencyKey: `aoupa_donation_${donationId}`
      }
    );

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL.");
    }

    console.info("Stripe donation Checkout created.", {
      sessionId: session.id,
      livemode: session.livemode,
      integrationCurrency: session.currency,
      integrationAmount: session.amount_total
    });

    const sessionUpdate = await supabase
      .from("donations")
      .update({
        stripe_session_id: session.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", donationId);

    if (sessionUpdate.error) throw sessionUpdate.error;

    return NextResponse.json(
      { url: session.url },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Could not start Stripe Donation Checkout.", error);

    await supabase
      .from("donations")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", donationId);

    return jsonError("Could not start Stripe Donation Checkout.", 502);
  }
}