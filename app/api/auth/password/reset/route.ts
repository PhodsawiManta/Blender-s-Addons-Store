import { z } from "zod";
import { getSafeRedirectPath } from "@/lib/auth-redirect";
import { hasTrustedRequestOrigin, jsonNoStore, readJsonBody } from "@/lib/auth-http";
import { getCanonicalSiteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email().max(320),
  next: z.string().max(2048).optional()
}).strict();

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonNoStore({ error: "This request is not allowed." }, 403);
  }

  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return jsonNoStore({ error: "Enter a valid email address." }, 400);
  }

  const siteUrl = getCanonicalSiteUrl();
  const responseHeaders = new Headers();
  const supabase = await createSupabaseServerClient(responseHeaders);
  if (!siteUrl || !supabase) {
    return jsonNoStore({ error: "Account recovery is temporarily unavailable." }, 503, responseHeaders);
  }

  const next = getSafeRedirectPath(parsed.data.next);
  const updatePasswordPath = new URL("/auth/update-password", siteUrl);
  updatePasswordPath.searchParams.set("next", next);
  const callbackUrl = new URL("/auth/callback", siteUrl);
  callbackUrl.searchParams.set(
    "next",
    `${updatePasswordPath.pathname}${updatePasswordPath.search}`
  );

  try {
    await supabase.auth.resetPasswordForEmail(parsed.data.email.trim().toLowerCase(), {
      redirectTo: callbackUrl.toString()
    });
  } catch {
    // Return the same response to avoid revealing whether an account exists.
  }

  return jsonNoStore({
    ok: true,
    message: "If an account exists for that address, a recovery link is on its way."
  }, 200, responseHeaders);
}
