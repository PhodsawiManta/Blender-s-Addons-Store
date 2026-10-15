import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";

export default function CheckoutCancelledPage() {
  return (
    <section className="shell grid min-h-[620px] place-items-center py-16 text-center">
      <div>
        <ShoppingBag className="mx-auto text-zinc-700" size={42} />
        <h1 className="section-title mt-6">Checkout paused.</h1>
        <p className="mt-4 text-sm text-zinc-500">Nothing was charged and your cart is still here.</p>
        <Link className="button-primary mt-7" href="/cart"><ArrowLeft size={15} /> Return to cart</Link>
      </div>
    </section>
  );
}
