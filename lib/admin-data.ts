import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AdminDataResult<T> {
  data: T;
  error: string | null;
}

export interface AdminProductRow {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  category: string;
  eyebrow: string;
  description: string;
  longDescription: string;
  guide: string;
  features: string[];
  blenderVersions: string[];
  isFree: boolean;
  requiresLogin: boolean;
  featured: boolean;
  downloadCount: number;
  usdAmountCents: number;
  stripePriceId: string | null;
  coverPath: string | null;
  mediaPaths: string[];
  tutorialVideoPath: string | null;
  tutorialUrl: string;
  tutorialLabel: string;
  versionCount: number;
  versionId: string | null;
  version: string | null;
  versionPublished: boolean;
  updatedAt: string;
}

export interface AdminOrderRow {
  id: string;
  customerEmail: string;
  productSummary: string;
  itemCount: number;
  amountTotalCents: number;
  currency: "USD";
  status: "paid" | "pending" | "failed";
  createdAt: string;
}

export interface AdminDonationRow {
  id: string;
  productTitle: string;
  customerEmail: string;
  amountTotalCents: number;
  status: "paid" | "pending" | "failed";
  createdAt: string;
}

export interface AdminCustomerRow {
  id: string;
  displayName: string;
  email: string;
  entitlementCount: number;
  paidTotalCents: number;
  joinedAt: string;
}

export interface AdminCustomersData {
  rows: AdminCustomerRow[];
  totalCount: number;
}

export interface AdminOverviewData {
  grossRevenueCents: number;
  orderCount: number;
  customerCount: number;
  downloadCount: number;
  productCount: number;
  recentOrders: AdminOrderRow[];
  topProducts: AdminProductRow[];
}

function unavailable<T>(data: T): AdminDataResult<T> {
  return {
    data,
    error: "Supabase service-role access is not configured."
  };
}

function messageFromErrors(errors: Array<{ message?: string } | null | undefined>) {
  const messages = errors
    .map((error) => error?.message)
    .filter((message): message is string => Boolean(message));
  return messages.length > 0 ? Array.from(new Set(messages)).join(" ") : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isProductStatus(value: unknown): value is AdminProductRow["status"] {
  return value === "DRAFT" || value === "PUBLISHED" || value === "ARCHIVED";
}

function isOrderStatus(value: unknown): value is AdminOrderRow["status"] {
  return value === "paid" || value === "pending" || value === "failed";
}

function titleFromOrderItem(item: unknown) {
  if (!item || typeof item !== "object") return null;
  const products = (item as { products?: unknown }).products;
  if (Array.isArray(products)) {
    const first = products[0];
    return first && typeof first === "object" && typeof (first as { title?: unknown }).title === "string"
      ? (first as { title: string }).title
      : null;
  }
  return products && typeof products === "object" && typeof (products as { title?: unknown }).title === "string"
    ? (products as { title: string }).title
    : null;
}

function mapOrderRows(rows: unknown[]): AdminOrderRow[] {
  return rows.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as {
      id?: unknown;
      customer_email?: unknown;
      amount_total?: unknown;
      currency?: unknown;
      status?: unknown;
      created_at?: unknown;
      order_items?: unknown;
    };
    if (typeof row.id !== "string" || !isOrderStatus(row.status) || typeof row.created_at !== "string") return [];
    const items = Array.isArray(row.order_items) ? row.order_items : [];
    const titles = items.map(titleFromOrderItem).filter((title): title is string => Boolean(title));
    const uniqueTitles = Array.from(new Set(titles));
    const itemCount = items.reduce((sum, item) => {
      if (!item || typeof item !== "object") return sum;
      return sum + Math.max(1, Math.trunc(asNumber((item as { quantity?: unknown }).quantity)));
    }, 0);
    return [{
      id: row.id,
      customerEmail: typeof row.customer_email === "string" && row.customer_email
        ? row.customer_email
        : "Email unavailable",
      productSummary: uniqueTitles.length > 0 ? uniqueTitles.join(", ") : "Items unavailable",
      itemCount,
      amountTotalCents: Math.max(0, Math.trunc(asNumber(row.amount_total))),
      currency: "USD" as const,
      status: row.status,
      createdAt: row.created_at
    }];
  });
}

