"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle, LockKeyhole, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductArtwork } from "@/components/product-artwork";
import { useShop } from "@/components/providers";
import { cartTotal, formatPrice } from "@/lib/commerce";
import type { Product } from "@/lib/types";

export function CartView({ products }: { products: Product[] }) {
  const router = useRouter();
  const { cart, removeFromCart } = useShop();
  const [loading, setLoading] = useState(false);
  const selected = cart.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? [{ product, quantity: item.quantity }] : [];
  });
  const subtotal = cartTotal(cart, products);

  async function checkout() {
    setLoading(true);
    try {
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: selected.map(({ product }) => ({
            productId: product.id,
            quantity: 1
          }))
        })
      });
      const data = await response.json() as { url?: string; error?: string };
      if (response.status === 401) {
        router.push(`/auth?next=${encodeURIComponent("/cart")}`);
        return;
      }
      if (!response.ok || !data.url) throw new Error(data.error ?? "Unable to start checkout");
      window.location.assign(data.url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to start checkout");
      setLoading(false);
    }
  }

  if (selected.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line py-20 text-center">
        <ShoppingBag className="mx-auto text-zinc-700" size={38} strokeWidth={1.2} />
        <h2 className="mt-5 text-xl font-bold tracking-tight">Your cart is waiting.</h2>
        <p className="mt-2 text-sm text-zinc-600">Find an add-on for your next project.</p>
        <Link className="button-primary mt-6" href="/addons">Explore add-ons <ArrowRight size={15} /></Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="overflow-hidden rounded-xl border border-line">
        {selected.map(({ product }) => (
          <div className="flex gap-4 border-b border-line bg-panel p-4 last:border-b-0" key={product.id}>
            <ProductArtwork imageUrl={product.imageUrl} tone={product.artwork} className="h-24 w-28 shrink-0 rounded-lg border border-line sm:h-28 sm:w-36" />
            <div className="min-w-0 flex-1 py-1">
              <p className="text-[0.6rem] font-bold uppercase tracking-wider text-forge-soft">{product.type} · {product.category}</p>
              <Link href={`/product/${product.slug}`} className="mt-2 block truncate text-base font-bold hover:text-forge-soft">{product.title}</Link>
              <p className="mt-2 text-sm font-black">{formatPrice(product)}</p>
            </div>
            <button className="button-ghost h-fit !min-h-9 !px-2.5 text-zinc-600 hover:text-red-400" onClick={() => removeFromCart(product.id)} aria-label={`Remove ${product.title}`}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <aside className="h-fit rounded-xl border border-line bg-panel p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">Order summary</p>
        <div className="mt-5 grid gap-3 border-b border-line pb-5 text-xs text-zinc-500">
          <div className="flex justify-between"><span>Subtotal</span><span className="text-zinc-300">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(subtotal)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span className="text-zinc-300">Digital</span></div>
        </div>
        <div className="flex items-end justify-between py-5">
          <span className="text-sm font-bold">Total</span>
          <span className="text-2xl font-black tracking-tight">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(subtotal)}</span>
        </div>
        <button className="button-primary w-full" onClick={checkout} disabled={loading} type="button">
          {loading ? <LoaderCircle className="animate-spin" size={16} /> : <LockKeyhole size={15} />}
          {loading ? "Preparing checkout..." : "Secure checkout"}
        </button>
        <p className="mt-4 text-center text-[0.62rem] leading-4 text-zinc-600">Payments are processed securely by Stripe in USD.</p>
      </aside>
    </div>
  );
}
