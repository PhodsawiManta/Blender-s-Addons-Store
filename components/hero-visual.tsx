import { Box, ChevronRight, CircleDotDashed, Move3d, Orbit, Sparkles } from "lucide-react";

export function HeroVisual() {
  return (
    <div className="noise relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[#0d0f12] shadow-2xl">
      <div className="grid-lines absolute inset-0" />
      <div className="absolute left-1/2 top-1/2 h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />
      <div className="absolute left-1/2 top-1/2 h-[54%] w-[54%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.09]" />
      <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 animate-float">
        <div className="absolute inset-0 rotate-[24deg] rounded-[34%] border border-forge-soft/55 bg-gradient-to-br from-forge via-[#b54b0e] to-[#321407] shadow-[0_0_100px_rgba(244,123,32,.28)]" />
        <div className="absolute inset-[14%] -rotate-[18deg] rounded-3xl border border-white/30 bg-black/25 backdrop-blur-sm" />
        <div className="absolute inset-[31%] rotate-45 rounded-xl bg-ink shadow-xl" />
        <Box className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white" size={36} strokeWidth={1.2} />
      </div>
      <div className="absolute left-1/2 top-1/2 animate-orbit">
        <span className="block h-3 w-3 rounded-full bg-forge-soft shadow-[0_0_18px_#f47b20]" />
      </div>
      <div className="absolute left-[12%] top-[16%] rounded-lg border border-white/10 bg-black/35 p-2.5 text-zinc-400 backdrop-blur">
        <Move3d size={20} strokeWidth={1.2} />
      </div>
      <div className="absolute right-[10%] top-[18%] rounded-lg border border-white/10 bg-black/35 p-2.5 text-zinc-400 backdrop-blur">
        <Orbit size={20} strokeWidth={1.2} />
      </div>
      <div className="absolute bottom-[15%] left-[10%] rounded-lg border border-white/10 bg-black/35 p-2.5 text-zinc-400 backdrop-blur">
        <CircleDotDashed size={20} strokeWidth={1.2} />
      </div>
      <div className="absolute bottom-[10%] right-[9%] w-40 rounded-lg border border-white/10 bg-black/45 p-3 backdrop-blur">
        <div className="flex items-center justify-between text-[0.55rem] font-bold uppercase tracking-wider text-zinc-500">
          <span>Modifier stack</span><Sparkles size={11} className="text-forge" />
        </div>
        <div className="mt-2 grid gap-1.5">
          {["Bevel control", "Weighted normal", "Radial array"].map((label) => (
            <div key={label} className="flex items-center gap-1.5 rounded bg-white/[0.045] px-2 py-1.5 text-[0.58rem] text-zinc-400">
              <ChevronRight size={9} className="text-forge" />{label}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
    </div>
  );
}