export async function getAdminProducts(): Promise<AdminDataResult<AdminProductRow[]>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return unavailable([]);

  const productsQuery = await supabase
    .from("products")
    .select("id,title,slug,status,category,eyebrow,description,long_description,guide_markdown,features,blender_versions,is_free,download_requires_login,featured,download_count,tutorial_video_path,tutorial_url,tutorial_label,updated_at")
    .eq("type", "ADDON")
    .order("updated_at", { ascending: false });

  if (productsQuery.error || !productsQuery.data) {
    return { data: [], error: productsQuery.error?.message ?? "Unable to load add-ons." };
  }

  const ids = productsQuery.data
    .map((row) => typeof row.id === "string" ? row.id : null)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return { data: [], error: null };

  const [pricesQuery, versionsQuery, mediaQuery] = await Promise.all([
    supabase
      .from("product_prices")
      .select("product_id,usd_amount_cents,stripe_price_id,active")
      .in("product_id", ids)
      .eq("active", true),
    supabase
      .from("addon_versions")
      .select("id,product_id,version,published,created_at,published_at")
      .in("product_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_media")
      .select("product_id,storage_path,position")
      .in("product_id", ids)
      .order("position", { ascending: true })
  ]);

  const prices = new Map<string, { amount: number; stripePriceId: string | null }>();
  for (const value of pricesQuery.data ?? []) {
    if (typeof value.product_id === "string" && !prices.has(value.product_id)) {
      prices.set(value.product_id, {
        amount: Math.max(0, Math.trunc(asNumber(value.usd_amount_cents))),
        stripePriceId: typeof value.stripe_price_id === "string" ? value.stripe_price_id : null
      });
    }
  }

  const versions = new Map<string, {
    id: string;
    version: string;
    published: boolean;
  }>();
  const versionCounts = new Map<string, number>();
  for (const value of versionsQuery.data ?? []) {
    if (typeof value.product_id === "string") {
      versionCounts.set(value.product_id, (versionCounts.get(value.product_id) ?? 0) + 1);
    }
    if (
      typeof value.product_id === "string"
      && typeof value.id === "string"
      && typeof value.version === "string"
      && !versions.has(value.product_id)
    ) {
      versions.set(value.product_id, {
        id: value.id,
        version: value.version,
        published: value.published === true
      });
    }
  }

  const mediaPaths = new Map<string, string[]>();
  for (const value of mediaQuery.data ?? []) {
    if (
      typeof value.product_id === "string"
      && typeof value.storage_path === "string"
    ) {
      const paths = mediaPaths.get(value.product_id) ?? [];
      paths.push(value.storage_path);
      mediaPaths.set(value.product_id, paths);
    }
  }

  const rows: AdminProductRow[] = productsQuery.data.flatMap((value) => {
    if (
      typeof value.id !== "string"
      || typeof value.title !== "string"
      || typeof value.slug !== "string"
      || !isProductStatus(value.status)
      || typeof value.category !== "string"
      || typeof value.updated_at !== "string"
    ) return [];
    const latestVersion = versions.get(value.id);
    return [{
      id: value.id,
      title: value.title,
      slug: value.slug,
      status: value.status,
      category: value.category,
      eyebrow: typeof value.eyebrow === "string" ? value.eyebrow : "",
      description: typeof value.description === "string" ? value.description : "",
      longDescription: typeof value.long_description === "string"
        ? value.long_description
        : typeof value.description === "string" ? value.description : "",
      guide: typeof value.guide_markdown === "string" ? value.guide_markdown : "",
      features: Array.isArray(value.features)
        ? value.features.filter((item): item is string => typeof item === "string")
        : [],
      blenderVersions: Array.isArray(value.blender_versions)
        ? value.blender_versions.filter((item): item is string => typeof item === "string")
        : [],
      isFree: value.is_free === true,
      requiresLogin: value.is_free !== true || value.download_requires_login !== false,
      featured: value.featured === true,
      downloadCount: Math.max(0, Math.trunc(asNumber(value.download_count))),
      usdAmountCents: prices.get(value.id)?.amount ?? 0,
      stripePriceId: prices.get(value.id)?.stripePriceId ?? null,
      coverPath: mediaPaths.get(value.id)?.[0] ?? null,
      mediaPaths: mediaPaths.get(value.id) ?? [],
      tutorialVideoPath: typeof value.tutorial_video_path === "string"
        ? value.tutorial_video_path
        : null,
      tutorialUrl: typeof value.tutorial_url === "string" ? value.tutorial_url : "",
      tutorialLabel: typeof value.tutorial_label === "string" ? value.tutorial_label : "",
      versionCount: versionCounts.get(value.id) ?? 0,
      versionId: latestVersion?.id ?? null,
      version: latestVersion?.version ?? null,
      versionPublished: latestVersion?.published ?? false,
      updatedAt: value.updated_at
    }];
  });

  return {
    data: rows,
    error: messageFromErrors([pricesQuery.error, versionsQuery.error, mediaQuery.error])
  };
}

