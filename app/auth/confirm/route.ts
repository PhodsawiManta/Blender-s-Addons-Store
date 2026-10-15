import type { EmailOtpType } from "@supabase/supabase-js";
import { getSafeRedirectPath } from "@/lib/auth-redirect";
import { redirectNoStore } from "@/lib/auth-http";
import { getCanonicalSiteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: ReadonlySet<string> = new Set([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change"
]);

function confirmationErrorUrl(siteUrl: string, next: string) {
  const errorUrl = new URL("/auth", siteUrl);
  errorUrl.searchParams.set("error", "This confirmation link is invalid or has expired.");
  errorUrl.searchParams.set("next", next);
  return errorUrl;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = getCanonicalSiteUrl() ?? requestUrl.origin;
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const fallback = type === "recovery" ? "/auth/update-password" : "/library";
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"), fallback);
  const responseHeaders = new Headers();
  const supabase = await createSupabaseServerClient(responseHeaders);

  if (!tokenHash || !type || !OTP_TYPES.has(type) || !supabase) {
    return redirectNoStore(confirmationErrorUrl(siteUrl, next), responseHeaders);
  }

  try {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType
    });

    if (error) {
      return redirectNoStore(confirmationErrorUrl(siteUrl, next), responseHeaders);
    }

    return redirectNoStore(new URL(next, siteUrl), responseHeaders);
  } catch {
    return redirectNoStore(confirmationErrorUrl(siteUrl, next), responseHeaders);
  }
}
