import "server-only";

import Stripe from "stripe";
import { env } from "@/lib/env";

export interface StripeCatalogResult {
  stripeProductId: string | null;
  stripePriceId: string | null;
}

function stripeClient() {
  if (!env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is required for paid add-ons.");
  }
  return new Stripe(env.stripeSecretKey);
}

function isMissingStripeResource(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === "resource_missing"
  );
}

export async function ensureStripeCatalog({
  productId,
  title,
  description,
  usdAmountCents,
  existingProductId,
  existingPriceId,
  existingAmountCents
}: {
  productId: string;
  title: string;
  description: string;
  usdAmountCents: number;
  existingProductId?: string | null;
  existingPriceId?: string | null;
  existingAmountCents?: number | null;
}): Promise<StripeCatalogResult> {
  if (usdAmountCents === 0) {
    return {
      stripeProductId: existingProductId ?? null,
      stripePriceId: null
    };
  }

  const stripe = stripeClient();
  let product: Stripe.Product;
  let existingProductIsAvailable = false;

  if (existingProductId) {
    try {
      product = await stripe.products.update(existingProductId, {
        active: true,
        name: title,
        description,
        metadata: { aoupa_product_id: productId }
      });
      existingProductIsAvailable = true;
    } catch (error) {
      if (!isMissingStripeResource(error)) throw error;
      product = await stripe.products.create({
        name: title,
        description,
        metadata: { aoupa_product_id: productId }
      }, {
        idempotencyKey: `aoupa_product_${productId}`
      });
    }
  } else {
    product = await stripe.products.create({
      name: title,
      description,
      metadata: { aoupa_product_id: productId }
    }, {
      idempotencyKey: `aoupa_product_${productId}`
    });
  }

  if (
    existingPriceId
    && existingAmountCents === usdAmountCents
    && existingProductIsAvailable
  ) {
    try {
      const existingPrice = await stripe.prices.retrieve(existingPriceId);
      const linkedProductId = typeof existingPrice.product === "string"
        ? existingPrice.product
        : existingPrice.product.id;
      if (
        linkedProductId === product.id
        && existingPrice.currency.toLowerCase() === "usd"
        && existingPrice.unit_amount === usdAmountCents
      ) {
        if (!existingPrice.active) {
          await stripe.prices.update(existingPrice.id, { active: true });
        }
        return {
          stripeProductId: product.id,
          stripePriceId: existingPrice.id
        };
      }
    } catch (error) {
      if (!isMissingStripeResource(error)) throw error;
    }
  }

  const price = await stripe.prices.create({
    active: true,
    currency: "usd",
    product: product.id,
    unit_amount: usdAmountCents,
    metadata: { aoupa_product_id: productId }
  });

  return {
    stripeProductId: product.id,
    stripePriceId: price.id
  };
}

export async function archivePreviousStripeCatalog({
  stripeProductId,
  stripePriceId,
  archiveProduct
}: {
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  archiveProduct?: boolean;
}) {
  if (!env.stripeSecretKey) return;
  const stripe = stripeClient();
  if (stripePriceId) {
    await stripe.prices.update(stripePriceId, { active: false }).catch(() => undefined);
  }
  if (archiveProduct && stripeProductId) {
    await stripe.products.update(stripeProductId, { active: false }).catch(() => undefined);
  }
}