export async function getAdminOrders(limit = 200): Promise<AdminDataResult<AdminOrderRow[]>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return unavailable([]);

  const query = await supabase
    .from("orders")
    .select("id,customer_email,amount_total,currency,status,created_at,order_items(quantity,unit_amount_cents,products(title))")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));

  if (query.error || !query.data) {
    return { data: [], error: query.error?.message ?? "Unable to load orders." };
  }
  return { data: mapOrderRows(query.data), error: null };
}

export async function getAdminDonations(
  limit = 500
): Promise<AdminDataResult<AdminDonationRow[]>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return unavailable([]);

  const query = await supabase
    .from("donations")
    .select("id,customer_email,usd_amount_cents,status,created_at,products(title)")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 1000)));
  if (query.error || !query.data) {
    return {
      data: [],
      error: query.error?.message ?? "Unable to load donations."
    };
  }

  const rows: AdminDonationRow[] = query.data.flatMap((value) => {
    if (
      typeof value.id !== "string"
      || !isOrderStatus(value.status)
      || typeof value.created_at !== "string"
    ) return [];
    const productValue = value.products;
    const product = Array.isArray(productValue) ? productValue[0] : productValue;
    const productTitle = product
      && typeof product === "object"
      && typeof (product as { title?: unknown }).title === "string"
      ? (product as { title: string }).title
      : "Add-on unavailable";
    return [{
      id: value.id,
      productTitle,
      customerEmail: typeof value.customer_email === "string" && value.customer_email
        ? value.customer_email
        : "Pending checkout email",
      amountTotalCents: Math.max(0, Math.trunc(asNumber(value.usd_amount_cents))),
      status: value.status,
      createdAt: value.created_at
    }];
  });
  return { data: rows, error: null };
}

async function getPaidRevenueCents() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { total: 0, error: { message: "Supabase service-role access is not configured." } };

  const pageSize = 1000;
  let offset = 0;
  let total = 0;
  while (true) {
    const page = await supabase
      .from("orders")
      .select("id,amount_total")
      .eq("status", "paid")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (page.error) return { total, error: page.error };
    const rows = page.data ?? [];
    total += rows.reduce((sum, row) => sum + Math.max(0, Math.trunc(asNumber(row.amount_total))), 0);
    if (rows.length < pageSize) return { total, error: null };
    offset += pageSize;
  }
}

