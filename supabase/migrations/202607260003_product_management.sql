alter table public.products
  add column if not exists tutorial_video_path text,
  add column if not exists tutorial_url text,
  add column if not exists tutorial_label text;

create or replace function public.configure_product_price(
  target_product_id uuid,
  target_usd_amount_cents integer,
  target_stripe_product_id text,
  target_stripe_price_id text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  product_exists boolean;
begin
  if target_usd_amount_cents is null or target_usd_amount_cents < 0 then
    raise exception 'Invalid USD price';
  end if;

  select true
  into product_exists
  from public.products
  where id = target_product_id
    and type = 'ADDON'
  for update;

  if not coalesce(product_exists, false) then
    raise exception 'Add-on not found';
  end if;

  if target_usd_amount_cents > 0 and (
    target_stripe_product_id is null
    or target_stripe_price_id is null
  ) then
    raise exception 'Paid add-ons require Stripe product and price IDs';
  end if;

  update public.product_prices
  set active = false
  where product_id = target_product_id
    and active;

  insert into public.product_prices (
    product_id,
    usd_amount_cents,
    stripe_price_id,
    active
  )
  values (
    target_product_id,
    target_usd_amount_cents,
    case when target_usd_amount_cents > 0 then target_stripe_price_id else null end,
    true
  );

  update public.products
  set is_free = target_usd_amount_cents = 0,
      badge = case when target_usd_amount_cents = 0 then 'Free' else null end,
      stripe_product_id = case
        when target_usd_amount_cents > 0 then target_stripe_product_id
        else stripe_product_id
      end,
      updated_at = now()
  where id = target_product_id;
end;
$$;

revoke all on function public.configure_product_price(uuid, integer, text, text) from public;
grant execute on function public.configure_product_price(uuid, integer, text, text) to service_role;

create or replace function public.publish_addon_version(
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
      on pp.product_id = p.id
      and pp.active
    where p.id = target_product_id
      and p.type = 'ADDON'
      and p.status <> 'ARCHIVED'
      and (
        (p.is_free and pp.usd_amount_cents = 0)
        or (
          not p.is_free
          and pp.usd_amount_cents > 0
          and p.stripe_product_id is not null
          and pp.stripe_price_id is not null
        )
      )
  ) then
    raise exception 'Add-on pricing is not publishable';
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

revoke all on function public.publish_addon_version(uuid, uuid, bigint) from public;
grant execute on function public.publish_addon_version(uuid, uuid, bigint) to service_role;
