// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  AdminRequiredError: class AdminRequiredError extends Error {}
}));
import { requireAdmin, AuthenticationRequiredError, AdminRequiredError } from "@/lib/auth";
import { prepareVideoUpload, localVideoSize } from "@/lib/vps-video";
import { PUT } from "./route";

let directory: string;
beforeEach(async () => {
  vi.mocked(requireAdmin).mockReset();
  directory = await mkdtemp(join(tmpdir(), "aoupa-video-api-"));
  vi.stubEnv("VPS_VIDEO_DIR", directory);
  vi.stubEnv("VIDEO_UPLOAD_SECRET", "test-only-secret");
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

it("requires administrator authentication even with an upload token", async () => {
  vi.mocked(requireAdmin).mockRejectedValueOnce(new AuthenticationRequiredError());
  expect((await PUT(new Request("http://localhost/api/admin/video-upload", { method: "PUT" }))).status).toBe(401);
  vi.mocked(requireAdmin).mockRejectedValueOnce(new AdminRequiredError());
  expect((await PUT(new Request("http://localhost/api/admin/video-upload", { method: "PUT" }))).status).toBe(403);
});

it("rejects foreign origins and invalid tokens before writing files", async () => {
  expect((await PUT(new Request("http://localhost/api/admin/video-upload", { method: "PUT", headers: { origin: "https://untrusted.example" } }))).status).toBe(403);
  expect(requireAdmin).not.toHaveBeenCalled();
  expect((await PUT(new Request("http://localhost/api/admin/video-upload", { method: "PUT", headers: { authorization: "Bearer invalid" } }))).status).toBe(403);
});

it("writes an authenticated upload and returns the offset used by the browser", async () => {
  const body = "0000ftyp0000video";
  const upload = await prepareVideoUpload("11111111-1111-4111-8111-111111111111", "mp4", body.length);
  const response = await PUT(new Request("http://localhost/api/admin/video-upload", {
    method: "PUT", headers: { authorization: `Bearer ${upload.token}`, "x-upload-offset": "0", origin: "http://localhost" }, body
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ offset: body.length, complete: true });
  expect(await localVideoSize(upload.path)).toBe(body.length);
});
