# Prestige Freight Cargo

React, TypeScript, Vite, Tailwind CSS and Supabase application for the Prestige Freight Cargo site.

## Run locally

```sh
npm install
npm run dev
```

- `/` public website (quote requests and newsletter signups are saved to Supabase)
- `/track?code=PFC-7KQ4-M29X` customer shipment tracking
- `/admin` operations dashboard (administrator sign-in required)

## Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key; safe in the browser because every table uses row level security |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API key, restricted by website referrer |
| `VITE_GOOGLE_MAPS_MAP_ID` | Google Maps map ID |

Never put a Supabase secret/service-role key or personal access token in this app or in git.

## Database

The schema lives in `supabase/migrations/`. Security model:

- Visitors can look up a single shipment by tracking number through `track_shipment()`; recipient emails are never returned.
- Visitors can submit quote requests and newsletter signups, but cannot read them back.
- Only accounts listed in `user_roles` as `admin` can read, create and update shipments and read form submissions.

### Adding an administrator

1. In the Supabase dashboard, open **Authentication → Users → Add user** and create the account.
2. Open `supabase/promote-admin.sql`, replace the email, and run it in the **SQL Editor**.
3. Sign in at `/admin`.

## Production build

```sh
npm run build
npm run preview
```
