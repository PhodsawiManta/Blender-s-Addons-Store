import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        alt=""
        className="h-8 w-8 rounded-md object-contain shadow-glow"
        height={32}
        src="/favicon.ico"
        width={32}
      />
      {!compact && (
        <span className="text-[1.02rem] font-extrabold tracking-[-0.04em]">
          Aou<span className="text-forge">pa</span>
        </span>
      )}
    </span>
  );
}
