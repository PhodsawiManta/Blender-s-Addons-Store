import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LibraryView } from "@/components/library-view";
import { SignOutButton } from "@/components/sign-out-button";
import { requireUser } from "@/lib/auth";
import { getLibraryData } from "@/lib/library";

export const metadata: Metadata = { title: "My downloads" };
export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const profile = await requireUser();
  const library = await getLibraryData(profile.id);
  const { notice } = await searchParams;

  return (
    <section className="shell py-14">
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Welcome back, {profile.displayName}</p>
          <h1 className="section-title mt-4">My downloads</h1>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p className="text-xs text-zinc-600">{profile.email}</p>
          <div className="flex flex-wrap gap-2">
            {profile.role === "admin" && (
              <Link className="button-primary !min-h-9 !px-3 text-xs" href="/admin">
                <ShieldCheck size={14} /> Open admin
              </Link>
            )}
            <SignOutButton
              className="button-secondary !min-h-9 !px-3 text-xs"
              redirectTo="/auth"
            />
          </div>
        </div>
      </div>
      {notice === "admin-required" && profile.role !== "admin" && (
        <p
          className="mt-6 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-200"
          role="status"
        >
          This account does not have administrator access.
        </p>
      )}
      <div className="mt-8"><LibraryView {...library} /></div>
    </section>
  );
}
