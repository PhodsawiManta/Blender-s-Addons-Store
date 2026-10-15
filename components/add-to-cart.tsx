"use client";

import { ArrowRight, Download, LoaderCircle, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useShop } from "@/components/providers";
import type { Product } from "@/lib/types";

export function AddToCart({ product }: { product: Product }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, addToCart } = useShop();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const attemptedAutoClaim = useRef(false);
  const added = cart.some((item) => item.productId === product.id);

  const claimFreeAddon = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/products/${product.id}/claim`, { method: "POST" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (response.status === 401) {
        const returnPath = `/product/${product.slug}?claim=1`;
        router.push(`/auth?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "Could not claim this add-on.");
      router.push("/library");
      router.refresh();
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not claim this add-on.");
      setLoading(false);
    }
  }, [product.id, product.slug, router]);

  const downloadFreeAddon = useCallback(async () => {
    const latestVersion = product.versions?.[0];
    if (!latestVersion) {
      setError("No published download is available yet.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/download/${latestVersion.id}`, { cache: "no-store" });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Download is unavailable.");
      }
      window.location.assign(data.url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Download is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [product.versions]);

  useEffect(() => {
    if (
      product.isFree
      && product.requiresLogin
      && searchParams.get("claim") === "1"
      && !attemptedAutoClaim.current
    ) {
      attemptedAutoClaim.current = true;
      void claimFreeAddon();
    }
  }, [claimFreeAddon, product.isFree, product.requiresLogin, searchParams]);

  function handleClick() {
    if (product.isFree) {
      void (product.requiresLogin ? claimFreeAddon() : downloadFreeAddon());
      return;
    }
    if (added) {
      router.push("/cart");
      return;
    }
    addToCart(product.id);
  }

  return (
    <>
      <button className="button-primary w-full" disabled={loading} onClick={handleClick} type="button">
        {loading
          ? <LoaderCircle className="animate-spin" size={17} />
          : product.isFree
            ? <Download size={17} />
            : added
              ? <ArrowRight size={17} />
              : <ShoppingBag size={17} />}
        {loading
          ? product.isFree && !product.requiresLogin ? "Preparing download..." : "Adding to your library..."
          : product.isFree
            ? product.requiresLogin ? "Get free download" : "Download now — Free"
            : added
              ? "View cart"
              : "Add to cart"}
      </button>
      {error && (
        <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </>
  );
}
