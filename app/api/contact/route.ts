import { z } from "zod";
import { hasTrustedRequestOrigin, jsonNoStore, readJsonBody } from "@/lib/auth-http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(320).transform((value) => value.trim().toLowerCase()),
  topic: z.enum(["general", "product-support", "order-payment", "partnership"]),
  message: z.string().trim().min(10).max(5000),
  company: z.string().max(0).optional()
}).strict();

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return jsonNoStore({ error: "This request is not allowed." }, 403);
  }
  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return jsonNoStore({ error: "Complete every field with valid information." }, 400);
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return jsonNoStore({ error: "Support messaging is temporarily unavailable." }, 503);
  }

  const { company: _company, ...message } = parsed.data;
  const { error } = await supabase.from("contact_messages").insert(message);
  if (error) {
    return jsonNoStore({ error: "Could not send your message. Please email support@aoupa.online." }, 500);
  }
  return jsonNoStore({ ok: true }, 201);
}
