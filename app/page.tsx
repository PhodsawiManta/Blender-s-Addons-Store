import Link from "next/link";
import { ArrowRight, Download, LifeBuoy } from "lucide-react";
import { CatalogGrid } from "@/components/catalog-grid";
import { getPublishedProducts } from "@/lib/catalog";

export default async function HomePage() {
  const addons = await getPublishedProducts("ADDON");
  return (
    <>
      <section className="border-b border-line bg-panel/40">
        <div className="shell grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow">Tools for Blender</p>
            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-bold leading-[1.12] tracking-tight sm:text-6xl">Find your next<br /><span className="text-forge-soft">Blender add-on.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-300">Browse tools, check compatibility, and get the download you need. Everything starts here.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a className="button-primary" href="#addons">Browse add-ons <ArrowRight size={17} /></a>
              <Link className="button-secondary" href="/library"><Download size={17} /> My downloads</Link>
            </div>
          </div>
          <aside className="rounded-2xl border border-line bg-panel p-6 sm:p-8" aria-labelledby="getting-started">
            <h2 id="getting-started" className="text-lg font-bold">First time here?</h2>
            <ol className="mt-6 space-y-6">
              {[
                ["Choose an add-on", "Read what it does and check your Blender version."],
                ["Get your download", "Download directly, or sign in when required."],
                ["Follow the guide", "Open the add-on’s instructions to get started."]
              ].map(([title, description], index) => (
                <li className="flex gap-4" key={title}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forge/10 text-sm font-bold text-forge-soft">{index + 1}</span><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p></div></li>
              ))}
            </ol>
          </aside>
        </div>
      </section>
      <section id="addons" className="shell scroll-mt-24 py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">The toolkit</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Explore add-ons</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Search by name or choose a category to find a tool for your project.</p></div>
          <Link className="button-ghost" href="/addons">Open full catalog <ArrowRight size={16} /></Link>
        </div>
        <CatalogGrid products={addons} />
      </section>
      <section className="shell">
        <div className="flex flex-col gap-5 rounded-2xl border border-line bg-panel p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-center gap-4"><LifeBuoy size={28} className="shrink-0 text-forge-soft" /><div><h2 className="text-lg font-bold">Need help getting started?</h2><p className="mt-1 text-sm leading-6 text-zinc-400">Get help with your account, downloads, or an add-on.</p></div></div>
          <Link className="button-secondary shrink-0" href="/contact">Contact support <ArrowRight size={16} /></Link>
        </div>
      </section>
    </>
  );
}
