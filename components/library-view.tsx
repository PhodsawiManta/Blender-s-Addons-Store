"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Download, Layers3, LayoutGrid, List, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductArtwork } from "@/components/product-artwork";
import type { Product } from "@/lib/types";

type ViewMode = "grid" | "list";

const LIBRARY_VIEW_KEY = "aoupa-library-view";

export function LibraryView({
  addons,
  downloadCount
}: {
  addons: Product[];
  downloadCount: number;
}) {
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    try {
      const savedView = window.localStorage.getItem(LIBRARY_VIEW_KEY);
      if (savedView === "grid" || savedView === "list") setViewMode(savedView);
    } catch {
      // The view still works when browser storage is unavailable.
    }
  }, []);

  function changeView(view: ViewMode) {
    setViewMode(view);
    try {
      window.localStorage.setItem(LIBRARY_VIEW_KEY, view);
    } catch {
      // Keep the in-memory preference for this visit.
    }
  }

  async function download(versionId: string) {
    setDownloading(versionId);
    setDownloadError(null);
    try {
      const response = await fetch(`/api/download/${versionId}`, { cache: "no-store" });
      const data = await response.json() as { url?: string; error?: string };
      if (response.status === 401) {
        router.push(`/auth?next=${encodeURIComponent("/library")}`);
        return;
      }
      if (!response.ok || !data.url) throw new Error(data.error ?? "Download is unavailable.");
      window.location.assign(data.url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download is unavailable. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  if (addons.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line py-20 text-center">
        <Layers3 className="mx-auto text-zinc-700" size={38} strokeWidth={1.2} />
        <h2 className="mt-5 text-xl font-bold tracking-tight">No saved add-ons yet</h2>
        <p className="mx-auto mt-3 max-w-md px-4 text-sm leading-6 text-zinc-400">Browse the catalog and add a tool to your library. Your saved add-ons and their downloads will appear here.</p>
        <Link className="button-primary mt-6" href="/addons">
          Browse add-ons <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <section>
      {downloadError && <p role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{downloadError} Select Download to try again.</p>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Your toolkit</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Add-ons & downloads</h2>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <p className="text-xs text-zinc-600">{downloadCount.toLocaleString("en-US")} downloads</p>
          <div
            aria-label="Library view"
            className="flex rounded-lg border border-line bg-panel p-1"
            role="group"
          >
            <button
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={`grid h-8 w-8 place-items-center rounded-md transition ${viewMode === "grid" ? "bg-forge text-black" : "text-zinc-500 hover:bg-white/[0.05] hover:text-white"}`}
              onClick={() => changeView("grid")}
              title="Grid view"
              type="button"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={`grid h-8 w-8 place-items-center rounded-md transition ${viewMode === "list" ? "bg-forge text-black" : "text-zinc-500 hover:bg-white/[0.05] hover:text-white"}`}
              onClick={() => changeView("list")}
              title="List view"
              type="button"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className={`mt-5 grid gap-4 ${viewMode === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
        {addons.map((product) => {
          const latest = product.versions?.[0];
          const isDownloading = downloading === latest?.id;
          const downloadButton = (
            <button
              className={`button-secondary w-full !min-h-9 !px-3 ${viewMode === "list" ? "sm:w-auto sm:justify-self-end" : "mt-5"}`}
              type="button"
              disabled={!latest || downloading !== null}
              onClick={() => latest && void download(latest.id)}
            >
              {isDownloading
                ? <LoaderCircle className="animate-spin" size={13} />
                : <Download size={13} />}
              {isDownloading ? "Preparing..." : latest ? "Download ZIP" : "Download not available yet"}
            </button>
          );

          return (
            <article
              className={viewMode === "grid"
                ? "flex h-full min-w-0 flex-col rounded-xl border border-line bg-panel p-3"
                : "grid min-w-0 gap-4 rounded-xl border border-line bg-panel p-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center"}
              key={product.id}
            >
              <ProductArtwork
                tone={product.artwork}
                imageUrl={product.imageUrl}
                label={`${product.title} product artwork`}
                className={viewMode === "grid"
                  ? "aspect-[16/10] w-full rounded-lg border border-line"
                  : "aspect-[16/10] w-full rounded-lg border border-line sm:aspect-[4/3]"}
              />
              <div className={viewMode === "grid" ? "flex min-w-0 flex-1 flex-col px-1 pb-1 pt-4" : "min-w-0 px-1 py-1"}>
                <Link className="block truncate font-bold hover:text-forge-soft" href={`/product/${product.slug}`}>
                  {product.title}
                </Link>
                <p className="mt-1 text-[0.65rem] text-zinc-600">
                  {latest
                    ? `Version ${latest.version}${product.fileSize ? ` · ${product.fileSize}` : ""}`
                    : "No published version"}
                </p>
                {viewMode === "grid" && downloadButton}
              </div>
              {viewMode === "list" && downloadButton}
            </article>
          );
        })}
      </div>
    </section>
  );
}
