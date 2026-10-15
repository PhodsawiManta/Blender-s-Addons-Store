// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localVideoSize, prepareVideoUpload, readVideoChunk, removeLocalVideo, verifyVideoToken, videoFilePath, videoRange, writeVideoChunk } from "@/lib/vps-video";
import { parseVideoPath, VIDEO_CHUNK_BYTES, vpsVideoUrl } from "@/lib/video-path";
import { GET, HEAD } from "@/app/media/videos/[productId]/[filename]/route";

const productId = "11111111-1111-4111-8111-111111111111";
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "aoupa-video-test-"));
  vi.stubEnv("VPS_VIDEO_DIR", directory);
  vi.stubEnv("VIDEO_UPLOAD_SECRET", "test-only-secret");
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("VPS video storage", () => {
  it("rejects path traversal and invalid upload sizes", async () => {
    expect(parseVideoPath("vps:../../secret.mp4")).toBeNull();
    expect(() => videoFilePath("vps:../../secret.mp4")).toThrow();
    await expect(prepareVideoUpload(productId, "mp4", 500 * 1024 * 1024 + 1)).rejects.toThrow();
    await expect(prepareVideoUpload(productId, "html", 20)).rejects.toThrow();
  });

  it("binds upload tokens to size and path and rejects tampering and expiration", async () => {
    const upload = await prepareVideoUpload(productId, "mp4", 20);
    expect(verifyVideoToken(upload.token)).toMatchObject({ path: upload.path, size: 20 });
    const [payload, signature] = upload.token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), size: 500 })).toString("base64url");
    expect(verifyVideoToken(`${forged}.${signature}`)).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
    expect(verifyVideoToken(upload.token)).toBeNull();
    vi.restoreAllMocks();
  });

  it("publishes only complete files, retries chunks safely, streams ranges and removes files", async () => {
    const bytes = Buffer.from("0000ftyp0000video-payload");
    const upload = await prepareVideoUpload(productId, "mp4", bytes.length);
    const first = bytes.subarray(0, 12);
    expect(await writeVideoChunk(upload.path, bytes.length, 0, first)).toEqual({ offset: 12, complete: false });
    expect(await localVideoSize(upload.path)).toBe(0);
    const video = parseVideoPath(upload.path)!;
    const context = { params: Promise.resolve({ productId, filename: video.filename }) };
    expect((await GET(new Request("http://localhost/video"), context)).status).toBe(404);
    expect(await writeVideoChunk(upload.path, bytes.length, 0, first)).toEqual({ offset: 12, complete: false });
    await expect(writeVideoChunk(upload.path, bytes.length, 13, Buffer.from("x"))).rejects.toThrow("offset");
    expect(await writeVideoChunk(upload.path, bytes.length, 12, bytes.subarray(12))).toEqual({ offset: bytes.length, complete: true });
    expect(await writeVideoChunk(upload.path, bytes.length, 12, bytes.subarray(12))).toEqual({ offset: bytes.length, complete: true });
    expect(await readFile(videoFilePath(upload.path))).toEqual(bytes);
    expect(vpsVideoUrl(upload.path)).toBe(`/media/videos/${productId}/${video.filename}`);
    const response = await GET(new Request("http://localhost/video", { headers: { Range: "bytes=12-16" } }), context);
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(`bytes 12-16/${bytes.length}`);
    expect(await response.text()).toBe("video");
    const full = await GET(new Request("http://localhost/video"), context);
    expect(full.status).toBe(200);
    expect(Buffer.from(await full.arrayBuffer())).toEqual(bytes);
    const head = await HEAD(new Request("http://localhost/video", { method: "HEAD" }), context);
    expect(head.headers.get("content-length")).toBe(String(bytes.length));
    expect(await head.text()).toBe("");
    expect((await GET(new Request("http://localhost/video", { headers: { Range: "bytes=999-" } }), context)).status).toBe(416);
    await removeLocalVideo(upload.path);
    expect(await localVideoSize(upload.path)).toBe(0);
  });

  it("rejects oversize chunks, size overflow, and disguised non-video files", async () => {
    const upload = await prepareVideoUpload(productId, "mp4", 20);
    await expect(writeVideoChunk(upload.path, 20, 0, Buffer.from("<html>fake video</html>"))).rejects.toThrow();
    await expect(writeVideoChunk(upload.path, 20, 19, Buffer.from("xx"))).rejects.toThrow();
    await expect(readVideoChunk(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(VIDEO_CHUNK_BYTES + 1)); controller.close();
    } }))).rejects.toThrow("4 MB");
    expect(videoRange("bytes=-5", 20)).toEqual({ start: 15, end: 19, partial: true });
    expect(videoRange("bytes=5-999", 20)).toEqual({ start: 5, end: 19, partial: true });
    expect(videoRange("bytes=10-2", 20)).toBeNull();
    expect(videoRange("bytes=0-2,5-7", 20)).toBeNull();
  });

  it("stores a video above the former 50 MB limit without buffering the entire file", async () => {
    const size = 13 * VIDEO_CHUNK_BYTES;
    const upload = await prepareVideoUpload(productId, "webm", size);
    const chunk = Buffer.alloc(VIDEO_CHUNK_BYTES);
    chunk.set([0x1a, 0x45, 0xdf, 0xa3]);
    for (let offset = 0; offset < size; offset += chunk.length) {
      await writeVideoChunk(upload.path, size, offset, chunk);
    }
    expect(await localVideoSize(upload.path)).toBe(size);
    const boundary = await prepareVideoUpload(productId, "mp4", 500 * 1024 * 1024);
    expect(verifyVideoToken(boundary.token)?.size).toBe(500 * 1024 * 1024);
  });
});
