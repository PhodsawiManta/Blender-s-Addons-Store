import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductMediaGallery } from "@/components/product-media-gallery";

const media = [
  { type: "image" as const, url: "https://example.com/one.webp", alt: "Image one" },
  { type: "image" as const, url: "https://example.com/two.webp", alt: "Image two" },
  { type: "video" as const, url: "https://example.com/demo.mp4", alt: "Demo video" }
];

describe("ProductMediaGallery", () => {
  it("switches the main viewer between gallery images and video", () => {
    render(<ProductMediaGallery media={media} title="Add-on" tone="orange" />);

    expect(screen.getByRole("img", { name: "Image one" })).toHaveAttribute(
      "src",
      media[0].url
    );

    fireEvent.click(screen.getByRole("button", { name: "View image 2 of 3" }));
    expect(screen.getByRole("img", { name: "Image two" })).toHaveAttribute(
      "src",
      media[1].url
    );

    fireEvent.click(screen.getByRole("button", { name: "View video 3 of 3" }));
    expect(screen.getByLabelText("Demo video")).toHaveAttribute("src", media[2].url);
  });
});
