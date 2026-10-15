import { describe, expect, it } from "vitest";
import { canAccessProduct, cartTotal, formatPrice, sanitizeCart } from "@/lib/commerce";
import type { Product } from "@/lib/types";

function product(id: string, usd: number, status: Product["status"] = "PUBLISHED"): Product {
  return {
    id,
    slug: id,
    type: "ADDON",
    status,
    title: id,
    eyebrow: "",
    description: "Description",
    longDescription: "Long description",
    price: { usd },
    isFree: usd === 0,
    requiresLogin: true,
    category: "Utility",
    rating: 0,
    downloadCount: 0,
    artwork: "orange",
    media: [],
    features: [],
    guide: ""
  };
}

const products = [product("one", 29), product("two", 19), product("free", 0)];

describe("commerce helpers", () => {
  it("formats USD and free prices", () => {
    expect(formatPrice(products[0])).toBe("$29.00");
    expect(formatPrice(product("cents", 9.99))).toBe("$9.99");
    expect(formatPrice(products[2])).toBe("Free");
  });

  it("calculates cart totals in USD", () => {
    const items = [{ productId: products[0].id, quantity: 1 }, { productId: products[1].id, quantity: 2 }];
    expect(cartTotal(items, products)).toBe(67);
  });

  it("removes duplicate, missing, and invalid cart items", () => {
    const items = [
      { productId: products[0].id, quantity: 1 },
      { productId: products[0].id, quantity: 1 },
      { productId: "missing", quantity: 1 },
      { productId: products[1].id, quantity: 0 }
    ];
    expect(sanitizeCart(items, products)).toEqual([{ productId: products[0].id, quantity: 1 }]);
  });

  it("requires a preview or entitlement for access", () => {
    expect(canAccessProduct({ isPreview: true })).toBe(true);
    expect(canAccessProduct({ hasEntitlement: true })).toBe(true);
    expect(canAccessProduct({})).toBe(false);
  });
});
