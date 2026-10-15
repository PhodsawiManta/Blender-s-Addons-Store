import { createClient } from "@supabase/supabase-js";
import { env, hasSupabaseAdmin } from "@/lib/env";

export function createSupabaseAdminClient() {
  if (!hasSupabaseAdmin) return null;
  return createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
