import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import {
  hasTrustedRequestOrigin,
  jsonNoStore,
  readJsonBody
} from "@/lib/auth-http";
import { productReviewSchema } from "@/lib/review-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const productIdSchema = z.uuid();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonNoStore({ error: "Untrusted request origin." }, 403);
  }

  const parsedId = productIdSchema.safeParse((await params).productId);
  if (!parsedId.success) {
    return jsonNoStore({ error: "Invalid add-on." }, 400);
  }
  const parsedReview = productReviewSchema.safeParse(await readJsonBody(request));
  if (!parsedReview.success) {
    return jsonNoStore({ error: parsedReview.error.issues[0]?.message ?? "Invalid review." }, 400);
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return jsonNoStore({ error: "Sign in to post a review." }, 401);
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return jsonNoStore({ error: "Reviews are not configured." }, 503);
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,type,status")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (productError) return jsonNoStore({ error: "Could not verify this add-on." }, 500);
  if (!product || product.type !== "ADDON" || product.status !== "PUBLISHED") {
    return jsonNoStore({ error: "This add-on is not available for review." }, 404);
  }

  const { data, error } = await supabase
    .from("product_reviews")
    .upsert({
      product_id: parsedId.data,
      user_id: profile.id,
      rating: parsedReview.data.rating,
      comment: parsedReview.data.comment,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,product_id" })
    .select("id")
    .single();
  if (error || !data) {
    return jsonNoStore({ error: "Could not save your review." }, 500);
  }

  return jsonNoStore({ ok: true, reviewId: data.id });
}
