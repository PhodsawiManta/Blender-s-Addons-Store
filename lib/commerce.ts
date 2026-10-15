import type { CartItem, Product } from "@/lib/types";

export function formatPrice(product: Product) {
  const amount = product.price.usd;
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function cartTotal(items: CartItem[], catalog: Product[]) {
  return items.reduce((total, item) => {
    const product = catalog.find((candidate) => candidate.id === item.productId);
    if (!product) return total;
    return total + product.price.usd * item.quantity;
  }, 0);
}

export function canAccessProduct({
  isPreview = false,
  hasEntitlement = false
}: {
  isPreview?: boolean;
  hasEntitlement?: boolean;
}) {
  return isPreview || hasEntitlement;
}

export function sanitizeCart(items: CartItem[], catalog: Product[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) return false;
    if (seen.has(item.productId)) return false;
    seen.add(item.productId);
    return catalog.some((product) => product.id === item.productId && product.status === "PUBLISHED");
  });
}
