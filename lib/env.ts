export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  paidCheckoutEnabled: process.env.PAID_CHECKOUT_ENABLED === "true",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET
};

export const hasSupabase = Boolean(getSupabasePublicConfig());
export const hasSupabaseAdmin = Boolean(hasSupabase && env.supabaseServiceRoleKey);
export const hasStripe = Boolean(env.stripeSecretKey && env.stripeWebhookSecret);

export function getSupabasePublicConfig() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;

  try {
    const url = new URL(env.supabaseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return { url: url.toString().replace(/\/$/, ""), key: env.supabaseAnonKey };
  } catch {
    return null;
  }
}

export function getCanonicalSiteUrl() {
  try {
    const url = new URL(env.siteUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
