"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/lib/types";

interface ShopContextValue {
  cart: CartItem[];
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartHydrated: boolean;
}

const ShopContext = createContext<ShopContextValue | null>(null);

function parseStoredCart(value: string): CartItem[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  return parsed.flatMap((item) => {
    if (
      !item
      || typeof item !== "object"
      || typeof (item as { productId?: unknown }).productId !== "string"
      || (item as { quantity?: unknown }).quantity !== 1
    ) return [];
    const productId = (item as { productId: string }).productId;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)
      || seen.has(productId)
    ) return [];
    seen.add(productId);
    return seen.size <= 20 ? [{ productId, quantity: 1 }] : [];
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedCart = window.localStorage.getItem("aoupa:cart");
    if (storedCart) {
      try {
        setCart(parseStoredCart(storedCart));
      } catch {
        window.localStorage.removeItem("aoupa:cart");
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("aoupa:cart", JSON.stringify(cart));
  }, [cart, hydrated]);

  const addToCart = useCallback((productId: string) => {
    setCart((current) => current.some((item) => item.productId === productId)
      ? current
      : [...current, { productId, quantity: 1 }]);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((current) => current.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const value = useMemo(() => ({
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    cartHydrated: hydrated
  }), [addToCart, cart, clearCart, hydrated, removeFromCart]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error("useShop must be used within Providers");
  return context;
}
