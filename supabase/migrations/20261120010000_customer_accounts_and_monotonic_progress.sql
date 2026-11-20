-- Link shipments to verified customer accounts by recipient email.
-- Customer credentials remain in Supabase Auth; profiles never store passwords.

create or replace function public.attach_shipment_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(new.recipient_email), '') is not null then
    select u.id into new.customer_id
    from auth.users u
    where lower(u.email) = lower(btrim(new.recipient_email))
      and u.email_confirmed_at is not null
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists shipments_attach_customer on public.shipments;
create trigger shipments_attach_customer
before insert on public.shipments
for each row execute function public.attach_shipment_customer();

create or replace function public.claim_customer_shipments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  account_email text;
  email_is_verified boolean;
  claimed_count integer;
begin
  if current_user_id is null then
    raise exception 'Sign in to link shipments to your account.';
  end if;

  select u.email, u.email_confirmed_at is not null
  into account_email, email_is_verified
  from auth.users u
  where u.id = current_user_id;

  if account_email is null or not email_is_verified then
    raise exception 'Confirm your email before linking shipments.';
  end if;

  update public.shipments s
  set customer_id = current_user_id
  where s.customer_id is null
    and nullif(btrim(s.recipient_email), '') is not null
    and lower(btrim(s.recipient_email)) = lower(btrim(account_email));

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
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
        greatest(
          shipment.progress,
          shipment.progress
            + greatest(0, extract(epoch from (now() - shipment.started_at)) / 3600)
              * speed_kmh / route_distance_km
        )
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

revoke all on function public.attach_shipment_customer() from public, anon, authenticated;
revoke all on function public.claim_customer_shipments() from public, anon;
grant execute on function public.claim_customer_shipments() to authenticated;
revoke all on function public.set_shipment_status(uuid, text) from public, anon;
grant execute on function public.set_shipment_status(uuid, text) to authenticated;
