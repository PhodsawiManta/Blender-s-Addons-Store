import "server-only";

import { getProductsForLibrary } from "@/lib/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

export async function getLibraryData(userId: string): Promise<{
  addons: Product[];
  downloadCount: number;
}> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { addons: [], downloadCount: 0 };

  const [{ data: entitlements }, { count: downloadCount }] = await Promise.all([
    supabase
      .from("entitlements")
      .select("product_id")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("download_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
  ]);
  const ids = [...new Set((entitlements ?? []).map((item) => item.product_id))];
  const addons = await getProductsForLibrary(ids);
  return { addons, downloadCount: downloadCount ?? 0 };
}
