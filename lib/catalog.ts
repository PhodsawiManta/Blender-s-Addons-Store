import "server-only";

import { cache } from "react";
import { vpsVideoUrl } from "@/lib/video-path";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AddonVersion,
  ArtworkTone,
  Product,
  ProductMediaItem,
  ProductStatus,
  ProductType
} from "@/lib/types";

const artworkTones = new Set<ArtworkTone>(["orange", "blue", "violet", "mint", "sand"]);

const productSelect = `
  id,
  slug,
  type,
  status,
  title,
  eyebrow,
  description,
  long_description,
  category,
  artwork_tone,
  badge,
  rating,
  blender_versions,
  features,
  guide_markdown,
  is_free,
  download_requires_login,
  featured,
  download_count,
  tutorial_video_path,
  tutorial_url,
  tutorial_label,
  published_at,
  product_prices (
    usd_amount_cents,
    stripe_price_id,
    active
  ),
  product_media (
    storage_path,
    alt_text,
    position
  ),
  addon_versions (
    id,
    version,
    file_size_bytes,
    changelog_markdown,
    published,
    published_at
  )
`;

type ProductRow = {
  id: string;
  slug: string;
  type: ProductType;
  status: ProductStatus;
  title: string;
  eyebrow: string | null;
  description: string;
  long_description: string | null;
  category: string;
  artwork_tone: string;
  badge: string | null;
  rating: number | string | null;
  blender_versions: string[] | null;
  features: unknown;
  guide_markdown: string | null;
  is_free: boolean;
  download_requires_login: boolean;
  featured: boolean | null;
  download_count: number | string | null;
  tutorial_video_path: string | null;
  tutorial_url: string | null;
  tutorial_label: string | null;
  published_at: string | null;
  product_prices:
    | { usd_amount_cents: number; stripe_price_id: string | null; active: boolean }[]
    | null;
  product_media:
    | { storage_path: string; alt_text: string | null; position: number }[]
    | null;
  addon_versions:
    | {
        id: string;
        version: string;
        file_size_bytes: number | string | null;
        changelog_markdown: string | null;
        published: boolean;
        published_at: string | null;
      }[]
    | null;
};

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function publicMediaUrl(path: string | undefined) {
  if (path?.startsWith("vps:")) return vpsVideoUrl(path);
  if (!path || !env.supabaseUrl) return undefined;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${env.supabaseUrl}/storage/v1/object/public/product-media/${encodedPath}`;
}

function formatFileSize(bytes: number | undefined) {
  if (!bytes) return undefined;
  const units = ["B", "KB", "MB", "GB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unit);
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export function mapProductRow(row: ProductRow): Product {
  const price = row.product_prices?.find((item) => item.active);
  const imageMedia: ProductMediaItem[] = [...(row.product_media ?? [])]
    .sort((a, b) => a.position - b.position)
    .flatMap((media) => {
      const url = publicMediaUrl(media.storage_path);
      return url ? [{
        type: "image" as const,
        url,
        alt: media.alt_text || `${row.title} gallery image`
      }] : [];
    });
  const tutorialVideoUrl = publicMediaUrl(row.tutorial_video_path ?? undefined);
  const galleryMedia: ProductMediaItem[] = tutorialVideoUrl
    ? [...imageMedia, {
        type: "video",
        url: tutorialVideoUrl,
        alt: `${row.title} video`
      }]
    : imageMedia;
  const versions: AddonVersion[] = (row.addon_versions ?? [])
    .filter((version) => version.published)
    .sort((a, b) => {
      if (!a.published_at) return 1;
      if (!b.published_at) return -1;
      return b.published_at.localeCompare(a.published_at);
    })
    .map((version) => ({
      id: version.id,
      version: version.version,
      fileSizeBytes: version.file_size_bytes == null ? undefined : Number(version.file_size_bytes),
      publishedAt: version.published_at ?? undefined,
      changelog: version.changelog_markdown ?? ""
    }));
  const latestVersion = versions[0];
  const tone = artworkTones.has(row.artwork_tone as ArtworkTone)
    ? row.artwork_tone as ArtworkTone
    : "orange";

  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    status: row.status,
    title: row.title,
    eyebrow: row.eyebrow ?? "",
    description: row.description,
    longDescription: row.long_description ?? row.description,
    price: {
      usd: (price?.usd_amount_cents ?? 0) / 100,
      stripePriceId: price?.stripe_price_id ?? undefined
    },
    isFree: row.is_free,
    requiresLogin: !row.is_free || row.download_requires_login !== false,
    category: row.category,
    rating: Number(row.rating ?? 0),
    downloadCount: Number(row.download_count ?? 0),
    artwork: tone,
    imageUrl: imageMedia[0]?.url,
    media: galleryMedia,
    tutorialVideoUrl,
    tutorialUrl: row.tutorial_url ?? undefined,
    tutorialLabel: row.tutorial_label ?? undefined,
    featured: Boolean(row.featured),
    badge: row.badge ?? undefined,
    blenderVersions: row.blender_versions ?? [],
    currentVersion: latestVersion?.version,
    fileSize: formatFileSize(latestVersion?.fileSizeBytes),
    versions,
    features: stringArray(row.features),
    guide: row.guide_markdown ?? "",
    changelog: versions.map((version) => ({
      version: version.version,
      date: version.publishedAt
        ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(version.publishedAt))
        : "",
      notes: version.changelog
        .split("\n")
        .map((line) => line.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean)
    }))
  };
}

export const getPublishedProducts = cache(async (type?: ProductType): Promise<Product[]> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("products")
    .select(productSelect)
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false });
  if (type) query = query.eq("type", type);
  if (!env.paidCheckoutEnabled) query = query.eq("is_free", true);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown as ProductRow[]).map(mapProductRow);
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("slug", slug)
    .eq("type", "ADDON")
    .eq("status", "PUBLISHED")
    .maybeSingle();
  if (error || !data) return null;
  const product = mapProductRow(data as unknown as ProductRow);
  if (!env.paidCheckoutEnabled && !product.isFree) return null;
  return product;
});

export async function getProductsForLibrary(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .in("id", ids)
    .eq("type", "ADDON")
    .order("title");
  if (error || !data) return [];
  return (data as unknown as ProductRow[]).map(mapProductRow);
}
