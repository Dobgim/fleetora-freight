begin;

drop function public.track_shipment(text);

create function public.track_shipment(p_tracking_number text)
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
  updated_at timestamptz,
  invoice_number text,
  invoice_currency text,
  invoice_issued_on date,
  invoice_due_on date,
  invoice_subtotal numeric,
  invoice_tax_rate numeric,
  sender_name text,
  sender_email text,
  sender_phone text,
  sender_address text,
  recipient_email text,
  recipient_phone text,
  recipient_address text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.tracking_number, s.recipient_name, s.origin_name, s.destination_name,
         s.origin_lat, s.origin_lng, s.destination_lat, s.destination_lng,
         s.mode, s.status, s.progress, s.started_at, s.estimated_delivery, s.updated_at,
         s.invoice_number, s.invoice_currency, s.invoice_issued_on, s.invoice_due_on,
         s.invoice_subtotal, s.invoice_tax_rate,
         case when s.invoice_number is not null then s.sender_name end,
         case when s.invoice_number is not null then s.sender_email end,
         case when s.invoice_number is not null then s.sender_phone end,
         case when s.invoice_number is not null then s.sender_address end,
         case when s.invoice_number is not null then s.recipient_email end,
         case when s.invoice_number is not null then s.recipient_phone end,
         case when s.invoice_number is not null then s.recipient_address end
  from public.shipments s
  where s.tracking_number = upper(trim(p_tracking_number))
  limit 1;
$$;

revoke all on function public.track_shipment(text) from public;
grant execute on function public.track_shipment(text) to anon, authenticated;

commit;
