"use client";

import { useEffect } from "react";
import { useShop } from "@/components/providers";

export function ClearCartOnSuccess() {
  const { cartHydrated, clearCart } = useShop();

  useEffect(() => {
    if (cartHydrated) clearCart();
  }, [cartHydrated, clearCart]);

  return null;
}
