import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Box, Download, ExternalLink, PlayCircle, Star } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AddToCart } from "@/components/add-to-cart";
import { DonationBox } from "@/components/donation-box";
import { ProductMediaGallery } from "@/components/product-media-gallery";
import { formatPrice } from "@/lib/commerce";
import { ProductCard } from "@/components/product-card";
import { ReviewSection } from "@/components/review-section";
import { getCurrentProfile } from "@/lib/auth";
import { getProductBySlug, getPublishedProducts } from "@/lib/catalog";
import { env, hasStripe } from "@/lib/env";
import { getProductReviews } from "@/lib/reviews";
import { youtubeEmbedUrl } from "@/lib/tutorial-url";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return { title: product.title, description: product.description };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [products, profile] = await Promise.all([
    getPublishedProducts("ADDON"),
    getCurrentProfile()
  ]);
  const reviewData = await getProductReviews(product.id, profile?.id);
  const related = products.filter((item) => item.id !== product.id).slice(0, 3);
  const tutorialEmbedUrl = product.tutorialUrl
    ? youtubeEmbedUrl(product.tutorialUrl)
    : undefined;

  return (
    <>
      <section className="shell py-8 sm:py-12">
        <Link className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 transition hover:text-white" href="/addons">
          <ArrowLeft size={14} /> Back to add-ons
        </Link>
        <div className="mt-7 grid items-start gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div className="min-w-0 rounded-2xl border border-line bg-panel p-5 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-forge/10 px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-forge-soft">{product.category}</span>
              {product.badge && <span className="rounded bg-white/[0.06] px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-zinc-400">{product.badge}</span>}
            </div>
            <h1 className="mt-3 break-words text-3xl font-bold leading-tight tracking-[-0.04em]">{product.title}</h1>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-bold">{formatPrice(product)}</span>
              <span className="text-xs text-zinc-400">{product.isFree ? "Free download" : "USD · One-time purchase"}</span>
            </div>
            <div className="mt-4"><AddToCart product={product} /></div>
            <p className="mt-2 text-xs leading-5 text-zinc-400">{product.isFree ? product.requiresLogin ? "Free account required. Download the ZIP from My downloads after signing in." : "ZIP download · No account required" : "Add to cart, then complete checkout to download."}</p>
            {(product.currentVersion || product.fileSize) && (
              <p className="mt-2 text-xs text-zinc-400">{[product.currentVersion && `v${product.currentVersion}`, product.fileSize].filter(Boolean).join(" · ")}</p>
            )}
            <div className="mt-4 border-t border-line pt-4 text-xs leading-5">
              <p className="text-zinc-300">{product.blenderVersions?.length ? `Blender ${product.blenderVersions.join(", ")}` : "See installation guide for compatibility."}</p>
              <a className="mt-1 inline-block text-zinc-400 underline underline-offset-4 hover:text-white" href="#installation">How to install</a>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">{product.description}</p>
            {(product.rating > 0 || product.downloadCount > 0) && <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
              {product.rating > 0 && <span className="flex items-center gap-1.5"><Star className="fill-forge text-forge" size={14} /> <b className="text-zinc-300">{product.rating}</b> from {reviewData.count.toLocaleString("en-US")} {reviewData.count === 1 ? "review" : "reviews"}</span>}
              {product.downloadCount > 0 && <span className="flex items-center gap-1.5"><Download size={14} /> {product.downloadCount.toLocaleString("en-US")} downloads</span>}
            </div>}
          </div>
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <ProductMediaGallery media={product.media} title={product.title} tone={product.artwork} />
          </div>

          <div className="border-t border-line pt-10 lg:col-start-1 lg:row-start-2">
            <p className="eyebrow">What you get</p>
            <h2 className="section-title mt-4">Built for real work.</h2>
            <p className="mt-5 text-sm leading-6 text-zinc-500">{product.longDescription}</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {product.features.map((feature, index) => (
                <div className="rounded-xl border border-line bg-panel/60 p-5" key={`${index}-${feature}`}>
                  <span className="text-[0.62rem] font-black text-forge">0{index + 1}</span>
                  <p className="mt-6 text-sm font-semibold leading-5 text-zinc-300">{feature}</p>
                </div>
              ))}
            </div>
            {product.isFree && (
              <details className="mt-6 rounded-xl border border-line p-4">
                <summary className="cursor-pointer text-sm font-medium text-zinc-400">Support this add-on · Optional donation</summary>
                <DonationBox enabled={env.paidCheckoutEnabled && hasStripe} productId={product.id} />
              </details>
            )}
          </div>
        </div>
      </section>

      {product.tutorialUrl && (
        <section className="shell py-20">
          <div className="grid gap-8 rounded-2xl border border-line bg-panel p-5 sm:p-8 lg:grid-cols-[1fr_320px]">
            <div>
              <p className="eyebrow">Video tutorial</p>
              <h2 className="section-title mt-4">See the add-on in action.</h2>
              {tutorialEmbedUrl ? (
                <div className="mt-7 aspect-video overflow-hidden rounded-xl border border-line bg-ink">
                  <iframe
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    src={tutorialEmbedUrl}
                    title={`${product.title} video tutorial`}
                  />
                </div>
              ) : (
                <a
                  aria-label={product.tutorialLabel || "Watch tutorial"}
                  className="group mt-7 grid aspect-video place-items-center rounded-xl border border-dashed border-line bg-ink transition hover:border-forge/60 hover:bg-forge/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forge"
                  href={product.tutorialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <PlayCircle className="text-forge transition group-hover:scale-110" size={42} strokeWidth={1.4} />
                </a>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-sm leading-6 text-zinc-500">
                Follow the setup and workflow tutorial before using the add-on in production.
              </p>
              {product.tutorialUrl && (
                <a
                  className="button-secondary mt-6"
                  href={product.tutorialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={15} />
                  {product.tutorialLabel || "Watch tutorial"}
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      <section id="installation" className="shell grid scroll-mt-24 gap-12 py-14 lg:grid-cols-[1fr_.72fr]">
        <div>
          <p className="eyebrow">Getting started</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">Installation and usage</h2>
          <div className="mt-8">
            <div className="rounded-xl border border-line bg-panel p-6">
              <div className="prose prose-invert prose-sm max-w-none text-zinc-400">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{product.guide}</ReactMarkdown>
              </div>
              <div className="mt-6 rounded-lg border border-line bg-ink p-4">
                <p className="text-[0.62rem] font-bold uppercase tracking-wider text-zinc-600">Compatibility</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.blenderVersions?.map((version) => <span className="rounded bg-white/[0.05] px-2 py-1 text-xs text-zinc-400" key={version}>Blender {version}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <aside>
          <>
            <p className="eyebrow">Version history</p>
            <div className="mt-5 grid gap-3">
              {product.changelog?.map((release) => (
                  <div className="rounded-xl border border-line bg-panel p-5" key={release.version}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-forge-soft">v{release.version}</span>
                      <span className="text-[0.62rem] text-zinc-600">{release.date}</span>
                    </div>
                    <ul className="mt-4 grid gap-2">
                      {release.notes.map((note, index) => <li className="flex gap-2 text-xs leading-5 text-zinc-500" key={`${index}-${note}`}><Box className="mt-1 shrink-0 text-zinc-700" size={11} />{note}</li>)}
                    </ul>
                  </div>
              ))}
            </div>
          </>
        </aside>
      </section>

      <ReviewSection
        averageRating={product.rating}
        productId={product.id}
        productSlug={product.slug}
        reviewCount={reviewData.count}
        reviews={reviewData.reviews}
        signedIn={Boolean(profile)}
      />

      {related.length > 0 && (
        <section className="shell border-t border-line py-20">
          <p className="eyebrow">Keep exploring</p>
          <h2 className="section-title mt-4">More from the forge.</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      )}
    </>
  );
}
