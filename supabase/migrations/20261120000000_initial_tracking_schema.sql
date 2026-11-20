-- Prestige Freight Cargo database schema.
-- Every table has row level security enabled. Visitors (anon) can only:
--   * look up one shipment by its tracking number through public.track_shipment()
--   * submit a quote request or a newsletter signup (insert only, no reads)
-- Administrators (rows in public.user_roles) can read and manage everything.

begin;

create extension if not exists citext with schema extensions;

-- Accounts --------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role = 'admin'),
  created_at timestamptz not null default now()
);

-- Shipments -------------------------------------------------------------

create or replace function public.generate_tracking_number()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := 'PFC-';
  i int;
begin
  for i in 1..8 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    if i = 4 then code := code || '-'; end if;
  end loop;
  return code;
end;
$$;

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique default public.generate_tracking_number(),
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  recipient_email text not null default '' check (char_length(recipient_email) <= 254),
  customer_id uuid references auth.users (id) on delete set null,
  origin_name text not null,
  destination_name text not null,
  origin_lat double precision not null check (origin_lat between -90 and 90),
  origin_lng double precision not null check (origin_lng between -180 and 180),
  destination_lat double precision not null check (destination_lat between -90 and 90),
  destination_lng double precision not null check (destination_lng between -180 and 180),
  mode text not null check (mode in ('Road freight', 'Ocean freight', 'Air freight')),
  status text not null default 'Pending'
    check (status in ('In transit', 'Delivered', 'Pending', 'Delayed', 'On hold')),
  progress numeric not null default 0 check (progress between 0 and 1),
  started_at timestamptz,
  estimated_delivery date not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shipments_customer_id_idx on public.shipments (customer_id);
create index shipments_created_at_idx on public.shipments (created_at desc);
create index shipments_created_by_idx on public.shipments (created_by);

-- Website forms ---------------------------------------------------------

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  origin text not null default '' check (char_length(origin) <= 120),
  destination text not null default '' check (char_length(destination) <= 120),
  service text not null check (service in ('ocean', 'road', 'air')),
  weight_kg numeric check (weight_kg is null or (weight_kg > 0 and weight_kg <= 1000000)),
  estimate text not null default '' check (char_length(estimate) <= 120),
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique
    check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

-- Triggers --------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger shipments_set_updated_at
before update on public.shipments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Functions -------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- Public tracking lookup. Returns only what a customer needs to see and
-- never exposes recipient email or account ids.
create or replace function public.track_shipment(p_tracking_number text)
returns table (
  tracking_number text,
  recipient_name text,
  origin_name text,
  destination_name text,
  origin_lat double precision,
  origin_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  mode text,
  status text,
  progress numeric,
  started_at timestamptz,
  estimated_delivery date,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.tracking_number, s.recipient_name, s.origin_name, s.destination_name,
         s.origin_lat, s.origin_lng, s.destination_lat, s.destination_lng,
         s.mode, s.status, s.progress, s.started_at, s.estimated_delivery, s.updated_at
  from public.shipments s
  where s.tracking_number = upper(trim(p_tracking_number))
  limit 1;
$$;

create or replace function public.set_shipment_status(
  p_shipment_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  shipment public.shipments%rowtype;
  route_distance_km double precision;
  speed_kmh double precision;
  current_progress numeric;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  if p_status not in ('In transit', 'Delivered', 'Pending', 'Delayed', 'On hold') then
    raise exception 'Invalid shipment status.';
  end if;

  select * into shipment
  from public.shipments
  where id = p_shipment_id
  for update;

  if not found then
    raise exception 'Shipment not found.';
  end if;

  current_progress := shipment.progress;

  if shipment.status = 'In transit' and shipment.started_at is not null then
    route_distance_km := 6371 * 2 * asin(sqrt(
      sin(radians(shipment.destination_lat - shipment.origin_lat) / 2) ^ 2
      + cos(radians(shipment.origin_lat))
        * cos(radians(shipment.destination_lat))
        * sin(radians(shipment.destination_lng - shipment.origin_lng) / 2) ^ 2
    ));

    speed_kmh := case shipment.mode
      when 'Road freight' then 60
      when 'Ocean freight' then 35
      when 'Air freight' then 800
    end;

    if route_distance_km > 0 then
      current_progress := least(
        1,
        shipment.progress
          + greatest(0, extract(epoch from (now() - shipment.started_at)) / 3600)
            * speed_kmh / route_distance_km
      );
    end if;
  end if;

  update public.shipments
  set status = p_status,
      progress = case
        when p_status = 'Delivered' then 1
        else greatest(shipment.progress, current_progress)
      end,
      started_at = case
        when p_status = 'In transit' and current_progress < 1 then now()
        else null
      end
  where id = p_shipment_id;
end;
$$;

-- Row level security ----------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.shipments enable row level security;
alter table public.quote_requests enable row level security;
alter table public.newsletter_subscribers enable row level security;

create policy "Users read their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_admin()));

create policy "Users update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users read their own role"
on public.user_roles for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy "Admins read all shipments"
on public.shipments for select to authenticated
using ((select public.is_admin()) or customer_id = (select auth.uid()));

create policy "Admins create shipments"
on public.shipments for insert to authenticated
with check ((select public.is_admin()));

create policy "Admins update shipments"
on public.shipments for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins delete shipments"
on public.shipments for delete to authenticated
using ((select public.is_admin()));

create policy "Anyone can request a quote"
on public.quote_requests for insert to anon, authenticated
with check (true);

create policy "Admins read quote requests"
on public.quote_requests for select to authenticated
using ((select public.is_admin()));

create policy "Anyone can subscribe to the newsletter"
on public.newsletter_subscribers for insert to anon, authenticated
with check (true);

create policy "Admins read newsletter subscribers"
on public.newsletter_subscribers for select to authenticated
using ((select public.is_admin()));

-- Grants ----------------------------------------------------------------

revoke all on public.profiles, public.user_roles, public.shipments,
  public.quote_requests, public.newsletter_subscribers from anon, authenticated;

grant select, update (full_name) on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.shipments to authenticated;
grant insert (origin, destination, service, weight_kg, estimate) on public.quote_requests to anon, authenticated;
grant select on public.quote_requests to authenticated;
grant insert (email) on public.newsletter_subscribers to anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.track_shipment(text) from public;
grant execute on function public.track_shipment(text) to anon, authenticated;
revoke all on function public.set_shipment_status(uuid, text) from public, anon;
grant execute on function public.set_shipment_status(uuid, text) to authenticated;
revoke all on function public.generate_tracking_number() from public, anon;
grant execute on function public.generate_tracking_number() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Live updates for the admin dashboard (RLS still applies to realtime).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'shipments'
     ) then
    execute 'alter publication supabase_realtime add table public.shipments';
  end if;
end;
$$;

commit;
