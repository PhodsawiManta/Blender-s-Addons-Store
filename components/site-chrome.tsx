"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = pathname.startsWith("/admin") || pathname.startsWith("/learn");
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      {!immersive && <SiteHeader />}
      <main id="main-content" tabIndex={-1}>{children}</main>
      {!immersive && <SiteFooter />}
    </>
  );
}
