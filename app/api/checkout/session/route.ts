import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { env, getCanonicalSiteUrl, hasStripe } from "@/lib/env";
import { hasTrustedRequestOrigin } from "@/lib/auth-http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  items: z
    .array(z.object({
      productId: z.uuid(),
      quantity: z.literal(1)
    }))
    .min(1)
    .max(20)
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      "Duplicate products are not allowed."
    )
});

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonError("Untrusted request origin.", 403);
  }
  if (!env.paidCheckoutEnabled) {
    return jsonError("Paid checkout is not enabled yet.", 503);
  }
  const stripeSecretKey = env.stripeSecretKey;
  if (!hasStripe || !stripeSecretKey) {
    return jsonError("Stripe checkout and its signed webhook are not fully configured.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid cart.", 400);

  const profile = await getCurrentProfile();
  if (!profile) return jsonError("Sign in before checkout.", 401);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return jsonError("Commerce database is not configured.", 503);

  const ids = parsed.data.items.map((item) => item.productId);
  const [
    { data: productRows, error: productError },
    { data: priceRows, error: priceError }
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id,title,status,is_free")
      .in("id", ids),
    supabase
      .from("product_prices")
      .select("product_id,usd_amount_cents,stripe_price_id,active")
      .in("product_id", ids)
      .eq("active", true)
  ]);
  if (productError || priceError) {
    return jsonError("Could not verify the cart.", 500);
  }

  const products = productRows ?? [];
  const prices = priceRows ?? [];
  const selectedPrices = ids.map((id) =>
    prices.filter((price) => price.product_id === id)
  );
  const valid = ids.every((id) => {
    const product = products.find((item) => item.id === id);
    const matches = prices.filter((item) => item.product_id === id);
    const price = matches[0];
    return product?.status === "PUBLISHED"
      && !product.is_free
      && matches.length === 1
      && Boolean(price?.stripe_price_id)
      && Number(price?.usd_amount_cents) > 0;
  });
  if (!valid) return jsonError("One or more products are unavailable for checkout.", 409);

  const orderId = crypto.randomUUID();
  const amountTotal = selectedPrices.reduce(
    (sum, matches) => sum + Number(matches[0].usd_amount_cents),
    0
  );
  const { error: orderError } = await supabase.from("orders").insert({
    id: orderId,
    user_id: profile.id,
    customer_email: profile.email,
    amount_total: amountTotal,
    currency: "USD",
    status: "pending"
  });
  if (orderError) return jsonError("Could not create the order.", 500);

  const { error: itemError } = await supabase.from("order_items").insert(
    ids.map((productId, index) => ({
      order_id: orderId,
      product_id: productId,
      quantity: 1,
      unit_amount_cents: Number(selectedPrices[index][0].usd_amount_cents)
    }))
  );
  if (itemError) {
    await supabase.from("orders").delete().eq("id", orderId);
    return jsonError("Could not create the order.", 500);
  }

  try {
    const stripe = new Stripe(stripeSecretKey);
    const siteUrl = getCanonicalSiteUrl();
    if (!siteUrl) throw new Error("The canonical site URL is invalid.");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      adaptive_pricing: {
        enabled: true,
      },
      customer_email: profile.email,
      line_items: ids.map((_, index) => ({
        price: selectedPrices[index][0].stripe_price_id!,
        quantity: 1
      })),
      metadata: {
        order_id: orderId,
        user_id: profile.id
      },
      payment_intent_data: {
        metadata: { order_id: orderId, user_id: profile.id }
      },
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancelled`
    }, {
      idempotencyKey: `aoupa_checkout_${orderId}`
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    await supabase
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderId);
    return NextResponse.json(
      { url: session.url },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
    return jsonError("Could not start Stripe Checkout.", 502);
  }
}
