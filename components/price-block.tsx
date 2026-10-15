import { formatPrice } from "@/lib/commerce";
import type { Product } from "@/lib/types";

export function PriceBlock({ product }: { product: Product }) {
  return (
    <div className="mt-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-[0.62rem] font-bold uppercase tracking-wider text-zinc-600">
          {product.isFree ? "Account access" : "One-time purchase"}
        </p>
        <p className="mt-1 text-3xl font-black tracking-[-0.04em]">{formatPrice(product)}</p>
      </div>
      {product.price.usd > 0 && <p className="pb-1 text-[0.66rem] text-zinc-600">USD</p>}
    </div>
  );
}
