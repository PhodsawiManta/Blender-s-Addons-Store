import { getSafeRedirectPath } from "@/lib/auth-redirect";
import { redirectNoStore } from "@/lib/auth-http";
import { getCanonicalSiteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectToAuthError(siteUrl: string, next: string, headers?: HeadersInit) {
  const errorUrl = new URL("/auth", siteUrl);
  errorUrl.searchParams.set("error", "Google sign-in could not be started. Please try again.");
  errorUrl.searchParams.set("next", next);
  return redirectNoStore(errorUrl, headers);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"));
  const siteUrl = getCanonicalSiteUrl();
  if (!siteUrl) {
    return redirectToAuthError(requestUrl.origin, next);
  }

  const responseHeaders = new Headers();
  const supabase = await createSupabaseServerClient(responseHeaders);
  if (!supabase) {
    return redirectToAuthError(siteUrl, next, responseHeaders);
  }

  const callbackUrl = new URL("/auth/callback", siteUrl);
  callbackUrl.searchParams.set("next", next);

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() }
    });

    if (error || !data.url) {
      return redirectToAuthError(siteUrl, next, responseHeaders);
    }

    return redirectNoStore(data.url, responseHeaders);
  } catch {
    return redirectToAuthError(siteUrl, next, responseHeaders);
  }
}
