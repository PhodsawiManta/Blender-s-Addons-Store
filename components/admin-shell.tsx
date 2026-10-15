"use client";

import Link from "next/link";
import { Boxes, ExternalLink, HandHeart, LayoutDashboard, Menu, PackagePlus, ReceiptText, Settings, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/sign-out-button";
import type { Profile } from "@/lib/types";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Manage add-ons", icon: Boxes },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
  { href: "/admin/donations", label: "Donations", icon: HandHeart },
  { href: "/admin/customers", label: "Customers", icon: UsersRound }
];

function initialsFor(profile: Profile) {
  const parts = profile.displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || profile.email.slice(0, 2)).toUpperCase();
}

function Sidebar({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-[#0d0f11]">
      <div className="flex h-[4.4rem] items-center border-b border-line px-5"><BrandMark /></div>
      <div className="p-3">
        <div className="mb-3 rounded-md border border-forge/15 bg-forge/[0.05] px-3 py-2">
          <span className="text-[0.58rem] font-bold uppercase tracking-wider text-forge-soft">Aoupa administration</span>
        </div>
        <nav className="grid gap-1">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${active ? "bg-forge/15 text-forge-soft" : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"}`}
                href={item.href}
                key={item.href}
                onClick={onNavigate}
              >
                <item.icon size={15} />{item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto border-t border-line p-3">
        <Link className="flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-semibold text-zinc-500 hover:bg-white/[0.04] hover:text-white" href="/admin/settings" onClick={onNavigate}><Settings size={15} />Settings</Link>
        <Link className="flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-semibold text-zinc-500 hover:bg-white/[0.04] hover:text-white" href="/" onClick={onNavigate}><ExternalLink size={15} />View storefront</Link>
        <div className="mt-3 rounded-md border border-line p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-forge text-xs font-black text-ink">{initialsFor(profile)}</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{profile.displayName}</p>
              <p className="truncate text-[0.58rem] text-zinc-600">{profile.email}</p>
            </div>
          </div>
          <SignOutButton className="button-ghost mt-3 w-full !min-h-8 !px-2 text-[0.66rem]" redirectTo="/auth" />
        </div>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  title,
  description,
  profile,
  action
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  profile: Profile;
  action?: React.ReactNode;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <div className="admin-workspace min-h-screen bg-[#090a0c] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line lg:block"><Sidebar profile={profile} /></aside>
      {mobileNav && (
        <>
          <aside className="fixed inset-y-0 left-0 z-[80] w-[min(86vw,280px)] border-r border-line shadow-2xl lg:hidden"><Sidebar profile={profile} onNavigate={() => setMobileNav(false)} /></aside>
          <button className="fixed inset-0 z-[70] bg-black/70 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close admin navigation" />
        </>
      )}
      <div className="min-w-0">
        <header className="flex min-h-24 flex-wrap items-center justify-between gap-4 border-b border-line bg-panel/40 px-4 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <button className="button-secondary !min-h-11 !px-2.5 lg:hidden" onClick={() => setMobileNav((value) => !value)} aria-expanded={mobileNav} aria-label="Toggle admin navigation"><Menu size={18} /></button>
            <div>
              <p className="mb-1 text-xs font-semibold text-forge-soft">Store administration</p>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
            </div>
          </div>
          {action}
        </header>
        <div className="p-4 sm:p-7">{children}</div>
      </div>
    </div>
  );
}

export function AdminActionButton({
  children,
  onClick,
  disabled = false
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return <button className="button-primary !min-h-9 !px-3" disabled={disabled} type="button" onClick={onClick}><PackagePlus size={14} />{children}</button>;
}
