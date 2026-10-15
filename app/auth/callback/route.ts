import { getSafeRedirectPath } from "@/lib/auth-redirect";
import { redirectNoStore } from "@/lib/auth-http";
import { getCanonicalSiteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function authErrorUrl(siteUrl: string, next: string) {
  const errorUrl = new URL("/auth", siteUrl);
  errorUrl.searchParams.set("error", "This sign-in link is invalid or has expired.");
  errorUrl.searchParams.set("next", next);
  return errorUrl;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = getCanonicalSiteUrl() ?? requestUrl.origin;
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"));
  const code = requestUrl.searchParams.get("code");
  const responseHeaders = new Headers();
  const supabase = await createSupabaseServerClient(responseHeaders);

  if (!code || !supabase) {
    return redirectNoStore(authErrorUrl(siteUrl, next), responseHeaders);
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectNoStore(authErrorUrl(siteUrl, next), responseHeaders);
    }

    return redirectNoStore(new URL(next, siteUrl), responseHeaders);
  } catch {
    return redirectNoStore(authErrorUrl(siteUrl, next), responseHeaders);
  }
}
