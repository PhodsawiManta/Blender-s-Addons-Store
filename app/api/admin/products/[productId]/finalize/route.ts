import { z } from "zod";
import { localVideoSize } from "@/lib/vps-video";
import {
  AdminRequiredError,
  AuthenticationRequiredError,
  requireAdmin
} from "@/lib/auth";
import {
  MAX_ARCHIVE_BYTES,
  MAX_COVER_BYTES,
  MAX_TUTORIAL_BYTES
} from "@/lib/admin-product-validation";
import {
  hasTrustedRequestOrigin,
  jsonNoStore,
  readJsonBody
} from "@/lib/auth-http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ versionId: z.uuid() });

async function adminErrorResponse() {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return jsonNoStore({ error: "Authentication required." }, 401);
    }
    if (error instanceof AdminRequiredError) {
      return jsonNoStore({ error: "Administrator access required." }, 403);
    }
    return jsonNoStore({ error: "Unable to verify administrator access." }, 503);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonNoStore({ error: "Untrusted request origin." }, 403);
  }
  const authError = await adminErrorResponse();
  if (authError) return authError;

  const { productId } = await params;
  if (!z.uuid().safeParse(productId).success) {
    return jsonNoStore({ error: "Invalid add-on ID." }, 400);
  }
  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) return jsonNoStore({ error: "Invalid version ID." }, 400);

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return jsonNoStore({ error: "Supabase service-role access is not configured." }, 503);
  }

  const [productQuery, versionQuery, priceQuery, mediaQuery] = await Promise.all([
    supabase
      .from("products")
      .select("id,type,status,is_free,stripe_product_id,tutorial_video_path")
      .eq("id", productId)
      .maybeSingle(),
    supabase
      .from("addon_versions")
      .select("id,product_id,version,storage_path,published")
      .eq("id", parsed.data.versionId)
      .eq("product_id", productId)
      .maybeSingle(),
    supabase
      .from("product_prices")
      .select("id,usd_amount_cents,stripe_price_id")
      .eq("product_id", productId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("product_media")
      .select("id,storage_path")
      .eq("product_id", productId)
  ]);

  const queryError = productQuery.error ?? versionQuery.error ?? priceQuery.error ?? mediaQuery.error;
  if (queryError) return jsonNoStore({ error: queryError.message }, 500);
  if (!productQuery.data || productQuery.data.type !== "ADDON") {
    return jsonNoStore({ error: "Add-on not found." }, 404);
  }
  if (productQuery.data.status === "ARCHIVED") {
    return jsonNoStore({ error: "Archived add-ons cannot be published." }, 409);
  }
  const amount = Number(priceQuery.data?.usd_amount_cents);
  const validPricing = productQuery.data.is_free
    ? amount === 0
    : amount > 0
      && Boolean(productQuery.data.stripe_product_id)
      && Boolean(priceQuery.data?.stripe_price_id);
  if (!priceQuery.data || !validPricing) {
    return jsonNoStore({ error: "The add-on price is not ready for publishing." }, 409);
  }
  if (!versionQuery.data) return jsonNoStore({ error: "Add-on version not found." }, 404);

  const archiveInfo = await supabase.storage
    .from("product-files")
    .info(versionQuery.data.storage_path);
  const archiveBytes = Number(archiveInfo.data?.size);
  if (
    archiveInfo.error
    || !archiveInfo.data
    || !Number.isFinite(archiveBytes)
    || archiveBytes <= 0
    || archiveBytes > MAX_ARCHIVE_BYTES
  ) {
    return jsonNoStore({ error: "The required ZIP archive has not been uploaded." }, 409);
  }

  for (const media of mediaQuery.data ?? []) {
    const coverInfo = await supabase.storage.from("product-media").info(media.storage_path);
    const coverBytes = Number(coverInfo.data?.size);
    if (
      coverInfo.error
      || !coverInfo.data
      || !Number.isFinite(coverBytes)
      || coverBytes <= 0
      || coverBytes > MAX_COVER_BYTES
    ) {
      return jsonNoStore({ error: "The optional cover upload is incomplete." }, 409);
    }
  }

  if (productQuery.data.tutorial_video_path) {
    const tutorialInfo = productQuery.data.tutorial_video_path.startsWith("vps:")
      ? { data: { size: await localVideoSize(productQuery.data.tutorial_video_path) }, error: null }
      : await supabase.storage.from("product-media").info(productQuery.data.tutorial_video_path);
    const tutorialBytes = Number(tutorialInfo.data?.size);
    if (
      tutorialInfo.error
      || !tutorialInfo.data
      || !Number.isFinite(tutorialBytes)
      || tutorialBytes <= 0
      || tutorialBytes > MAX_TUTORIAL_BYTES
    ) {
      return jsonNoStore({ error: "The tutorial video upload is incomplete." }, 409);
    }
  }

  const actualBytes = Math.trunc(archiveBytes);
  const { error: publishError } = await supabase.rpc("publish_addon_version", {
    target_product_id: productId,
    target_version_id: versionQuery.data.id,
    target_file_size_bytes: actualBytes
  });
  if (publishError) {
    return jsonNoStore({ error: "The add-on could not be published." }, 409);
  }

  return jsonNoStore({
    published: true,
    productId,
    versionId: versionQuery.data.id
  });
}
