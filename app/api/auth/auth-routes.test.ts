import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth }))
}));

import { POST as signIn } from "@/app/api/auth/signin/route";
import { POST as signUp } from "@/app/api/auth/signup/route";
import { GET as authCallback } from "@/app/auth/callback/route";
import { GET as confirmEmail } from "@/app/auth/confirm/route";

describe("email authentication routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({ error: null });
  });

  it("rejects malformed JSON without throwing and disables caching", async () => {
    const response = await signIn(new Request("https://aoupa.online/api/auth/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid"
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Enter a valid email and password." });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns a confirmation-aware signup response", async () => {
    const response = await signUp(new Request("https://aoupa.online/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "NewUser@Example.com",
        password: "a-secure-password",
        next: "/library?tab=addons"
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      requiresEmailConfirmation: true
    });
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "newuser@example.com",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Flibrary%3Ftab%3Daddons"
      }
    }));
  });

  it("does not expose provider error details during signin", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "provider detail" }
    });

    const response = await signIn(new Request("https://aoupa.online/api/auth/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "wrong-password"
      })
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Email or password is incorrect." });
  });

  it("exchanges an OAuth PKCE code and keeps a safe local redirect", async () => {
    const response = await authCallback(new Request(
      "https://aoupa.online/auth/callback?code=pkce-code&next=%2Flibrary%3Ftab%3Daddons"
    ));

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/library?tab=addons");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("verifies an SSR email token hash", async () => {
    const response = await confirmEmail(new Request(
      "https://aoupa.online/auth/confirm?token_hash=hash&type=email&next=%2Flibrary"
    ));

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash",
      type: "email"
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/library");
  });
});
