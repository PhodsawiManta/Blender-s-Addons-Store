alter table public.products
  add column if not exists download_requires_login boolean not null default true;

create or replace function public.enforce_paid_addon_login()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.type = 'ADDON' and not new.is_free then
    new.download_requires_login = true;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_paid_addon_login on public.products;
create trigger enforce_paid_addon_login
  before insert or update of type, is_free, download_requires_login
  on public.products
  for each row execute procedure public.enforce_paid_addon_login();

alter table public.products
  drop constraint if exists paid_addons_require_login;
alter table public.products
  add constraint paid_addons_require_login
  check (type <> 'ADDON' or is_free or download_requires_login);

alter table public.download_events
  alter column user_id drop not null;

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
    from public.products p
    join public.addon_versions av
      on av.id = download_version_id
      and av.product_id = p.id
      and av.published
    where p.id = download_product_id
      and p.type = 'ADDON'
      and (
        (
          p.status = 'PUBLISHED'
          and p.is_free
          and not p.download_requires_login
        )
        or (
          download_user_id is not null
          and p.status <> 'DRAFT'
          and exists (
            select 1
            from public.entitlements e
            where e.user_id = download_user_id
              and e.product_id = p.id
              and e.active
          )
        )
      )
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

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 3 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists product_reviews_product_created_idx
  on public.product_reviews(product_id, created_at desc);

create or replace function public.validate_product_review()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.user_id is distinct from old.user_id
    or new.product_id is distinct from old.product_id
  ) then
    raise exception 'Review ownership cannot be changed';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = new.product_id
      and p.type = 'ADDON'
      and p.status = 'PUBLISHED'
  ) then
    raise exception 'Add-on is not available for review';
  end if;

  new.comment = btrim(new.comment);
  if tg_op = 'UPDATE' then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists validate_product_review on public.product_reviews;
create trigger validate_product_review
  before insert or update on public.product_reviews
  for each row execute procedure public.validate_product_review();

create or replace function public.refresh_product_review_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_product_id uuid;
begin
  target_product_id = case when tg_op = 'DELETE' then old.product_id else new.product_id end;

  update public.products p
  set rating = coalesce((
    select round(avg(r.rating)::numeric, 1)
    from public.product_reviews r
    where r.product_id = target_product_id
  ), 0)
  where p.id = target_product_id;

  return null;
end;
$$;

drop trigger if exists refresh_product_review_rating on public.product_reviews;
create trigger refresh_product_review_rating
  after insert or update or delete on public.product_reviews
  for each row execute procedure public.refresh_product_review_rating();

update public.products p
set rating = coalesce((
  select round(avg(r.rating)::numeric, 1)
  from public.product_reviews r
  where r.product_id = p.id
), 0)
where p.type = 'ADDON';

alter table public.product_reviews enable row level security;

create policy "published addon reviews are public"
  on public.product_reviews for select
  using (exists (
    select 1 from public.products p
    where p.id = product_id
      and p.type = 'ADDON'
      and p.status = 'PUBLISHED'
  ));

create policy "users create own addon reviews"
  on public.product_reviews for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.type = 'ADDON'
        and p.status = 'PUBLISHED'
    )
  );

create policy "users update own addon reviews"
  on public.product_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete own addon reviews"
  on public.product_reviews for delete
  using (auth.uid() = user_id);

create policy "admins manage addon reviews"
  on public.product_reviews for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on table public.product_reviews to anon, authenticated;
grant insert, update, delete on table public.product_reviews to authenticated;
