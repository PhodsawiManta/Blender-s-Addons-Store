import { requireAdmin, AdminRequiredError, AuthenticationRequiredError } from "@/lib/auth";
import { hasTrustedRequestOrigin, jsonNoStore } from "@/lib/auth-http";
import { readVideoChunk, verifyVideoToken, VideoUploadError, writeVideoChunk } from "@/lib/vps-video";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  if (!hasTrustedRequestOrigin(request)) return jsonNoStore({ error: "Untrusted request origin." }, 403);
  try {
    await requireAdmin();
    const token = verifyVideoToken(request.headers.get("authorization")?.replace(/^Bearer /, "") || "");
    if (!token) return jsonNoStore({ error: "The video upload token is invalid or expired." }, 403);
    const offsetHeader = request.headers.get("x-upload-offset");
    if (!offsetHeader || !/^\d+$/.test(offsetHeader)) return jsonNoStore({ error: "Invalid upload offset." }, 400);
    const chunk = await readVideoChunk(request.body);
    return jsonNoStore(await writeVideoChunk(token.path, token.size, Number(offsetHeader), chunk));
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return jsonNoStore({ error: "Authentication required." }, 401);
    if (error instanceof AdminRequiredError) return jsonNoStore({ error: "Administrator access required." }, 403);
    if (error instanceof VideoUploadError) return jsonNoStore({ error: error.message }, error.status);
    console.error("VPS video upload failed", error);
    return jsonNoStore({ error: "Unable to save video on the VPS. Check disk space and storage permissions." }, 500);
  }
}
