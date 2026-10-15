import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeMocks = vi.hoisted(() => ({
  productCreate: vi.fn(),
  productUpdate: vi.fn(),
  priceCreate: vi.fn(),
  priceRetrieve: vi.fn(),
  priceUpdate: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { stripeSecretKey: "sk_live_test_only" }
}));
vi.mock("stripe", () => ({
  default: class Stripe {
    products = {
      create: stripeMocks.productCreate,
      update: stripeMocks.productUpdate
    };

    prices = {
      create: stripeMocks.priceCreate,
      retrieve: stripeMocks.priceRetrieve,
      update: stripeMocks.priceUpdate
    };
  }
}));

import { ensureStripeCatalog } from "@/lib/stripe-catalog";

describe("ensureStripeCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recreates catalog objects when stored test IDs are missing in live mode", async () => {
    stripeMocks.productUpdate.mockRejectedValue({ code: "resource_missing" });
    stripeMocks.productCreate.mockResolvedValue({ id: "prod_live" });
    stripeMocks.priceCreate.mockResolvedValue({ id: "price_live" });

    const result = await ensureStripeCatalog({
      productId: "product-id",
      title: "Live add-on",
      description: "Description",
      usdAmountCents: 199,
      existingProductId: "prod_test",
      existingPriceId: "price_test",
      existingAmountCents: 199
    });

    expect(result).toEqual({
      stripeProductId: "prod_live",
      stripePriceId: "price_live"
    });
    expect(stripeMocks.priceRetrieve).not.toHaveBeenCalled();
  });

  it("reuses a valid catalog price in the connected Stripe mode", async () => {
    stripeMocks.productUpdate.mockResolvedValue({ id: "prod_live" });
    stripeMocks.priceRetrieve.mockResolvedValue({
      id: "price_live",
      active: true,
      currency: "usd",
      product: "prod_live",
      unit_amount: 199
    });

    const result = await ensureStripeCatalog({
      productId: "product-id",
      title: "Live add-on",
      description: "Description",
      usdAmountCents: 199,
      existingProductId: "prod_live",
      existingPriceId: "price_live",
      existingAmountCents: 199
    });

    expect(result.stripePriceId).toBe("price_live");
    expect(stripeMocks.priceCreate).not.toHaveBeenCalled();
  });
});
