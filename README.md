# Prestige Freight Cargo

React, TypeScript, Vite, and Tailwind CSS application for the Prestige Freight Cargo site.

## Run locally

```sh
npm install
npm run dev
```

Open `/` for the public website, `/admin` for the responsive operations dashboard, or `/track?code=FLE-7KQ4-M29X` for client tracking.

## Google Maps

Copy `.env.example` to `.env.local` and set `VITE_GOOGLE_MAPS_API_KEY` to a Google Maps JavaScript API key. Restrict the key by website referrer and enable the Maps JavaScript API and billing in Google Cloud. Replace the demo map ID with your Google Maps map ID for production.

Shipment records and status changes are stored in the current browser for this demo. Map movement is simulated using road (60 km/h), sea (35 km/h), and air (800 km/h) speeds; actual customer tracking requires a shared backend and carrier GPS updates.

## Production build

```sh
npm run build
npm run preview
```
