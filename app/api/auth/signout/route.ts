import { hasTrustedRequestOrigin, jsonNoStore } from "@/lib/auth-http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonNoStore({ error: "This request is not allowed." }, 403);
  }

  const responseHeaders = new Headers();
  const supabase = await createSupabaseServerClient(responseHeaders);
  if (!supabase) {
    return jsonNoStore({ error: "Unable to sign out right now." }, 503, responseHeaders);
  }

  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      return jsonNoStore({ error: "Unable to sign out right now." }, 503, responseHeaders);
    }
    return jsonNoStore({ ok: true }, 200, responseHeaders);
  } catch {
    return jsonNoStore({ error: "Unable to sign out right now." }, 503, responseHeaders);
  }
}
