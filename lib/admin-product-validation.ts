import { z } from "zod";

export const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;
export const MAX_COVER_BYTES = 10 * 1024 * 1024;
export const MAX_TUTORIAL_BYTES = 500 * 1024 * 1024;
export const VERSION_PATTERN = /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/;
export const BLENDER_VERSION_PATTERN = /^\d+\.\d+(?:\.\d+)?$/;

const httpUrlSchema = z.url().max(2000).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Only HTTP or HTTPS links are allowed.");

export const fileSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive(),
  contentType: z.string().max(150)
});

export const productMetadataSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().trim().min(2).max(60),
  eyebrow: z.string().trim().max(160).default(""),
  description: z.string().trim().min(10).max(500),
  longDescription: z.string().trim().min(10).max(5000),
  guide: z.string().trim().min(10).max(30000),
  features: z.array(z.string().trim().min(2).max(180)).min(1).max(20),
  blenderVersions: z.array(z.string().trim().regex(BLENDER_VERSION_PATTERN)).min(1).max(20),
  usdAmountCents: z.number().int().min(0).max(100_000_000),
  requiresLogin: z.boolean().default(true),
  tutorialUrl: httpUrlSchema.nullable().optional(),
  tutorialLabel: z.string().trim().max(100).nullable().optional()
});

export const createProductSchema = productMetadataSchema.extend({
  version: z.string().trim().regex(VERSION_PATTERN, "Enter a valid version such as 1.0.0."),
  changelog: z.string().trim().min(3).max(20000),
  archive: fileSchema,
  cover: fileSchema.nullable().optional(),
  tutorialVideo: fileSchema.nullable().optional()
});

export const updateProductSchema = productMetadataSchema.extend({
  coverPath: z.string().max(1000).nullable().optional(),
  mediaPaths: z.array(z.string().max(1000)).max(20).optional(),
  tutorialVideoPath: z.string().max(1000).nullable().optional()
});

export const createVersionSchema = z.object({
  version: z.string().trim().regex(VERSION_PATTERN, "Enter a valid version such as 1.1.0."),
  changelog: z.string().trim().min(3).max(20000),
  archive: fileSchema
});

export function extensionFor(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function validateArchive(file: z.infer<typeof fileSchema>) {
  if (extensionFor(file.name) !== "zip") return "The add-on archive must be a ZIP file.";
  if (file.size > MAX_ARCHIVE_BYTES) return "The add-on archive must be 250 MB or smaller.";
  return null;
}

export function validateCover(file: z.infer<typeof fileSchema> | null | undefined) {
  if (!file) return null;
  if (!new Set(["jpg", "jpeg", "png", "webp"]).has(extensionFor(file.name))) {
    return "The cover must be a JPG, PNG, or WEBP image.";
  }
  if (file.size > MAX_COVER_BYTES) return "The cover image must be 10 MB or smaller.";
  if (file.contentType && !file.contentType.startsWith("image/")) {
    return "The cover file type is invalid.";
  }
  return null;
}

export function validateTutorialVideo(file: z.infer<typeof fileSchema> | null | undefined) {
  if (!file) return null;
  if (!new Set(["mp4", "webm"]).has(extensionFor(file.name))) {
    return "The tutorial video must be MP4 or WEBM.";
  }
  if (file.size > MAX_TUTORIAL_BYTES) return "The tutorial video must be 500 MB or smaller.";
  if (file.contentType && !file.contentType.startsWith("video/")) {
    return "The tutorial video file type is invalid.";
  }
  return null;
}
