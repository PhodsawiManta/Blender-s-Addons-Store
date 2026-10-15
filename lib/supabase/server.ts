import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/env";

export async function createSupabaseServerClient(responseHeaders?: Headers) {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        if (responseHeaders) {
          Object.entries(headers).forEach(([name, value]) => responseHeaders.set(name, value));
        }

        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Middleware refreshes their session.
        }
      }
    }
  });
}
