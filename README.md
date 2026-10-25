# Tokyo Day: travel companion

Mobile-first web app for a one-day Tokyo route (Horikiri → Skytree → Asakusa → Akihabara → Ginza → Tokyo Tower → Harajuku → Shibuya → Shinjuku) by train, LUUP and on foot. Built for iPhone Safari, installable to the home screen.

Live site: **https://spidyloke.github.io/travel-buddy/**

## What it does

- **Home**: Japan time, GPS position, next stop, which line/direction/stop to use, the next action, and Navigate / train-instruction buttons. Recommended mode (train / LUUP / walk) with the reason and price for every leg. Schedule advice ("running 40 min behind, skip Ginza to reach Harajuku before shops close"). Notices when you are away from where a leg starts and switches to live directions. GPS stop/resume.
- **Map**: OpenStreetMap + Leaflet, blue-dot location, numbered stops (next / done / upcoming / skipped), stations for upcoming train legs, and a walking route (OpenStreetMap foot routing via routing.openstreetmap.de) to the next stop or boarding station. Falls back to straight lines if routing is unreachable. No route is drawn for LUUP.
- **Itinerary**: mark visited, skip, restore, reorder, add, remove, change visit length, start and end time, and transport. New places are inserted where they add the least detour. Daily transport total. Destination guide for 16 places with train/walk navigation, map and copy-Japanese-name buttons.
- **Don Quijote**: Home card picks the Donki that costs least time given what's left of your day (Shinjuku Kabukichō, else MEGA Shibuya), with when you'll be there, walking directions and a done tick. "Donki nearby" chips on those stops, 🛍 pins on the map.
- **Photos**: each place shows the lead image of its English Wikipedia article, restricted to freely licensed files, with author and licence credited from Wikimedia Commons. Fetched in two requests, cached for a week; seen images are cached offline.
- **Train Guide**: Suica in Apple Wallet, gates, directions, platforms, transfers, exits, station codes, wrong train, low balance, sign glossary, LUUP rules.
- Progress and preferences persist in `localStorage`. After the first load, the app shell works offline (PWA); map tiles you've already viewed are cached.

### Prices

Train prices are adult Suica (IC) fares by each operator's distance band, checked October 2026 (Tobu, Tokyo Metro, Toei, JR East after its 14 March 2026 revision). Fares marked `~` sit near a band edge. LUUP is priced at the subscription rate, ¥200 per started 30 minutes; change `LUUP_BLOCK_YEN` / `LUUP_BLOCK_MIN` in `src/lib/pricing.ts` if that changes.

### What it deliberately does not do

No live departures, platforms, disruptions, LUUP scooter or port availability. Those come from Google Maps (official [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)) and the LUUP app. Travel times are planning estimates; ones calculated from distance are marked with `*`. No API keys, no backend.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173/travel-buddy/
npm run build      # type-check + production build into dist/
npm run preview
```

Geolocation needs HTTPS or `localhost`. To test on an iPhone on the same Wi-Fi, use `npm run dev -- --host` and a tunnel with HTTPS, or just test the deployed site.

## Deploy to GitHub Pages

1. Repo must be **public** (or on a paid plan for private Pages).
2. GitHub → repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` builds and deploys. Watch it under **Actions**.
4. Site appears at `https://<user>.github.io/<repo>/`.

The base path is set automatically from the repo name in CI (`BASE_PATH=/<repo>/`). For a custom domain or a `<user>.github.io` repo, set `BASE_PATH=/` in the workflow.

## Install on iPhone

Open the site in Safari → Share → **Add to Home Screen**. Allow location when asked. If you denied it: Settings → Privacy & Security → Location Services → Safari Websites → While Using, then in Safari aA → Website Settings → Location → Allow.

## Project layout

```
src/
  data/places.ts      destinations, Japanese names, typical hours
  data/legs.ts        hand-written train routes (line, direction, stops, exits)
  data/itinerary.ts   default day plan
  lib/schedule.ts     timeline, delay projection, skip advice
  lib/maps.ts         Google Maps URL builders, LUUP link
  lib/pricing.ts      fares, LUUP cost, per-leg recommendation
  lib/routing.ts      walking routes (OSRM foot profile)
  hooks/              geolocation, itinerary persistence, theme, clock, online
  components/         Dashboard, MapView, ItineraryView, JourneySheet, TrainGuide…
```

Edit `data/legs.ts` to add step-by-step routes for new pairs of stops; any pair without one falls back to live Google Maps directions.
