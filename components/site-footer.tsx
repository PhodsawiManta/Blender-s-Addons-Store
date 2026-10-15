import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const columns = [
  {
    title: "Explore",
    links: [["Add-ons", "/addons"], ["My downloads", "/library"]]
  },
  {
    title: "Company",
    links: [["Contact", "/contact"], ["Privacy", "/privacy"], ["Terms", "/terms"]]
  }
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-[#0a0b0d]">
      <div className="shell grid gap-12 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <BrandMark />
          <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-500">
            Thoughtful Blender tools with secure downloads, clear documentation, and dependable updates.
          </p>
          {/* <a className="mt-5 inline-block text-xs font-bold text-forge-soft hover:text-white" href="mailto:support@aoupa.online">
            support@aoupa.online
          </a> */}
          <a className="mt-5 inline-block text-xs font-bold text-forge-soft hover:text-white" href="https://aoupa.online/contact">
            Report an issue or request support
          </a>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-300">{column.title}</p>
            <div className="mt-4 grid gap-3">
              {column.links.map(([label, href]) => (
                <Link className="flex w-fit items-center gap-1 text-sm text-zinc-500 transition hover:text-white" href={href} key={label}>
                  {label}<ArrowUpRight size={12} />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="shell flex flex-col gap-2 border-t border-line py-5 text-[0.68rem] text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Aoupa. All rights reserved.</p>
        <p>Aoupa is not affiliated with or endorsed by the Blender Foundation.</p>
      </div>
    </footer>
  );
}
