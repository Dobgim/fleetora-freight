-- Create the account first in Supabase: Authentication > Users > Add user.
-- Then replace the email below and run this once from the Supabase SQL Editor.
do $$
declare
  admin_email text := lower('REPLACE_WITH_ADMIN_EMAIL');
  admin_user_id uuid;
begin
  select id into admin_user_id
  from auth.users
  where lower(email) = admin_email;

  if admin_user_id is null then
    raise exception 'No Supabase Auth account exists for the configured admin email.';
  end if;

  insert into public.user_roles (user_id, role)
  values (admin_user_id, 'admin')
  on conflict (user_id) do update set role = 'admin';
end;
$$;
