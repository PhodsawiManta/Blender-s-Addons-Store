"use client";

import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import { ProductArtwork } from "@/components/product-artwork";
import { formatPrice } from "@/lib/commerce";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link className="card-hover group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-panel" href={`/product/${product.slug}`}>
      <ProductArtwork tone={product.artwork} imageUrl={product.imageUrl} label={`${product.title} product artwork`} className="aspect-[16/10] border-b border-line" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.13em] text-forge-soft">
            {product.category}
          </span>
          {product.badge && <span className="rounded bg-white/[0.055] px-2 py-1 text-[0.58rem] font-bold uppercase tracking-wider text-zinc-400">{product.badge}</span>}
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[1.12rem] font-bold tracking-[-0.035em] text-white">{product.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">{product.description || product.eyebrow}</p>
          </div>
          <ArrowUpRight className="mt-1 shrink-0 text-zinc-600 transition group-hover:text-forge" size={17} />
        </div>
        <p className="mb-5 mt-4 text-xs leading-5 text-zinc-400">{product.blenderVersions?.length ? `Blender ${product.blenderVersions.join(", ")}` : "See details for compatibility"}</p>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
          <span className="text-lg font-bold">{formatPrice(product)}</span>
          {product.rating > 0 && (
            <span className="flex items-center gap-1 text-[0.68rem] font-semibold text-zinc-500">
              <Star size={12} className="fill-forge text-forge" /> {product.rating}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 text-xs"><span className="text-zinc-400">{product.isFree ? product.requiresLogin ? "Sign in to add to your library" : "Direct download · No sign-in" : "Purchase to download"}</span><span className="shrink-0 font-semibold text-forge-soft">View details →</span></div>
      </div>
    </Link>
  );
}
