"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { ProductArtwork } from "@/components/product-artwork";
import type { ArtworkTone, ProductMediaItem } from "@/lib/types";

export function ProductMediaGallery({
  media,
  title,
  tone
}: {
  media: ProductMediaItem[];
  title: string;
  tone: ArtworkTone;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = media[selectedIndex] ?? media[0];

  if (!selected) {
    return (
      <ProductArtwork
        className="aspect-[4/3] rounded-2xl border border-line"
        label={`${title} product artwork`}
        tone={tone}
      />
    );
  }

  return (
    <div className="self-start">
      <div className="overflow-hidden rounded-2xl border border-line bg-black">
        {selected.type === "video" ? (
          <video
            aria-label={selected.alt}
            className="aspect-video w-full bg-black object-contain"
            controls
            key={selected.url}
            playsInline
            preload="metadata"
            src={selected.url}
          >
            Your browser does not support HTML video.
          </video>
        ) : (
          <img
            alt={selected.alt}
            className="block h-auto w-full"
            src={selected.url}
          />
        )}
      </div>

      {media.length > 1 && (
        <div className="scrollbar-thin mt-4 grid auto-cols-[minmax(112px,160px)] grid-flow-col justify-start gap-3 overflow-x-auto pb-2">
          {media.map((item, index) => (
            <button
              aria-label={`View ${item.type} ${index + 1} of ${media.length}`}
              aria-pressed={index === selectedIndex}
              className={`relative overflow-hidden rounded-lg border bg-black transition ${
                index === selectedIndex
                  ? "border-forge shadow-glow"
                  : "border-line opacity-70 hover:border-zinc-600 hover:opacity-100"
              }`}
              key={`${item.type}-${item.url}`}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              {item.type === "video" ? (
                <>
                  <video
                    aria-hidden="true"
                    className="aspect-video w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    src={item.url}
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/30">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-forge text-black">
                      <Play className="ml-0.5" fill="currentColor" size={14} />
                    </span>
                  </span>
                </>
              ) : (
                <img
                  alt=""
                  className="aspect-video w-full object-cover"
                  src={item.url}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
