import type { Metadata } from "next";
import { CatalogGrid } from "@/components/catalog-grid";
import { getPublishedProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Blender Add-ons",
  description: "Production-ready Blender add-ons for modeling, materials, lighting, and environments."
};

export default async function AddonsPage() {
  const addons = await getPublishedProducts("ADDON");

  return (
    <section className="shell py-10 sm:py-14">
      <p className="eyebrow">Aoupa toolkit</p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Blender add-ons</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
        Find a tool for your next project. Open an add-on to see its features, Blender compatibility, and download options.
      </p>
      <CatalogGrid products={addons} />
    </section>
  );
}
