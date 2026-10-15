import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const versionIdSchema = z.uuid();

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const parsedId = versionIdSchema.safeParse((await params).versionId);
  if (!parsedId.success) return jsonError("Version not found.", 404);

  const supabase = createSupabaseAdminClient();
  if (!supabase) return jsonError("Storage is not configured.", 503);

  const { data: version } = await supabase
    .from("addon_versions")
    .select("id,product_id,version,storage_path,published")
    .eq("id", parsedId.data)
    .eq("published", true)
    .maybeSingle();
  if (!version) return jsonError("Version not found.", 404);

  const [{ data: product }, profile] = await Promise.all([
    supabase
      .from("products")
      .select("id,slug,type,status,is_free,download_requires_login")
      .eq("id", version.product_id)
      .maybeSingle(),
    getCurrentProfile()
  ]);
  if (!product || product.type !== "ADDON" || product.status === "DRAFT") {
    return jsonError("This add-on is unavailable.", 404);
  }

  const allowsPublicDownload = product.status === "PUBLISHED"
    && product.is_free === true
    && product.download_requires_login === false;
  if (!allowsPublicDownload && !profile) {
    return jsonError("Sign in to download.", 401);
  }
  if (!allowsPublicDownload && profile) {
    const { data: entitlement } = await supabase
      .from("entitlements")
      .select("id")
      .eq("user_id", profile.id)
      .eq("product_id", version.product_id)
      .eq("active", true)
      .maybeSingle();
    if (!entitlement) return jsonError("This add-on is not in your library.", 403);
  }

  const fileName = `${product.slug}-${version.version}.zip`;
  const { data, error } = await supabase.storage
    .from("product-files")
    .createSignedUrl(version.storage_path, 60, { download: fileName });
  if (error || !data.signedUrl) return jsonError("Could not prepare the download.", 500);

  const downloadRecord = await supabase.rpc("record_addon_download", {
    download_user_id: profile?.id ?? null,
    download_product_id: product.id,
    download_version_id: version.id
  });
  if (downloadRecord.error) {
    return jsonError("This download is no longer authorized.", 403);
  }

  return NextResponse.json(
    { url: data.signedUrl },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
