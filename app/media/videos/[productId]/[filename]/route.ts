import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { parseVideoPath } from "@/lib/video-path";
import { videoFilePath, videoRange } from "@/lib/vps-video";

export const runtime = "nodejs";
type Context = { params: Promise<{ productId: string; filename: string }> };

async function serve(request: Request, context: Context) {
  const { productId, filename } = await context.params;
  const path = `vps:${productId}/${filename}`;
  const video = parseVideoPath(path);
  if (!video) return new Response(null, { status: 404 });
  let file;
  try { file = await open(videoFilePath(path), "r"); }
  catch { return new Response(null, { status: 404 }); }
  try {
    const info = await file.stat();
    const range = videoRange(request.headers.get("range"), info.size);
    if (!info.isFile() || !info.size) { await file.close(); return new Response(null, { status: 404 }); }
    if (!range) {
      await file.close();
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    }
    const headers = new Headers({
      "Content-Type": video.extension === "mp4" ? "video/mp4" : "video/webm",
      "Content-Length": String(range.end - range.start + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    });
    if (range.partial) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${info.size}`);
    if (request.method === "HEAD") {
      await file.close();
      return new Response(null, { status: range.partial ? 206 : 200, headers });
    }
    const stream = file.createReadStream({ start: range.start, end: range.end, autoClose: true });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range.partial ? 206 : 200, headers });
  } catch (error) { await file.close(); throw error; }
}

export const GET = serve;
export const HEAD = serve;
