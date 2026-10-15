import { z } from "zod";
import { hasTrustedRequestOrigin, jsonNoStore, readJsonBody } from "@/lib/auth-http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email().max(320),
  password: z.string().min(8).max(128)
}).strict();

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonNoStore({ error: "This request is not allowed." }, 403);
  }

  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return jsonNoStore({ error: "Enter a valid email and password." }, 400);
  }

  const responseHeaders = new Headers();
  const supabase = await createSupabaseServerClient(responseHeaders);
  if (!supabase) {
    return jsonNoStore({ error: "Account access is temporarily unavailable." }, 503, responseHeaders);
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email.trim().toLowerCase(),
      password: parsed.data.password
    });

    if (error) {
      const message = error.code === "email_not_confirmed"
        ? "Confirm your email address before signing in."
        : "Email or password is incorrect.";
      return jsonNoStore({ error: message }, 401, responseHeaders);
    }

    return jsonNoStore({ ok: true }, 200, responseHeaders);
  } catch {
    return jsonNoStore({ error: "Unable to sign in right now. Please try again." }, 503, responseHeaders);
  }
}
