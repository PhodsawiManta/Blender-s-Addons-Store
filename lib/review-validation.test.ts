import { describe, expect, it } from "vitest";
import { productReviewSchema } from "@/lib/review-validation";

describe("productReviewSchema", () => {
  it("accepts a valid star rating and trimmed comment", () => {
    const result = productReviewSchema.parse({ rating: 5, comment: "  Very useful.  " });
    expect(result).toEqual({ rating: 5, comment: "Very useful." });
  });

  it("rejects ratings outside one to five", () => {
    expect(productReviewSchema.safeParse({ rating: 0, comment: "Useful" }).success).toBe(false);
    expect(productReviewSchema.safeParse({ rating: 6, comment: "Useful" }).success).toBe(false);
  });

  it("rejects empty comments", () => {
    expect(productReviewSchema.safeParse({ rating: 4, comment: "  " }).success).toBe(false);
  });
});
