"use client";

import Link from "next/link";
import { Menu, ShoppingBag, Download, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { useShop } from "@/components/providers";

const links = [
  { href: "/addons", label: "Add-ons" },
  { href: "/library", label: "My downloads" },
  { href: "/contact", label: "Support" }
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { cartCount } = useShop();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink/85 backdrop-blur-xl">
      <div className="shell flex h-[4.4rem] items-center justify-between">
        <Link href="/" aria-label="Aoupa home"><BrandMark /></Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <Link key={link.href} aria-current={pathname === link.href ? "page" : undefined} className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${pathname === link.href ? "bg-forge/10 text-forge-soft" : "text-zinc-300 hover:bg-panel hover:text-white"}`} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link className="button-ghost relative !min-h-11 !px-2.5" href="/cart" aria-label={`Cart with ${cartCount} items`}>
            <ShoppingBag size={17} />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-forge px-1 text-[0.52rem] font-black leading-none text-black">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
          <Link className="button-ghost !min-h-11 !px-2.5 md:hidden" href="/library" aria-label="My downloads">
            <Download size={17} />
          </Link>
          <button className="button-ghost !min-h-11 !px-2.5 md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu" aria-expanded={open} aria-controls="mobile-navigation">
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="shell border-t border-line py-3 md:hidden">
          <nav id="mobile-navigation" aria-label="Mobile navigation" className="grid gap-1">
            {links.map((link) => (
              <Link key={link.href} className="rounded-md px-3 py-3 text-sm font-semibold text-zinc-300 hover:bg-panel" href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link className="rounded-md px-3 py-3 text-sm font-semibold text-forge-soft" href="/cart" onClick={() => setOpen(false)}>
              Cart{cartCount > 0 ? ` (${cartCount})` : ""}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
