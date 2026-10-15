import {
  AdminRequiredError,
  AuthenticationRequiredError,
  requireAdmin
} from "@/lib/auth";
import { getAdminProducts } from "@/lib/admin-data";
import { prepareVideoUpload } from "@/lib/vps-video";
import {
  createProductSchema,
  extensionFor,
  validateArchive,
  validateCover,
  validateTutorialVideo
} from "@/lib/admin-product-validation";
import {
  hasTrustedRequestOrigin,
  jsonNoStore,
  readJsonBody
} from "@/lib/auth-http";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  archivePreviousStripeCatalog,
  ensureStripeCatalog
} from "@/lib/stripe-catalog";

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

export async function GET() {
  const authError = await adminErrorResponse();
  if (authError) return authError;
  const result = await getAdminProducts();
  return jsonNoStore(
    result.error ? { products: result.data, error: result.error } : { products: result.data },
    result.error ? 503 : 200
  );
}

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonNoStore({ error: "Untrusted request origin." }, 403);
  }
  const authError = await adminErrorResponse();
  if (authError) return authError;

  const parsed = createProductSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return jsonNoStore({ error: parsed.error.issues[0]?.message ?? "Invalid add-on metadata." }, 400);
  }

  const fileError = validateArchive(parsed.data.archive)
    ?? validateCover(parsed.data.cover)
    ?? validateTutorialVideo(parsed.data.tutorialVideo);
  if (fileError) return jsonNoStore({ error: fileError }, 400);
  if (parsed.data.usdAmountCents > 0 && !env.paidCheckoutEnabled) {
    return jsonNoStore({
      error: "Set PAID_CHECKOUT_ENABLED=true before publishing a paid add-on."
    }, 409);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return jsonNoStore({ error: "Supabase service-role access is not configured." }, 503);
  }

  const duplicate = await supabase
    .from("products")
    .select("id")
    .eq("slug", parsed.data.slug)
    .maybeSingle();
  if (duplicate.error) return jsonNoStore({ error: duplicate.error.message }, 500);
  if (duplicate.data) return jsonNoStore({ error: "That URL slug is already in use." }, 409);

  const productId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const mediaId = parsed.data.cover ? crypto.randomUUID() : null;
  const archivePath = `addons/${productId}/${versionId}/addon.zip`;
  const coverPath = parsed.data.cover && mediaId
    ? `addons/${productId}/media/${mediaId}/cover.${extensionFor(parsed.data.cover.name)}`
    : null;
  let localTutorialUpload;
  try {
    localTutorialUpload = parsed.data.tutorialVideo
      ? await prepareVideoUpload(productId, extensionFor(parsed.data.tutorialVideo.name), parsed.data.tutorialVideo.size)
      : null;
  } catch {
    return jsonNoStore({ error: "VPS video storage is unavailable. Check VPS_VIDEO_DIR permissions." }, 503);
  }
  const tutorialVideoPath = localTutorialUpload?.path ?? null;

  const [archiveUpload, coverUpload, tutorialUpload] = await Promise.all([
    supabase.storage.from("product-files").createSignedUploadUrl(archivePath, { upsert: false }),
    coverPath
      ? supabase.storage.from("product-media").createSignedUploadUrl(coverPath, { upsert: false })
      : Promise.resolve(null),
    Promise.resolve(localTutorialUpload ? { data: localTutorialUpload, error: null } : null)
  ]);
  const uploadError = archiveUpload.error ?? coverUpload?.error ?? tutorialUpload?.error;
  if (uploadError || !archiveUpload.data || (coverPath && !coverUpload?.data) || (tutorialVideoPath && !tutorialUpload?.data)) {
    return jsonNoStore({ error: uploadError?.message ?? "Unable to prepare file uploads." }, 502);
  }

  let stripeCatalog: Awaited<ReturnType<typeof ensureStripeCatalog>>;
  try {
    stripeCatalog = await ensureStripeCatalog({
      productId,
      title: parsed.data.title,
      description: parsed.data.description,
      usdAmountCents: parsed.data.usdAmountCents
    });
  } catch {
    return jsonNoStore({ error: "Unable to create the Stripe product and USD price." }, 502);
  }

  async function rollback(message: string, status = 400) {
    await supabase!.from("products").delete().eq("id", productId);
    await archivePreviousStripeCatalog({
      stripeProductId: stripeCatalog.stripeProductId,
      stripePriceId: stripeCatalog.stripePriceId,
      archiveProduct: true
    });
    return jsonNoStore({ error: message }, status);
  }

  const productInsert = await supabase.from("products").insert({
    id: productId,
    slug: parsed.data.slug,
    type: "ADDON",
    status: "DRAFT",
    title: parsed.data.title,
    eyebrow: parsed.data.eyebrow || null,
    description: parsed.data.description,
    long_description: parsed.data.longDescription,
    category: parsed.data.category,
    artwork_tone: "orange",
    badge: parsed.data.usdAmountCents === 0 ? "Free" : null,
    rating: 0,
    blender_versions: parsed.data.blenderVersions,
    features: parsed.data.features,
    guide_markdown: parsed.data.guide,
    is_free: parsed.data.usdAmountCents === 0,
    download_requires_login: parsed.data.usdAmountCents > 0 || parsed.data.requiresLogin,
    featured: false,
    download_count: 0,
    stripe_product_id: stripeCatalog.stripeProductId,
    tutorial_video_path: tutorialVideoPath,
    tutorial_url: parsed.data.tutorialUrl ?? null,
    tutorial_label: parsed.data.tutorialLabel || null,
    published_at: null
  });
  if (productInsert.error) {
    return rollback(productInsert.error.message, productInsert.error.code === "23505" ? 409 : 400);
  }

  const priceInsert = await supabase.from("product_prices").insert({
    product_id: productId,
    usd_amount_cents: parsed.data.usdAmountCents,
    stripe_price_id: stripeCatalog.stripePriceId,
    active: true
  });
  if (priceInsert.error) return rollback(priceInsert.error.message);

  const versionInsert = await supabase.from("addon_versions").insert({
    id: versionId,
    product_id: productId,
    version: parsed.data.version,
    storage_path: archivePath,
    file_size_bytes: parsed.data.archive.size,
    changelog_markdown: parsed.data.changelog,
    published: false,
    published_at: null
  });
  if (versionInsert.error) return rollback(versionInsert.error.message);

  if (coverPath && mediaId) {
    const mediaInsert = await supabase.from("product_media").insert({
      id: mediaId,
      product_id: productId,
      storage_path: coverPath,
      alt_text: `${parsed.data.title} cover`,
      position: 0
    });
    if (mediaInsert.error) return rollback(mediaInsert.error.message);
  }

  return jsonNoStore({
    productId,
    versionId,
    uploads: {
      archive: archiveUpload.data,
      cover: coverUpload?.data ?? null,
      tutorialVideo: tutorialUpload?.data ?? null
    }
  }, 201);
}
