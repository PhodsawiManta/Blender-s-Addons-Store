import { describe, expect, it } from "vitest";
import {
  createNoStoreHeaders,
  hasTrustedRequestOrigin,
  readJsonBody
} from "@/lib/auth-http";

describe("auth HTTP helpers", () => {
  it("forces private no-store responses while preserving other headers", () => {
    const headers = createNoStoreHeaders({ "x-request-id": "request-1" });

    expect(headers.get("cache-control")).toContain("private");
    expect(headers.get("cache-control")).toContain("no-store");
    expect(headers.get("expires")).toBe("0");
    expect(headers.get("pragma")).toBe("no-cache");
    expect(headers.get("x-request-id")).toBe("request-1");
  });

  it("returns null for malformed JSON", async () => {
    const request = new Request("https://aoupa.online/api/auth/signin", {
      method: "POST",
      body: "{invalid"
    });

    await expect(readJsonBody(request)).resolves.toBeNull();
  });

  it("rejects an explicitly cross-origin mutation", () => {
    const request = new Request("https://aoupa.online/api/auth/signout", {
      method: "POST",
      headers: { origin: "https://attacker.example" }
    });

    expect(hasTrustedRequestOrigin(request)).toBe(false);
  });
});
