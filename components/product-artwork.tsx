import { Box, CircleDashed, Layers3, Sparkles } from "lucide-react";
import type { ArtworkTone } from "@/lib/types";
import { cn } from "@/lib/utils";

const themes: Record<ArtworkTone, string> = {
  orange: "from-[#32170b] via-[#16110e] to-[#0a0b0c]",
  blue: "from-[#0d2038] via-[#10161d] to-[#090a0c]",
  violet: "from-[#25133c] via-[#151019] to-[#090a0b]",
  mint: "from-[#0a3028] via-[#101816] to-[#090b0a]",
  sand: "from-[#332516] via-[#18140e] to-[#090a0b]"
};

const accents: Record<ArtworkTone, string> = {
  orange: "bg-forge shadow-[0_0_70px_rgba(244,123,32,.42)]",
  blue: "bg-[#4d9fff] shadow-[0_0_70px_rgba(77,159,255,.38)]",
  violet: "bg-[#a867ff] shadow-[0_0_70px_rgba(168,103,255,.34)]",
  mint: "bg-[#44d2a8] shadow-[0_0_70px_rgba(68,210,168,.32)]",
  sand: "bg-[#e0a35c] shadow-[0_0_70px_rgba(224,163,92,.34)]"
};

export function ProductArtwork({
  tone,
  className,
  label,
  imageUrl,
  naturalSize = false
}: {
  tone: ArtworkTone;
  className?: string;
  label?: string;
  imageUrl?: string;
  naturalSize?: boolean;
}) {
  if (imageUrl) {
    if (naturalSize) {
      return (
        <div className={cn("overflow-hidden", className)}>
          <img
            className="block h-auto w-full"
            src={imageUrl}
            alt={label ?? ""}
          />
        </div>
      );
    }

    return (
      <div className={cn("relative isolate overflow-hidden bg-black", className)}>
        {/* Images are supplied by the owner's public Supabase media bucket. */}
        <img
          aria-hidden="true"
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl"
          src={imageUrl}
        />
        <img
          className="relative h-full w-full object-contain"
          src={imageUrl}
          alt={label ?? ""}
        />
      </div>
    );
  }

  return (
    <div className={cn("noise relative isolate overflow-hidden bg-gradient-to-br", themes[tone], className)} aria-label={label}>
      <div className="grid-lines absolute inset-0 opacity-60" />
      <div className="absolute inset-x-[20%] bottom-[13%] h-[12%] rounded-[50%] bg-black/80 blur-xl" />
      <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 animate-float [transform-style:preserve-3d]">
        <div className={cn("absolute inset-7 rotate-45 rounded-[28%] opacity-90", accents[tone])} />
        <div className="absolute inset-0 rotate-[22deg] rounded-[34%] border border-white/25 bg-white/[0.035] backdrop-blur-[2px]" />
        <div className="absolute inset-[18%] -rotate-[15deg] rounded-2xl border border-white/25 bg-black/20" />
        <Box className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90" size={42} strokeWidth={1.25} />
      </div>
      <CircleDashed className="absolute left-[15%] top-[18%] text-white/15" size={54} strokeWidth={0.7} />
      <Layers3 className="absolute bottom-[14%] right-[12%] text-white/20" size={32} strokeWidth={0.8} />
      <Sparkles className="absolute right-[22%] top-[18%] text-white/35" size={20} strokeWidth={1} />
      <div className="absolute bottom-3 left-3 rounded border border-white/10 bg-black/35 px-2 py-1 text-[0.55rem] font-bold uppercase tracking-[.16em] text-white/45">
        Built in Blender
      </div>
    </div>
  );
}
