import { z } from "zod";
import { getSafeRedirectPath } from "@/lib/auth-redirect";
import { hasTrustedRequestOrigin, jsonNoStore, readJsonBody } from "@/lib/auth-http";
import { getCanonicalSiteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email().max(320),
  password: z.string().min(8).max(128),
  next: z.string().max(2048).optional()
}).strict();

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonNoStore({ error: "This request is not allowed." }, 403);
  }

  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return jsonNoStore({ error: "Enter a valid email and a password of at least 8 characters." }, 400);
  }

  const siteUrl = getCanonicalSiteUrl();
  const responseHeaders = new Headers();
  const supabase = await createSupabaseServerClient(responseHeaders);
  if (!siteUrl || !supabase) {
    return jsonNoStore({ error: "Account access is temporarily unavailable." }, 503, responseHeaders);
  }

  const next = getSafeRedirectPath(parsed.data.next);
  const callbackUrl = new URL("/auth/callback", siteUrl);
  callbackUrl.searchParams.set("next", next);

  try {
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email.trim().toLowerCase(),
      password: parsed.data.password,
      options: { emailRedirectTo: callbackUrl.toString() }
    });

    if (error) {
      return jsonNoStore(
        { error: "Unable to create this account right now. Please try again." },
        400,
        responseHeaders
      );
    }

    return jsonNoStore({
      ok: true,
      requiresEmailConfirmation: !data.session
    }, 200, responseHeaders);
  } catch {
    return jsonNoStore(
      { error: "Unable to create this account right now. Please try again." },
      503,
      responseHeaders
    );
  }
}