export async function getAdminOverview(): Promise<AdminDataResult<AdminOverviewData>> {
  const supabase = createSupabaseAdminClient();
  const empty: AdminOverviewData = {
    grossRevenueCents: 0,
    orderCount: 0,
    customerCount: 0,
    downloadCount: 0,
    productCount: 0,
    recentOrders: [],
    topProducts: []
  };
  if (!supabase) return unavailable(empty);

  const [
    orderCountQuery,
    customerCountQuery,
    downloadCountQuery,
    productCountQuery,
    revenue,
    recentOrders,
    products
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "customer"),
    supabase.from("download_events").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("type", "ADDON"),
    getPaidRevenueCents(),
    getAdminOrders(8),
    getAdminProducts()
  ]);

  return {
    data: {
      grossRevenueCents: revenue.total,
      orderCount: orderCountQuery.count ?? 0,
      customerCount: customerCountQuery.count ?? 0,
      downloadCount: downloadCountQuery.count ?? 0,
      productCount: productCountQuery.count ?? 0,
      recentOrders: recentOrders.data,
      topProducts: [...products.data]
        .sort((a, b) => b.downloadCount - a.downloadCount)
        .slice(0, 4)
    },
    error: messageFromErrors([
      orderCountQuery.error,
      customerCountQuery.error,
      downloadCountQuery.error,
      productCountQuery.error,
      revenue.error,
      recentOrders.error ? { message: recentOrders.error } : null,
      products.error ? { message: products.error } : null
    ])
  };
}

export async function getAdminCustomers(): Promise<AdminDataResult<AdminCustomersData>> {
  const supabase = createSupabaseAdminClient();
  const empty: AdminCustomersData = { rows: [], totalCount: 0 };
  if (!supabase) return unavailable(empty);

  const [profilesQuery, countQuery] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,display_name,created_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "customer")
  ]);
  if (profilesQuery.error || !profilesQuery.data) {
    return {
      data: { rows: [], totalCount: countQuery.count ?? 0 },
      error: messageFromErrors([profilesQuery.error, countQuery.error]) ?? "Unable to load customers."
    };
  }

  const ids = profilesQuery.data
    .map((row) => typeof row.id === "string" ? row.id : null)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return {
      data: { rows: [], totalCount: countQuery.count ?? 0 },
      error: countQuery.error?.message ?? null
    };
  }

  const [entitlementsQuery, ordersQuery] = await Promise.all([
    supabase
      .from("entitlements")
      .select("user_id")
      .in("user_id", ids)
      .eq("active", true),
    supabase
      .from("orders")
      .select("user_id,amount_total")
      .in("user_id", ids)
      .eq("status", "paid")
  ]);

  const entitlementCounts = new Map<string, number>();
  for (const value of entitlementsQuery.data ?? []) {
    if (typeof value.user_id === "string") {
      entitlementCounts.set(value.user_id, (entitlementCounts.get(value.user_id) ?? 0) + 1);
    }
  }
  const paidTotals = new Map<string, number>();
  for (const value of ordersQuery.data ?? []) {
    if (typeof value.user_id === "string") {
      paidTotals.set(
        value.user_id,
        (paidTotals.get(value.user_id) ?? 0) + Math.max(0, Math.trunc(asNumber(value.amount_total)))
      );
    }
  }

  const rows: AdminCustomerRow[] = profilesQuery.data.flatMap((value) => {
    if (typeof value.id !== "string" || typeof value.email !== "string" || typeof value.created_at !== "string") {
      return [];
    }
    return [{
      id: value.id,
      displayName: typeof value.display_name === "string" && value.display_name
        ? value.display_name
        : value.email.split("@")[0],
      email: value.email,
      entitlementCount: entitlementCounts.get(value.id) ?? 0,
      paidTotalCents: paidTotals.get(value.id) ?? 0,
      joinedAt: value.created_at
    }];
  });

  return {
    data: { rows, totalCount: countQuery.count ?? rows.length },
    error: messageFromErrors([countQuery.error, entitlementsQuery.error, ordersQuery.error])
  };
}
