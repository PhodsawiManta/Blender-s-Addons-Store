import { describe, expect, it } from "vitest";
import {
  createProductSchema,
  MAX_TUTORIAL_BYTES,
  updateProductSchema,
  validateArchive,
  validateTutorialVideo
} from "@/lib/admin-product-validation";

const baseProduct = {
  title: "A real add-on",
  slug: "a-real-addon",
  category: "Animation",
  eyebrow: "",
  description: "A sufficiently detailed short description.",
  longDescription: "A sufficiently detailed full product description.",
  guide: "Install the ZIP through Blender preferences.",
  features: ["Fast workflow"],
  blenderVersions: ["4.2"],
  usdAmountCents: 999,
  tutorialUrl: "https://www.youtube.com/watch?v=example",
  tutorialLabel: "Watch on YouTube",
  version: "1.0.0",
  changelog: "Initial release",
  archive: {
    name: "addon.zip",
    size: 1024,
    contentType: "application/zip"
  },
  cover: null,
  tutorialVideo: null
};

describe("admin product validation", () => {
  it("accepts a paid USD add-on with an HTTPS tutorial link", () => {
    expect(createProductSchema.safeParse(baseProduct).success).toBe(true);
  });

  it("rejects non-HTTP tutorial protocols", () => {
    const result = createProductSchema.safeParse({
      ...baseProduct,
      tutorialUrl: "javascript:alert(1)"
    });
    expect(result.success).toBe(false);
  });

  it("requires a ZIP archive", () => {
    expect(validateArchive({
      name: "addon.rar",
      size: 1024,
      contentType: "application/octet-stream"
    })).toContain("ZIP");
  });

  it("limits uploaded tutorials to supported video files and size", () => {
    expect(validateTutorialVideo({
      name: "tutorial.mov",
      size: 1024,
      contentType: "video/quicktime"
    })).toContain("MP4 or WEBM");

    expect(validateTutorialVideo({
      name: "tutorial.mp4",
      size: MAX_TUTORIAL_BYTES + 1,
      contentType: "video/mp4"
    })).toContain("500 MB");
  });

  it("limits a product gallery to 20 images", () => {
    const update = {
      ...baseProduct,
      mediaPaths: Array.from({ length: 20 }, (_, index) => `addons/id/media/${index}/image.webp`)
    };
    expect(updateProductSchema.safeParse(update).success).toBe(true);
    expect(updateProductSchema.safeParse({
      ...update,
      mediaPaths: [...update.mediaPaths, "addons/id/media/20/image.webp"]
    }).success).toBe(false);
  });
});
