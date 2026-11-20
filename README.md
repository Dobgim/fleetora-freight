# Prestige Freight Cargo

Responsive freight website and shipment portals built with React, TypeScript, Vite and Supabase.

## Routes

- `/` public home page
- `/services`, `/about`, `/locations`, `/pricing`, `/contact` independent public pages
- `/track?code=PFC-...` shipment tracking
- `/account` customer sign-in, sign-up and shipment dashboard
- `/admin` administrator sign-in and overview; dashboard sections have their own `/admin/...` routes

Customer credentials are managed by Supabase Auth. Shipment records are linked to a confirmed account when the shipment recipient email matches the Auth email. A customer only sees shipments assigned to their own account.

## Local development

`.env.local` is ignored by Git. Copy `.env.example` to `.env.local` if it is missing, then fill in the project values:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `VITE_GOOGLE_MAPS_API_KEY` | Browser Maps JavaScript API key; restrict by allowed website referrers and APIs |
| `VITE_GOOGLE_MAPS_MAP_ID` | Google Maps map ID |

These `VITE_` values are included in browser code at build time; a `.env.local` file does not make them secret. Supabase publishable keys and browser Maps keys are expected to be public and must be restricted with Supabase RLS and Google Cloud API/referrer restrictions. Never add a Supabase service-role/secret key, database password, or personal access token to a `VITE_` variable, the client app, or Git.

## Supabase setup

Apply migrations in `supabase/migrations/` to the intended project. The migration adds verified-email shipment linking and keeps stored journey progress monotonic when status changes. Map movement is an estimate based on route, service speed and shipment status; actual carrier GPS requires a trusted location feed.

To create the administrator:

1. In Supabase **Authentication → Users**, invite or create `info@prestigefreightcargo.com` and set its password privately in Supabase.
2. Run `supabase/promote-admin.sql` in that project's SQL Editor.
3. Sign in at `/admin`.

To clear all existing shipment records, first confirm the project ref and take a backup, then run `supabase/clean-all-shipments.sql` manually in that project's SQL Editor. This permanently deletes every shipment and customer tracking record. It is intentionally not part of an automatic migration.

## Vercel deployment

Import the GitHub repository into Vercel and set the four environment variables above in the Vercel project settings for each deployment environment. Redeploy after changing variables. `vercel.json` routes app paths such as `/account` and `/admin/shipments` back to the app entry point.

Set Supabase Auth's allowed site URL and redirect URLs to the deployed domain (including `/account`). Keep local secrets in the ignored `.env.local`; do not commit it.

## Build

```sh
npm run build
npm run preview
```
