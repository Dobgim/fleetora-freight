-- Destructive: permanently deletes every shipment and customer tracking record.
-- Confirm the Supabase project and take a database backup before running.
begin;

delete from public.shipments;

commit;
