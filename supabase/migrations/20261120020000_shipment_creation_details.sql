begin;

alter table public.shipments
  add column sender_name text not null default '' check (char_length(sender_name) <= 120),
  add column sender_email text not null default '' check (char_length(sender_email) <= 254),
  add column sender_phone text not null default '' check (char_length(sender_phone) <= 40),
  add column recipient_phone text not null default '' check (char_length(recipient_phone) <= 40),
  add column weight_kg numeric not null default 0 check (weight_kg >= 0),
  add column ship_date date not null default current_date,
  add column expected_delivery_time time,
  add column piece_type text not null default 'Parcel'
    check (piece_type in ('Parcel', 'Box', 'Pallet', 'Document', 'Container', 'Other')),
  add column sender_address text not null default '' check (char_length(sender_address) <= 500),
  add column recipient_address text not null default '' check (char_length(recipient_address) <= 500),
  add column package_description text not null default '' check (char_length(package_description) <= 2000),
  add column timeline_events jsonb not null default '[]'::jsonb
    check (jsonb_typeof(timeline_events) = 'array');

commit;
