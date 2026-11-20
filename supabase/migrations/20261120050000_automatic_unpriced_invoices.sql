begin;

alter table public.shipments
  drop constraint shipments_invoice_details_complete,
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

update public.shipments
set invoice_number = 'INV-' || to_char(created_at, 'YYYY') || '-'
      || upper(substr(replace(id::text, '-', ''), 1, 12)),
    invoice_issued_on = created_at::date,
    invoice_due_on = created_at::date + 30,
    invoice_tax_rate = 0
where invoice_number is null;

commit;
