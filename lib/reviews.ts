import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProductReview } from "@/lib/types";

type ReviewRow = {
  id: unknown;
  user_id: unknown;
  rating: unknown;
  comment: unknown;
  created_at: unknown;
  updated_at: unknown;
};

export async function getProductReviews(
  productId: string,
  viewerId?: string
): Promise<{ reviews: ProductReview[]; count: number }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { reviews: [], count: 0 };

  const { data, error, count } = await supabase
    .from("product_reviews")
    .select("id,user_id,rating,comment,created_at,updated_at", { count: "exact" })
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return { reviews: [], count: 0 };

  const rows = data as ReviewRow[];
  const userIds = Array.from(new Set(rows.flatMap((row) =>
    typeof row.user_id === "string" ? [row.user_id] : []
  )));
  const { data: profiles } = userIds.length > 0
    ? await supabase.from("profiles").select("id,display_name").in("id", userIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const names = new Map((profiles ?? []).flatMap((profile) =>
    typeof profile.id === "string"
      ? [[profile.id, typeof profile.display_name === "string" && profile.display_name.trim()
        ? profile.display_name.trim()
        : "Aoupa member"] as const]
      : []
  ));

  const reviews = rows.flatMap((row): ProductReview[] => {
    if (
      typeof row.id !== "string"
      || typeof row.user_id !== "string"
      || typeof row.comment !== "string"
      || typeof row.created_at !== "string"
      || typeof row.updated_at !== "string"
    ) return [];
    const rating = Number(row.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return [];
    return [{
      id: row.id,
      rating,
      comment: row.comment,
      authorName: names.get(row.user_id) ?? "Aoupa member",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isOwn: row.user_id === viewerId
    }];
  });

  return { reviews, count: count ?? reviews.length };
}
