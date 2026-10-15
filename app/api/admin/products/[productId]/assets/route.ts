import { z } from "zod";
import { prepareVideoUpload } from "@/lib/vps-video";
import {
  AdminRequiredError,
  AuthenticationRequiredError,
  requireAdmin
} from "@/lib/auth";
import {
  extensionFor,
  fileSchema,
  validateCover,
  validateTutorialVideo
} from "@/lib/admin-product-validation";
import { hasTrustedRequestOrigin, jsonNoStore, readJsonBody } from "@/lib/auth-http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  kind: z.enum(["image", "tutorialVideo"]),
  file: fileSchema
});

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
  if (!parsed.success) return jsonNoStore({ error: "Invalid asset metadata." }, 400);

  const validationError = parsed.data.kind === "image"
    ? validateCover(parsed.data.file)
    : validateTutorialVideo(parsed.data.file);
  if (validationError) return jsonNoStore({ error: validationError }, 400);

  const supabase = createSupabaseAdminClient();
  if (!supabase) return jsonNoStore({ error: "Supabase is not configured." }, 503);
  const product = await supabase
    .from("products")
    .select("id,type,status")
    .eq("id", productId)
    .maybeSingle();
  if (product.error) return jsonNoStore({ error: product.error.message }, 500);
  if (!product.data || product.data.type !== "ADDON") {
    return jsonNoStore({ error: "Add-on not found." }, 404);
  }

  const assetId = crypto.randomUUID();
  const extension = extensionFor(parsed.data.file.name);
  if (parsed.data.kind === "tutorialVideo") {
    try {
      const upload = await prepareVideoUpload(productId, extension, parsed.data.file.size);
      return jsonNoStore({ path: upload.path, upload }, 201);
    } catch {
      return jsonNoStore({ error: "VPS video storage is unavailable. Check VPS_VIDEO_DIR permissions." }, 503);
    }
  }
  const path = parsed.data.kind === "image"
    ? `addons/${productId}/media/${assetId}/image.${extension}`
    : `addons/${productId}/tutorials/${assetId}/tutorial.${extension}`;
  const upload = await supabase.storage
    .from("product-media")
    .createSignedUploadUrl(path, { upsert: false });
  if (upload.error || !upload.data) {
    return jsonNoStore({ error: upload.error?.message ?? "Unable to prepare the asset upload." }, 502);
  }

  return jsonNoStore({ path, upload: upload.data }, 201);
}
