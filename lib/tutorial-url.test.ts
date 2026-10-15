import { describe, expect, it } from "vitest";
import { youtubeEmbedUrl } from "@/lib/tutorial-url";

describe("youtubeEmbedUrl", () => {
  it.each([
    "https://youtu.be/EBlvgaQ4zfM",
    "https://www.youtube.com/watch?v=EBlvgaQ4zfM",
    "https://youtube.com/shorts/EBlvgaQ4zfM",
    "https://m.youtube.com/live/EBlvgaQ4zfM",
    "https://www.youtube-nocookie.com/embed/EBlvgaQ4zfM"
  ])("creates an embeddable privacy-enhanced URL from %s", (url) => {
    expect(youtubeEmbedUrl(url)).toBe(
      "https://www.youtube-nocookie.com/embed/EBlvgaQ4zfM?rel=0"
    );
  });

  it.each([
    "https://example.com/watch?v=EBlvgaQ4zfM",
    "https://youtube.com/watch?v=invalid",
    "javascript:alert(1)",
    "not a url"
  ])("does not embed unsupported or invalid URLs: %s", (url) => {
    expect(youtubeEmbedUrl(url)).toBeUndefined();
  });
});
