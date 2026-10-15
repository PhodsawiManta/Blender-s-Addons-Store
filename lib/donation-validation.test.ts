import { describe, expect, it } from "vitest";
import {
  donationCheckoutSchema,
  MIN_DONATION_USD_CENTS
} from "@/lib/donation-validation";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

describe("donation checkout validation", () => {
  it("accepts a donation at the USD minimum", () => {
    expect(donationCheckoutSchema.safeParse({
      productId: PRODUCT_ID,
      usdAmountCents: MIN_DONATION_USD_CENTS
    }).success).toBe(true);
  });

  it("rejects donations below USD 3 and fractional cents", () => {
    expect(donationCheckoutSchema.safeParse({
      productId: PRODUCT_ID,
      usdAmountCents: 299
    }).success).toBe(false);
    expect(donationCheckoutSchema.safeParse({
      productId: PRODUCT_ID,
      usdAmountCents: 300.5
    }).success).toBe(false);
  });
});
