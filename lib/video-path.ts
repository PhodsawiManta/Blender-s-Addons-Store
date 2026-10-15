const videoPathPattern = /^vps:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm))$/;

export function parseVideoPath(path: string) {
  const match = videoPathPattern.exec(path);
  return match ? { productId: match[1], filename: match[2], extension: match[3] } : null;
}

export function vpsVideoUrl(path: string) {
  const video = parseVideoPath(path);
  return video ? `/media/videos/${video.productId}/${video.filename}` : undefined;
}

export const VIDEO_CHUNK_BYTES = 4 * 1024 * 1024;
