import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { access, mkdir, open, rename, rm, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { MAX_TUTORIAL_BYTES } from "@/lib/admin-product-validation";
import { parseVideoPath, VIDEO_CHUNK_BYTES } from "@/lib/video-path";

function signingKey() {
  const key = process.env.VIDEO_UPLOAD_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Video upload signing is not configured.");
  return key;
}

export function videoFilePath(path: string) {
  const video = parseVideoPath(path);
  if (!video) throw new Error("Invalid video path.");
  return join(resolve(process.env.VPS_VIDEO_DIR || "data/videos"), video.productId, video.filename);
}

export async function prepareVideoUpload(productId: string, extension: string, size: number) {
  const path = `vps:${productId}/${randomUUID()}.${extension}`;
  const filename = videoFilePath(path);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_TUTORIAL_BYTES) throw new Error("Invalid video size.");
  await mkdir(dirname(filename), { recursive: true });
  await access(dirname(filename), constants.W_OK);
  const payload = Buffer.from(JSON.stringify({ path, size, expires: Date.now() + 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return { path, signedUrl: "/api/admin/video-upload", token: `${payload}.${signature}`, provider: "vps" as const };
}

export function verifyVideoToken(token: string) {
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = createHmac("sha256", signingKey()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as { path: string; size: number; expires: number };
    if (typeof value.path !== "string" || !parseVideoPath(value.path)
      || !Number.isSafeInteger(value.size) || value.size <= 0 || value.size > MAX_TUTORIAL_BYTES
      || !Number.isSafeInteger(value.expires) || value.expires < Date.now()) return null;
    return value;
  } catch { return null; }
}

export async function localVideoSize(path: string) {
  try {
    const info = await stat(videoFilePath(path));
    return info.isFile() ? info.size : 0;
  } catch { return 0; }
}

export async function removeLocalVideo(path: string) {
  const filename = videoFilePath(path);
  await rm(filename, { force: true });
  await rm(`${filename}.part`, { force: true });
}

export class VideoUploadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function readVideoChunk(body: ReadableStream<Uint8Array> | null) {
  if (!body) throw new VideoUploadError("Empty upload.", 400);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > VIDEO_CHUNK_BYTES) {
        await reader.cancel();
        throw new VideoUploadError("Upload chunks must be 4 MB or smaller.", 413);
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  if (!length) throw new VideoUploadError("Empty upload.", 400);
  return Buffer.concat(chunks, length);
}

export async function writeVideoChunk(path: string, size: number, offset: number, chunk: Buffer) {
  if (!Number.isSafeInteger(offset) || offset < 0 || !chunk.length || chunk.length > VIDEO_CHUNK_BYTES
    || !Number.isSafeInteger(size) || size <= 0 || size > MAX_TUTORIAL_BYTES || offset + chunk.length > size) {
    throw new VideoUploadError("Invalid upload size or offset.", 400);
  }
  const filename = videoFilePath(path);
  const video = parseVideoPath(path)!;
  if (offset === 0) {
    const valid = video.extension === "mp4"
      ? chunk.length >= 12 && chunk.toString("ascii", 4, 8) === "ftyp"
      : chunk.length >= 4 && chunk.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (!valid) throw new VideoUploadError("The file contents must be MP4 or WEBM.", 400);
  }
  await mkdir(dirname(filename), { recursive: true });
  let lock;
  try { lock = await open(`${filename}.lock`, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new VideoUploadError("Upload is busy. Retry this chunk.", 409);
    throw error;
  }
  try {
    if (await localVideoSize(path) === size) return { offset: size, complete: true };
    const part = `${filename}.part`;
    const handle = await open(part, "a+");
    let next = offset + chunk.length;
    try {
      const current = (await handle.stat()).size;
      if (current !== offset) {
        // A retry after a lost response must never append the same bytes twice.
        if (offset + chunk.length <= current) {
          const previous = Buffer.alloc(chunk.length);
          await handle.read(previous, 0, previous.length, offset);
          if (!previous.equals(chunk)) throw new VideoUploadError("Upload chunk does not match. Restart the upload.", 409);
          next = current;
        } else {
          throw new VideoUploadError("Upload offset does not match. Restart the upload.", 409);
        }
      } else {
        try { await handle.writeFile(chunk); }
        catch (error) { await handle.truncate(current); throw error; }
      }
    } finally { await handle.close(); }
    if (next === size) await rename(part, filename);
    return { offset: next, complete: next === size };
  } finally {
    await lock.close();
    await rm(`${filename}.lock`, { force: true });
  }
}

export function videoRange(value: string | null, size: number) {
  if (!value) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end, partial: true };
}
