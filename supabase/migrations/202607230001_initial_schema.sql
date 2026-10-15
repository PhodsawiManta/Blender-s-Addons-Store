create extension if not exists "pgcrypto";

create type public.profile_role as enum ('customer', 'admin');
create type public.product_type as enum ('ADDON', 'COURSE');
create type public.product_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type public.order_status as enum ('pending', 'paid', 'refunded', 'failed');
create type public.video_status as enum ('pending', 'uploading', 'processing', 'ready', 'error');
create type public.entitlement_source as enum ('free_claim', 'stripe', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.profile_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  type public.product_type not null,
  status public.product_status not null default 'DRAFT',
  title text not null,
  eyebrow text,
  description text not null,
  long_description text,
  category text not null,
  artwork_tone text not null default 'orange',
  badge text,
  rating numeric(2,1) not null default 0,
  blender_versions text[] not null default '{}',
  features jsonb not null default '[]'::jsonb,
  guide_markdown text not null default '',
  is_free boolean not null default false,
  featured boolean not null default false,
  download_count bigint not null default 0 check (download_count >= 0),
  stripe_product_id text unique,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  usd_amount_cents integer not null check (usd_amount_cents >= 0),
  stripe_price_id text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index one_active_price_per_product on public.product_prices(product_id) where active;

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.addon_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  version text not null,
  storage_path text not null,
  file_size_bytes bigint,
  changelog_markdown text not null default '',
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(product_id, version)
);

create table public.course_sections (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  duration_seconds integer not null default 0,
  is_preview boolean not null default false,
  mux_upload_id text unique,
  mux_asset_id text unique,
  mux_playback_id text unique,
  video_status public.video_status not null default 'pending',
  video_error text,
  project_file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, slug)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  customer_email text,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_total integer not null default 0,
  currency text not null default 'USD' check (currency = 'USD'),
  status public.order_status not null default 'pending',
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null default 0 check (unit_amount_cents >= 0),
  created_at timestamptz not null default now()
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  source public.entitlement_source not null default 'free_claim',
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(user_id, product_id)
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  position_seconds integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  provider text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  error_message text,
  processed_at timestamptz
);

create table public.download_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  version_id uuid not null references public.addon_versions(id) on delete cascade,
  downloaded_at timestamptz not null default now()
);
create index download_events_user_id_idx on public.download_events(user_id);
create index download_events_product_id_idx on public.download_events(product_id);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create unique index profiles_email_lower_unique on public.profiles(lower(email));

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set email = new.email, updated_at = now()
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute procedure public.sync_profile_email();

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() = old.id and (
    new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
  ) then
    raise exception 'Profile security fields cannot be changed';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger protect_profile_security_fields
  before update on public.profiles
  for each row execute procedure public.protect_profile_security_fields();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.claim_free_addon(target_product_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  entitlement_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.products p
    join public.product_prices pp
      on pp.product_id = p.id and pp.active
    where p.id = target_product_id
      and p.type = 'ADDON'
      and p.status = 'PUBLISHED'
      and p.is_free
      and pp.usd_amount_cents = 0
  ) then
    raise exception 'Free add-on is not available';
  end if;

  insert into public.entitlements (user_id, product_id, source, active, revoked_at)
  values (auth.uid(), target_product_id, 'free_claim', true, null)
  on conflict (user_id, product_id) do update
    set active = true,
        revoked_at = null,
        source = 'free_claim',
        order_id = null
  returning id into entitlement_id;

  return entitlement_id;
end;
$$;

revoke all on function public.claim_free_addon(uuid) from public;
grant execute on function public.claim_free_addon(uuid) to authenticated;

create or replace function public.record_addon_download(
  download_user_id uuid,
  download_product_id uuid,
  download_version_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.entitlements e
    join public.products p on p.id = e.product_id
    join public.addon_versions av
      on av.id = download_version_id
      and av.product_id = p.id
      and av.published
    where e.user_id = download_user_id
      and e.product_id = download_product_id
      and e.active
      and p.type = 'ADDON'
      and p.status <> 'DRAFT'
  ) then
    raise exception 'Download is not authorized';
  end if;

  insert into public.download_events (user_id, product_id, version_id)
  values (download_user_id, download_product_id, download_version_id);

  update public.products
  set download_count = download_count + 1
  where id = download_product_id;
end;
$$;

revoke all on function public.record_addon_download(uuid, uuid, uuid) from public;
grant execute on function public.record_addon_download(uuid, uuid, uuid) to service_role;

