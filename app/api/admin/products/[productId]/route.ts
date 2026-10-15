import { z } from "zod";
import { parseVideoPath } from "@/lib/video-path";
import { localVideoSize, removeLocalVideo } from "@/lib/vps-video";
import {
  AdminRequiredError,
  AuthenticationRequiredError,
  requireAdmin
} from "@/lib/auth";
import {
  MAX_COVER_BYTES,
  MAX_TUTORIAL_BYTES,
  updateProductSchema
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

async function verifiedAssetPath({
  supabase,
  productId,
  path,
  kind
}: {
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  productId: string;
  path: string;
  kind: "image" | "tutorialVideo";
}) {
  if (path.startsWith("vps:")) {
    if (kind !== "tutorialVideo" || parseVideoPath(path)?.productId !== productId) return false;
    const bytes = await localVideoSize(path);
    return bytes > 0 && bytes <= MAX_TUTORIAL_BYTES;
  }
  const prefix = kind === "image"
    ? `addons/${productId}/media/`
    : `addons/${productId}/tutorials/`;
  if (!path.startsWith(prefix)) return false;
  const info = await supabase.storage.from("product-media").info(path);
  const bytes = Number(info.data?.size);
  const limit = kind === "image" ? MAX_COVER_BYTES : MAX_TUTORIAL_BYTES;
  return !info.error
    && Boolean(info.data)
    && Number.isFinite(bytes)
    && bytes > 0
    && bytes <= limit;
}

export async function PATCH(
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
  const parsed = updateProductSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return jsonNoStore({ error: parsed.error.issues[0]?.message ?? "Invalid add-on metadata." }, 400);
  }
  if (parsed.data.usdAmountCents > 0 && !env.paidCheckoutEnabled) {
    return jsonNoStore({
      error: "Set PAID_CHECKOUT_ENABLED=true before setting a paid price."
    }, 409);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return jsonNoStore({ error: "Supabase service-role access is not configured." }, 503);
  }

  const [productQuery, priceQuery, mediaQuery, slugQuery] = await Promise.all([
    supabase
      .from("products")
      .select("id,type,status,is_free,download_requires_login,stripe_product_id,tutorial_video_path")
      .eq("id", productId)
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
      .eq("product_id", productId),
    supabase
      .from("products")
      .select("id")
      .eq("slug", parsed.data.slug)
      .neq("id", productId)
      .maybeSingle()
  ]);
  const queryError = productQuery.error ?? priceQuery.error ?? mediaQuery.error ?? slugQuery.error;
  if (queryError) return jsonNoStore({ error: queryError.message }, 500);
  if (!productQuery.data || productQuery.data.type !== "ADDON") {
    return jsonNoStore({ error: "Add-on not found." }, 404);
  }
  if (slugQuery.data) return jsonNoStore({ error: "That URL slug is already in use." }, 409);

  const requestedMediaPaths = parsed.data.mediaPaths !== undefined
    ? Array.from(new Set(parsed.data.mediaPaths))
    : parsed.data.coverPath !== undefined
      ? parsed.data.coverPath ? [parsed.data.coverPath] : []
      : undefined;
  if (requestedMediaPaths) {
    const verifiedMedia = await Promise.all(requestedMediaPaths.map((path) =>
      verifiedAssetPath({
        supabase,
        productId,
        path,
        kind: "image"
      })
    ));
    if (verifiedMedia.some((verified) => !verified)) {
      return jsonNoStore({ error: "One or more gallery image uploads are incomplete." }, 409);
    }
  }
  if (
    typeof parsed.data.tutorialVideoPath === "string"
    && !await verifiedAssetPath({
      supabase,
      productId,
      path: parsed.data.tutorialVideoPath,
      kind: "tutorialVideo"
    })
  ) {
    return jsonNoStore({ error: "The tutorial video upload is incomplete." }, 409);
  }

  const currentAmount = Number(priceQuery.data?.usd_amount_cents ?? 0);
  const priceChanged = currentAmount !== parsed.data.usdAmountCents
    || (parsed.data.usdAmountCents > 0 && !priceQuery.data?.stripe_price_id);
  let stripeCatalog;
  try {
    stripeCatalog = await ensureStripeCatalog({
      productId,
      title: parsed.data.title,
      description: parsed.data.description,
      usdAmountCents: parsed.data.usdAmountCents,
      existingProductId: productQuery.data.stripe_product_id,
      existingPriceId: priceQuery.data?.stripe_price_id,
      existingAmountCents: currentAmount
    });
  } catch {
    return jsonNoStore({ error: "Unable to update the Stripe product or USD price." }, 502);
  }
  const stripeCatalogChanged = (
    stripeCatalog.stripeProductId !== productQuery.data.stripe_product_id
    || stripeCatalog.stripePriceId !== (priceQuery.data?.stripe_price_id ?? null)
  );

  const productUpdate = await supabase
    .from("products")
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      category: parsed.data.category,
      eyebrow: parsed.data.eyebrow || null,
      description: parsed.data.description,
      long_description: parsed.data.longDescription,
      guide_markdown: parsed.data.guide,
      features: parsed.data.features,
      blender_versions: parsed.data.blenderVersions,
      tutorial_url: parsed.data.tutorialUrl ?? null,
      tutorial_label: parsed.data.tutorialLabel || null,
      ...(parsed.data.tutorialVideoPath !== undefined
        ? { tutorial_video_path: parsed.data.tutorialVideoPath }
        : {}),
      updated_at: new Date().toISOString()
    })
    .eq("id", productId);
  if (productUpdate.error) {
    return jsonNoStore({ error: productUpdate.error.message }, 400);
  }

  if (priceChanged || stripeCatalogChanged) {
    const pricing = await supabase.rpc("configure_product_price", {
      target_product_id: productId,
      target_usd_amount_cents: parsed.data.usdAmountCents,
      target_stripe_product_id: stripeCatalog.stripeProductId,
      target_stripe_price_id: stripeCatalog.stripePriceId
    });
    if (pricing.error) {
      if (stripeCatalog.stripePriceId !== priceQuery.data?.stripe_price_id) {
        await archivePreviousStripeCatalog({ stripePriceId: stripeCatalog.stripePriceId });
      }
      return jsonNoStore({ error: "Unable to save the new USD price." }, 409);
    }
    await archivePreviousStripeCatalog({
      stripeProductId: productQuery.data.stripe_product_id,
      stripePriceId: priceQuery.data?.stripe_price_id,
      archiveProduct: parsed.data.usdAmountCents === 0
    });
  }

  const loginRequirement = await supabase
    .from("products")
    .update({
      download_requires_login: parsed.data.usdAmountCents > 0 || parsed.data.requiresLogin,
      updated_at: new Date().toISOString()
    })
    .eq("id", productId);
  if (loginRequirement.error) {
    return jsonNoStore({ error: loginRequirement.error.message }, 400);
  }

  if (requestedMediaPaths !== undefined) {
    const previousPaths = (mediaQuery.data ?? []).map((item) => item.storage_path).filter(Boolean);
    const mediaDelete = await supabase.from("product_media").delete().eq("product_id", productId);
    if (mediaDelete.error) return jsonNoStore({ error: mediaDelete.error.message }, 400);
    if (requestedMediaPaths.length > 0) {
      const mediaInsert = await supabase.from("product_media").insert(
        requestedMediaPaths.map((path, position) => ({
        product_id: productId,
        storage_path: path,
        alt_text: `${parsed.data.title} gallery image ${position + 1}`,
        position
        }))
      );
      if (mediaInsert.error) return jsonNoStore({ error: mediaInsert.error.message }, 400);
    }
    const obsoletePaths = previousPaths.filter((path) => !requestedMediaPaths.includes(path));
    if (obsoletePaths.length > 0) {
      await supabase.storage.from("product-media").remove(obsoletePaths);
    }
  }

  if (parsed.data.tutorialVideoPath !== undefined) {
    const previousPath = productQuery.data.tutorial_video_path;
    if (previousPath && previousPath !== parsed.data.tutorialVideoPath) {
      if (previousPath.startsWith("vps:")) {
        await removeLocalVideo(previousPath).catch((error) => console.error("Unable to remove old VPS video", error));
      } else {
        await supabase.storage.from("product-media").remove([previousPath]);
      }
    }
  }

  return jsonNoStore({ updated: true, productId });
}

