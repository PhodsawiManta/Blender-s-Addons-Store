import { z } from "zod";
import {
  MAX_DONATION_USD_CENTS,
  MIN_DONATION_USD_CENTS
} from "@/lib/donation-constants";

export {
  MAX_DONATION_USD_CENTS,
  MIN_DONATION_USD_CENTS
} from "@/lib/donation-constants";

export const donationCheckoutSchema = z.object({
  productId: z.uuid(),
  usdAmountCents: z
    .number()
    .int()
    .min(MIN_DONATION_USD_CENTS)
    .max(MAX_DONATION_USD_CENTS)
});
