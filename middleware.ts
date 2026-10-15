import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyNoStore } from "@/lib/auth-http";
import { getSupabasePublicConfig } from "@/lib/env";

function requestedPath(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function authRedirect(request: NextRequest, message?: string) {
  const url = new URL("/auth", request.url);
  url.searchParams.set("next", requestedPath(request));
  if (message) url.searchParams.set("error", message);
  return applyNoStore(NextResponse.redirect(url));
}

export async function middleware(request: NextRequest) {
  const config = getSupabasePublicConfig();
  if (!config) {
    return authRedirect(request, "Account access is temporarily unavailable.");
  }

  let applySessionUpdates = (target: NextResponse) => target;
  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const previousUpdates = applySessionUpdates;
        applySessionUpdates = (target) => {
          previousUpdates(target);
          cookiesToSet.forEach(({ name, value, options }) => target.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => target.headers.set(name, value));
          return target;
        };
        response = applySessionUpdates(NextResponse.next({ request }));
      }
    }
  });

  let user = null;
  try {
    const result = await supabase.auth.getUser();
    if (!result.error) user = result.data.user;
  } catch {
    user = null;
  }

  if (!user) {
    return applySessionUpdates(authRedirect(request));
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error || profile?.role !== "admin") {
        return applySessionUpdates(
          applyNoStore(NextResponse.redirect(new URL("/library?notice=admin-required", request.url)))
        );
      }
    } catch {
      return applySessionUpdates(
        applyNoStore(NextResponse.redirect(new URL("/library?notice=admin-required", request.url)))
      );
    }
  }

  return applyNoStore(response);
}

export const config = {
  matcher: ["/admin/:path*", "/library/:path*"]
};
