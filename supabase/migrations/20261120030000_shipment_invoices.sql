begin;

alter table public.shipments
  add column invoice_number text,
  add column invoice_currency text,
  add column invoice_issued_on date,
  add column invoice_due_on date,
  add column invoice_subtotal numeric(12, 2),
  add column invoice_tax_rate numeric(5, 2),
  add constraint shipments_invoice_details_complete check (
    (
      invoice_number is null
      and invoice_currency is null
      and invoice_issued_on is null
      and invoice_due_on is null
      and invoice_subtotal is null
      and invoice_tax_rate is null
    )
    or (
      invoice_number is not null
      and char_length(invoice_number) between 1 and 60
      and invoice_issued_on is not null
      and invoice_due_on is not null
      and invoice_due_on >= invoice_issued_on
      and invoice_tax_rate is not null
      and invoice_tax_rate between 0 and 100
      and (
        invoice_subtotal is null
        or (
          invoice_subtotal > 0
          and invoice_currency is not null
          and invoice_currency in ('USD', 'EUR', 'GBP', 'CAD', 'GHS')
        )
      )
    )
  );

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
  invoice_tax_rate numeric
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
         s.invoice_subtotal, s.invoice_tax_rate
  from public.shipments s
  where s.tracking_number = upper(trim(p_tracking_number))
  limit 1;
$$;

revoke all on function public.track_shipment(text) from public;
grant execute on function public.track_shipment(text) to anon, authenticated;

commit;
