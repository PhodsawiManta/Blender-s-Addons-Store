-- Remove only the fixed sample records shipped with the original seed.
delete from public.products
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

alter table public.products
  add column if not exists featured boolean not null default false,
  add column if not exists download_count bigint not null default 0;
alter table public.products
  drop column if exists current_version,
  drop column if exists file_size;
alter table public.products
  drop constraint if exists products_download_count_check;
alter table public.products
  add constraint products_download_count_check check (download_count >= 0);

alter table public.product_prices
  add column if not exists usd_amount_cents integer;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_prices'
      and column_name = 'usd_amount'
  ) then
    execute 'update public.product_prices
      set usd_amount_cents = usd_amount * 100
      where usd_amount_cents is null';
  end if;
end;
$$;
alter table public.product_prices
  alter column usd_amount_cents set not null,
  drop column if exists usd_amount,
  drop column if exists thb_amount;
alter table public.product_prices
  drop constraint if exists product_prices_usd_amount_cents_check;
alter table public.product_prices
  add constraint product_prices_usd_amount_cents_check check (usd_amount_cents >= 0);
create unique index if not exists one_active_price_per_product
  on public.product_prices(product_id)
  where active;

do $$
begin
  if exists (select 1 from public.orders where currency <> 'USD') then
    raise exception 'USD-only migration stopped: manually resolve non-USD orders before retrying';
  end if;
end;
$$;

alter table public.orders
  drop constraint if exists orders_currency_check;
alter table public.orders
  alter column currency set default 'USD';
alter table public.orders
  add constraint orders_currency_usd_only check (currency = 'USD');

alter table public.order_items
  add column if not exists unit_amount_cents integer not null default 0;
alter table public.order_items
  drop constraint if exists order_items_unit_amount_cents_check;
alter table public.order_items
  add constraint order_items_unit_amount_cents_check check (unit_amount_cents >= 0);

do $$
begin
  create type public.entitlement_source as enum ('free_claim', 'stripe', 'admin');
exception
  when duplicate_object then null;
end;
$$;

alter table public.entitlements
  add column if not exists source public.entitlement_source;
update public.entitlements
set source = case when order_id is null then 'free_claim'::public.entitlement_source else 'stripe'::public.entitlement_source end
where source is null;
alter table public.entitlements
  alter column source set not null,
  alter column source set default 'free_claim';

alter table public.webhook_events
  add column if not exists status text,
  add column if not exists error_message text;
update public.webhook_events
set status = 'processed'
where status is null;
alter table public.webhook_events
  alter column status set not null,
  alter column status set default 'processing',
  alter column processed_at drop not null,
  alter column processed_at drop default;
alter table public.webhook_events
  drop constraint if exists webhook_events_status_check;
alter table public.webhook_events
  add constraint webhook_events_status_check check (status in ('processing', 'processed', 'failed'));

create table if not exists public.download_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  version_id uuid not null references public.addon_versions(id) on delete cascade,
  downloaded_at timestamptz not null default now()
);
create index if not exists download_events_user_id_idx on public.download_events(user_id);
create index if not exists download_events_product_id_idx on public.download_events(product_id);
alter table public.download_events enable row level security;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;

create unique index if not exists profiles_email_lower_unique on public.profiles(lower(email));

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

drop trigger if exists on_auth_user_email_updated on auth.users;
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

drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields
  before update on public.profiles
  for each row execute procedure public.protect_profile_security_fields();

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

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

drop function if exists public.increment_product_downloads(uuid);

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
