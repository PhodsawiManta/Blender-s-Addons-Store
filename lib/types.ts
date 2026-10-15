export type Currency = "USD";
export type ProductType = "ADDON";
export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ArtworkTone = "orange" | "blue" | "violet" | "mint" | "sand";

export interface ProductPrice {
  usd: number;
  stripePriceId?: string;
}

export interface AddonVersion {
  id: string;
  version: string;
  fileSizeBytes?: number;
  publishedAt?: string;
  changelog: string;
}

export interface ProductMediaItem {
  type: "image" | "video";
  url: string;
  alt: string;
}

export interface Product {
  id: string;
  slug: string;
  type: ProductType;
  status: ProductStatus;
  title: string;
  eyebrow: string;
  description: string;
  longDescription: string;
  price: ProductPrice;
  isFree: boolean;
  requiresLogin: boolean;
  category: string;
  rating: number;
  downloadCount: number;
  artwork: ArtworkTone;
  imageUrl?: string;
  media: ProductMediaItem[];
  tutorialVideoUrl?: string;
  tutorialUrl?: string;
  tutorialLabel?: string;
  featured?: boolean;
  badge?: string;
  blenderVersions?: string[];
  currentVersion?: string;
  fileSize?: string;
  versions?: AddonVersion[];
  features: string[];
  guide: string;
  changelog?: { version: string; date: string; notes: string[] }[];
}

export interface ProductReview {
  id: string;
  rating: number;
  comment: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  isOwn: boolean;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  role: "customer" | "admin";
}

export interface Order {
  id: string;
  customerEmail: string;
  total: number;
  currency: Currency;
  status: "paid" | "pending" | "failed";
  createdAt: string;
  itemCount: number;
}
