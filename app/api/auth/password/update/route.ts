import { z } from "zod";
import { hasTrustedRequestOrigin, jsonNoStore, readJsonBody } from "@/lib/auth-http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  password: z.string().min(8).max(128)
}).strict();

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonNoStore({ error: "This request is not allowed." }, 403);
  }

  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return jsonNoStore({ error: "Use a password of at least 8 characters." }, 400);
  }

  const responseHeaders = new Headers();
  const supabase = await createSupabaseServerClient(responseHeaders);
  if (!supabase) {
    return jsonNoStore({ error: "Account recovery is temporarily unavailable." }, 503, responseHeaders);
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonNoStore({ error: "Your recovery link is invalid or has expired." }, 401, responseHeaders);
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      return jsonNoStore({ error: "Unable to update your password. Request a new link." }, 400, responseHeaders);
    }

    return jsonNoStore({ ok: true }, 200, responseHeaders);
  } catch {
    return jsonNoStore({ error: "Unable to update your password right now." }, 503, responseHeaders);
  }
}