create or replace function public.publish_free_addon(
  target_product_id uuid,
  target_version_id uuid,
  target_file_size_bytes bigint
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  updated_version_id uuid;
begin
  if target_file_size_bytes is null or target_file_size_bytes <= 0 then
    raise exception 'Invalid add-on file size';
  end if;

  if not exists (
    select 1
    from public.products p
    join public.product_prices pp
      on pp.product_id = p.id and pp.active
    where p.id = target_product_id
      and p.type = 'ADDON'
      and p.status <> 'ARCHIVED'
      and p.is_free
      and pp.usd_amount_cents = 0
  ) then
    raise exception 'Free add-on is not publishable';
  end if;

  update public.addon_versions
  set file_size_bytes = target_file_size_bytes,
      published = true,
      published_at = coalesce(published_at, now())
  where id = target_version_id
    and product_id = target_product_id
  returning id into updated_version_id;

  if updated_version_id is null then
    raise exception 'Add-on version not found';
  end if;

  update public.products
  set status = 'PUBLISHED',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = target_product_id;
end;
$$;

revoke all on function public.publish_free_addon(uuid, uuid, bigint) from public;
grant execute on function public.publish_free_addon(uuid, uuid, bigint) to service_role;

create or replace function public.fulfill_paid_order(
  target_order_id uuid,
  target_stripe_session_id text,
  target_payment_intent_id text,
  target_amount_total integer,
  target_customer_email text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_user_id uuid;
  target_order_status public.order_status;
  existing_session_id text;
  expected_amount_total integer;
begin
  select user_id, status, stripe_session_id
  into target_user_id, target_order_status, existing_session_id
  from public.orders
  where id = target_order_id
  for update;

  if target_user_id is null then
    raise exception 'Order not found';
  end if;

  if target_order_status = 'refunded' then
    return;
  end if;

  if existing_session_id is not null and existing_session_id <> target_stripe_session_id then
    raise exception 'Checkout Session mismatch';
  end if;

  select coalesce(sum(unit_amount_cents * quantity), 0)
  into expected_amount_total
  from public.order_items
  where order_id = target_order_id;

  if expected_amount_total <> target_amount_total then
    raise exception 'Order amount mismatch';
  end if;

  update public.orders
  set stripe_session_id = target_stripe_session_id,
      stripe_payment_intent_id = target_payment_intent_id,
      amount_total = target_amount_total,
      customer_email = coalesce(target_customer_email, customer_email),
      currency = 'USD',
      status = 'paid',
      updated_at = now()
  where id = target_order_id;

  insert into public.entitlements (user_id, product_id, order_id, source, active, revoked_at)
  select target_user_id, oi.product_id, target_order_id, 'stripe', true, null
  from public.order_items oi
  where oi.order_id = target_order_id
  on conflict (user_id, product_id) do update
    set order_id = excluded.order_id,
        source = 'stripe',
        active = true,
        revoked_at = null;
end;
$$;

revoke all on function public.fulfill_paid_order(uuid, text, text, integer, text) from public;
grant execute on function public.fulfill_paid_order(uuid, text, text, integer, text) to service_role;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_prices enable row level security;
alter table public.product_media enable row level security;
alter table public.addon_versions enable row level security;
alter table public.course_sections enable row level security;
alter table public.lessons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.entitlements enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.webhook_events enable row level security;
alter table public.download_events enable row level security;
alter table public.contact_messages enable row level security;

create policy "profiles read own" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "published products are public" on public.products for select using (status = 'PUBLISHED' or public.is_admin());
create policy "admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "published prices are public" on public.product_prices for select using (exists(select 1 from public.products where products.id = product_id and (products.status = 'PUBLISHED' or public.is_admin())));
create policy "admins manage prices" on public.product_prices for all using (public.is_admin()) with check (public.is_admin());
create policy "published media is public" on public.product_media for select using (exists(select 1 from public.products where products.id = product_id and products.status = 'PUBLISHED'));
create policy "admins manage media" on public.product_media for all using (public.is_admin()) with check (public.is_admin());
create policy "version metadata is public" on public.addon_versions for select using (published or public.is_admin());
create policy "admins manage versions" on public.addon_versions for all using (public.is_admin()) with check (public.is_admin());
create policy "published course sections are public" on public.course_sections for select using (exists(select 1 from public.products where products.id = product_id and products.status = 'PUBLISHED'));
create policy "admins manage sections" on public.course_sections for all using (public.is_admin()) with check (public.is_admin());
create policy "published lesson metadata is public" on public.lessons for select using (exists(select 1 from public.products where products.id = product_id and products.status = 'PUBLISHED'));
create policy "admins manage lessons" on public.lessons for all using (public.is_admin()) with check (public.is_admin());
create policy "users read own orders" on public.orders for select using (auth.uid() = user_id or public.is_admin());
create policy "users read own order items" on public.order_items for select using (exists(select 1 from public.orders where orders.id = order_id and (orders.user_id = auth.uid() or public.is_admin())));
create policy "users read own entitlements" on public.entitlements for select using (auth.uid() = user_id or public.is_admin());
create policy "users read own progress" on public.lesson_progress for select using (auth.uid() = user_id or public.is_admin());
create policy "users create own progress" on public.lesson_progress for insert with check (auth.uid() = user_id);
create policy "users update own progress" on public.lesson_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

revoke select on public.addon_versions from anon, authenticated;
grant select (
  id,
  product_id,
  version,
  file_size_bytes,
  changelog_markdown,
  published,
  published_at,
  created_at
) on public.addon_versions to anon, authenticated;

insert into storage.buckets (id, name, public) values
  ('product-files', 'product-files', false),
  ('product-media', 'product-media', true)
on conflict (id) do nothing;

create policy "public reads product media" on storage.objects for select using (bucket_id = 'product-media');
create policy "admins upload product assets" on storage.objects for insert with check (bucket_id in ('product-files', 'product-media') and public.is_admin());
create policy "admins update product assets" on storage.objects for update using (bucket_id in ('product-files', 'product-media') and public.is_admin());
create policy "admins delete product assets" on storage.objects for delete using (bucket_id in ('product-files', 'product-media') and public.is_admin());

-- After the owner signs up, copy the UUID from Authentication > Users and promote only it:
-- update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000000';