export async function DELETE(
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
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return jsonNoStore({ error: "Supabase service-role access is not configured." }, 503);
  }

  const [productQuery, versionsQuery, mediaQuery, priceQuery] = await Promise.all([
    supabase
      .from("products")
      .select("id,type,status,stripe_product_id,tutorial_video_path")
      .eq("id", productId)
      .maybeSingle(),
    supabase.from("addon_versions").select("storage_path").eq("product_id", productId),
    supabase.from("product_media").select("storage_path").eq("product_id", productId),
    supabase
      .from("product_prices")
      .select("stripe_price_id")
      .eq("product_id", productId)
      .eq("active", true)
      .maybeSingle()
  ]);
  const queryError = productQuery.error ?? versionsQuery.error ?? mediaQuery.error ?? priceQuery.error;
  if (queryError) return jsonNoStore({ error: queryError.message }, 500);
  if (!productQuery.data || productQuery.data.type !== "ADDON") {
    return jsonNoStore({ error: "Add-on not found." }, 404);
  }
  if (productQuery.data.status !== "DRAFT") {
    return jsonNoStore({ error: "Only incomplete draft add-ons can be removed here." }, 409);
  }

  const archivePaths = (versionsQuery.data ?? []).map((row) => row.storage_path).filter(Boolean);
  const mediaPaths = (mediaQuery.data ?? []).map((row) => row.storage_path).filter(Boolean);
  if (productQuery.data.tutorial_video_path) {
    mediaPaths.push(productQuery.data.tutorial_video_path);
  }
  const deletion = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("status", "DRAFT")
    .select("id")
    .maybeSingle();
  if (deletion.error || !deletion.data) {
    return jsonNoStore({ error: deletion.error?.message ?? "The draft no longer exists." }, 409);
  }

  const cleanupWarnings: string[] = [];
  if (archivePaths.length > 0) {
    const removal = await supabase.storage.from("product-files").remove(archivePaths);
    if (removal.error) cleanupWarnings.push(removal.error.message);
  }
  if (mediaPaths.length > 0) {
    for (const path of mediaPaths.filter((path) => path.startsWith("vps:"))) {
      try { await removeLocalVideo(path); } catch { cleanupWarnings.push("VPS video cleanup failed."); }
    }
    const remotePaths = mediaPaths.filter((path) => !path.startsWith("vps:"));
    if (remotePaths.length) {
      const removal = await supabase.storage.from("product-media").remove(remotePaths);
      if (removal.error) cleanupWarnings.push(removal.error.message);
    }
  }
  await archivePreviousStripeCatalog({
    stripeProductId: productQuery.data.stripe_product_id,
    stripePriceId: priceQuery.data?.stripe_price_id,
    archiveProduct: true
  });

  return jsonNoStore({
    deleted: true,
    warning: cleanupWarnings.length > 0
      ? "The draft was removed, but some orphaned storage objects may require manual cleanup."
      : undefined
  });
}
