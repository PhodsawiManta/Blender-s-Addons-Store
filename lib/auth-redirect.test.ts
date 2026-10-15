import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "@/lib/auth-redirect";

describe("getSafeRedirectPath", () => {
  it("keeps local paths, including their query string", () => {
    expect(getSafeRedirectPath("/library?tab=courses")).toBe("/library?tab=courses");
  });

  it.each([
    ["https://example.com", "/library"],
    ["//example.com", "/library"],
    ["/\\example.com", "/library"],
    ["/library\\example.com", "/library"],
    ["/library\u0000", "/library"],
    ["not-a-path", "/library"],
    [null, "/library"]
  ])("rejects unsafe redirect %s", (value, expected) => {
    expect(getSafeRedirectPath(value)).toBe(expected);
  });

  it("uses the caller's trusted fallback", () => {
    expect(getSafeRedirectPath("https://example.com", "/")).toBe("/");
  });
});
