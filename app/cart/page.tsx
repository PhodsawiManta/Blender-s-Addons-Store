import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { getPublishedProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const products = await getPublishedProducts();

  return (
    <section className="shell py-14">
      <p className="eyebrow">Your selection</p>
      <h1 className="section-title mt-4">Cart.</h1>
      <div className="mt-8"><CartView products={products.filter((product) => !product.isFree)} /></div>
    </section>
  );
}
