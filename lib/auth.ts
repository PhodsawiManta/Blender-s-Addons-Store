import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return null;

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,display_name,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !data || (data.role !== "customer" && data.role !== "admin")) return null;
    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name ?? data.email.split("@")[0],
      role: data.role
    };
  } catch {
    return null;
  }
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class AdminRequiredError extends Error {
  constructor() {
    super("Administrator access is required.");
    this.name = "AdminRequiredError";
  }
}

export async function requireUser() {
  const profile = await getCurrentProfile();
  if (!profile) throw new AuthenticationRequiredError();
  return profile;
}

export async function requireAdmin() {
  const profile = await requireUser();
  if (profile.role !== "admin") throw new AdminRequiredError();
  return profile;
}

export async function isAdminRequest() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}
