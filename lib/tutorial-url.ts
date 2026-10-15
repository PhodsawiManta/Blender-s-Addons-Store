const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeVideoId(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0];
  }

  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "youtube-nocookie.com") {
    return undefined;
  }

  if (url.pathname === "/watch") return url.searchParams.get("v") ?? undefined;

  const [kind, id] = url.pathname.split("/").filter(Boolean);
  if (["embed", "shorts", "live"].includes(kind)) return id;

  return undefined;
}

export function youtubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;

    const videoId = youtubeVideoId(url);
    if (!videoId || !YOUTUBE_VIDEO_ID.test(videoId)) return undefined;

    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
  } catch {
    return undefined;
  }
}
