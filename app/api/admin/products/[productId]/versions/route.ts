import { z } from "zod";
import {
  AdminRequiredError,
  AuthenticationRequiredError,
  requireAdmin
} from "@/lib/auth";
import {
  createVersionSchema,
  validateArchive
} from "@/lib/admin-product-validation";
import { hasTrustedRequestOrigin, jsonNoStore, readJsonBody } from "@/lib/auth-http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const deleteSchema = z.object({ versionId: z.uuid() });

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
  const parsed = createVersionSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return jsonNoStore({ error: parsed.error.issues[0]?.message ?? "Invalid version metadata." }, 400);
  }
  const fileError = validateArchive(parsed.data.archive);
  if (fileError) return jsonNoStore({ error: fileError }, 400);

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
  if (product.data.status === "ARCHIVED") {
    return jsonNoStore({ error: "Archived add-ons cannot receive new versions." }, 409);
  }

  const versionId = crypto.randomUUID();
  const archivePath = `addons/${productId}/${versionId}/addon.zip`;
  const upload = await supabase.storage
    .from("product-files")
    .createSignedUploadUrl(archivePath, { upsert: false });
  if (upload.error || !upload.data) {
    return jsonNoStore({ error: upload.error?.message ?? "Unable to prepare the ZIP upload." }, 502);
  }

  const insert = await supabase.from("addon_versions").insert({
    id: versionId,
    product_id: productId,
    version: parsed.data.version,
    storage_path: archivePath,
    file_size_bytes: parsed.data.archive.size,
    changelog_markdown: parsed.data.changelog,
    published: false,
    published_at: null
  });
  if (insert.error) {
    return jsonNoStore({
      error: insert.error.code === "23505"
        ? "That version already exists for this add-on."
        : insert.error.message
    }, insert.error.code === "23505" ? 409 : 400);
  }

  return jsonNoStore({ versionId, upload: upload.data }, 201);
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
  const parsed = deleteSchema.safeParse(await readJsonBody(request));
  if (!z.uuid().safeParse(productId).success || !parsed.success) {
    return jsonNoStore({ error: "Invalid add-on version." }, 400);
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) return jsonNoStore({ error: "Supabase is not configured." }, 503);

  const version = await supabase
    .from("addon_versions")
    .delete()
    .eq("id", parsed.data.versionId)
    .eq("product_id", productId)
    .eq("published", false)
    .select("storage_path")
    .maybeSingle();
  if (version.error) return jsonNoStore({ error: version.error.message }, 500);
  if (version.data?.storage_path) {
    await supabase.storage.from("product-files").remove([version.data.storage_path]);
  }
  return jsonNoStore({ deleted: true });
}
