create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  customer_email text,
  usd_amount_cents integer not null
    check (usd_amount_cents >= 300 and usd_amount_cents <= 100000000),
  currency text not null default 'USD' check (currency = 'USD'),
  status public.order_status not null default 'pending',
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists donations_product_created_idx
  on public.donations(product_id, created_at desc);
create index if not exists donations_user_created_idx
  on public.donations(user_id, created_at desc)
  where user_id is not null;

alter table public.donations enable row level security;

drop policy if exists "Users can view their own donations" on public.donations;
create policy "Users can view their own donations"
on public.donations
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.fulfill_donation(
  target_donation_id uuid,
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
  donation_status public.order_status;
  existing_session_id text;
  expected_amount_total integer;
begin
  select status, stripe_session_id, usd_amount_cents
  into donation_status, existing_session_id, expected_amount_total
  from public.donations
  where id = target_donation_id
  for update;

  if expected_amount_total is null then
    raise exception 'Donation not found';
  end if;

  if donation_status = 'refunded' then
    return;
  end if;

  if existing_session_id is not null
    and existing_session_id <> target_stripe_session_id then
    raise exception 'Donation Checkout Session mismatch';
  end if;

  if expected_amount_total <> target_amount_total or target_amount_total < 300 then
    raise exception 'Donation amount mismatch';
  end if;

  update public.donations
  set stripe_session_id = target_stripe_session_id,
      stripe_payment_intent_id = target_payment_intent_id,
      customer_email = coalesce(target_customer_email, customer_email),
      status = 'paid',
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = target_donation_id;
end;
$$;

revoke all on function public.fulfill_donation(uuid, text, text, integer, text) from public;
grant execute on function public.fulfill_donation(uuid, text, text, integer, text) to service_role;

notify pgrst, 'reload schema';
