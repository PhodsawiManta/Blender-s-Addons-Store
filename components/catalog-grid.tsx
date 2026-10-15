"use client";

import { Search, SearchX, PackageOpen, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";

export function CatalogGrid({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const categories = Array.from(new Set(products.map((product) => product.category)));
  const filtered = useMemo(() => products.filter((product) => {
    const haystack = `${product.title} ${product.eyebrow} ${product.description} ${product.category}`.toLowerCase();
    return (category === null || product.category === category) && (!freeOnly || product.isFree) && haystack.includes(query.trim().toLowerCase());
  }), [products, category, query, freeOnly]);
  const hasFilters = query !== "" || category !== null || freeOnly;
  function resetFilters() { setQuery(""); setCategory(null); setFreeOnly(false); }

  return (
    <>
      <div className="mt-7 rounded-xl border border-line bg-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1">
            <span className="mb-2 block text-sm font-semibold">Find an add-on</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={19} />
              <input type="search" className="field !pl-11 text-sm" placeholder="Search by name, feature, or category…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </span>
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line px-4 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-[#f47b20]" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} />Free add-ons only</label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
          {[null, ...categories].map((item) => <button aria-pressed={category === item} className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold transition ${category === item ? "border-forge/40 bg-forge/15 text-forge-soft" : "border-line text-zinc-300 hover:border-zinc-500 hover:bg-white/5"}`} key={item ?? "all-categories"} onClick={() => setCategory(item)} type="button">{item ?? "All categories"}</button>)}
        </div>
      </div>
      <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
        <p role="status" aria-live="polite"><span className="font-semibold text-white">{filtered.length}</span> of {products.length} add-ons{category ? ` in ${category}` : ""}</p>
        {hasFilters && <button className="button-ghost !min-h-11 !py-2" onClick={resetFilters} type="button"><X size={15} />Clear filters</button>}
      </div>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
      {filtered.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-line bg-panel/40 px-5 py-14 text-center">
        {products.length ? <SearchX className="mx-auto text-zinc-400" size={32} /> : <PackageOpen className="mx-auto text-zinc-400" size={32} />}
        <h3 className="mt-4 text-lg font-bold">{products.length ? "No matching add-ons" : "New add-ons are on the way"}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{products.length ? "Try a different search or clear your filters to see all add-ons." : "Check back soon to explore the toolkit."}</p>
        {hasFilters && <button className="button-secondary mt-5" onClick={resetFilters} type="button">Clear all filters</button>}
      </div>}
    </>
  );
}
