import { z } from "zod";

export const productReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(3).max(2000)
});
