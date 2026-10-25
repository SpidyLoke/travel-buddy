# Tokyo Day: travel companion

Mobile-first web app that plans a day in Tokyo around what you like and then navigates it: which train line and direction, where to get off, when LUUP or walking is better, what's around you, and how to get back to where you're staying. Built for iPhone Safari, installable to the home screen, no account, no API keys, everything stored on the phone.

Live site: **https://spidyloke.github.io/travel-buddy/**

## What it does

- **First-run setup** (about a minute): where you're staying (search or current location), date and hours, interests, pace, LUUP plan (none / pay per ride / subscription), optional must-sees, then a generated day plan to accept or reshuffle. "Plan a new day" any time from Settings or the Itinerary tab; places visited on earlier days can be skipped.
- **Multi-day trips**: plan up to 7 days at once. Must-sees are split across days by geography, places never repeat, later days relax interest matching so they still fill up. Day tabs in the Itinerary; Home offers to switch to today's day.
- **Weather**: Open-Meteo forecast (free, no key) for the trip dates, up to 16 days ahead: day summary, temperatures on day tabs, and a warning on outdoor stops when rain is 50%+ around your arrival time. Warn only, the plan is never changed automatically.
- **Food**: lunch (~12:30) and dinner (~19:00) rows in the itinerary at wherever you'll be, and a Home card at meal times. Ideas from OpenStreetMap, filtered by your food needs (halal / Muslim-friendly, vegetarian, no seafood); halal also lists mosques and prayer rooms within 5 km. Halal, Vegetarian and Prayer space categories in Nearby.
- **Planner** (`src/lib/planner.ts`): scores ~35 destinations by popularity and your interests, inserts the best ones where they add the least travel, and keeps the day feasible against typical opening hours, closed days (e.g. Imperial Palace East Gardens on Mon/Fri, Tsukiji on Sun/Wed) and your finish time. Time-of-day aware: shrines and markets early, views at dusk, nightlife late. One stop per area, then a reordering pass to remove zigzags.
- **Home**: Japan time, where you are (street-level), next stop, which line/direction/stop, the next action, Navigate, recommended mode with price and reason, schedule advice, Don Quijote picker when your plan passes one. 🏠 opens the route back to where you're staying from wherever you are.
- **Map**: your position, numbered stops, stations for upcoming train legs, walking route (OpenStreetMap foot routing), found places pinned.
- **Nearby**: live search for any place and categories around you or your next stop (landmarks with photos, Don Quijote, konbini, food, ramen, cafés, toilets, ATMs, drugstores, lockers, souvenirs, stations). Add any result to the day or set it as home.
- **Itinerary**: visited / skip / restore, reorder, add, remove, visit length, times, transport, notes on why each stop was picked, transport total. **Destination guide** with "Recommended for you" and interest filters, credited photos.
- **Trains**: beginner guide (Suica in Apple Wallet, gates, directions, transfers, exits, station codes, wrong train, low balance), sign glossary, etiquette, LUUP rules.
- **Group lobby** (peer to peer): start a lobby from Share, invite by link or QR, everyone edits one live plan. Visited / skip / reorder / add / time changes sync to every phone that has the app open, with who's online and a feed of who changed what. Phones connect directly over WebRTC (Trystero, public Nostr relays used only to find each other, data encrypted with the lobby code); nothing is stored on a server, so a phone catches up when it is opened while another member is online. Copies merge deterministically (last-writer-wins registers per stop, order and day settings, with tombstones for deletions; `src/lib/lobby.ts`).
- **Share**: send a one-off copy of a plan as a link or QR code. The plan travels inside the link (compressed, nothing uploaded); opening it on another phone offers to load it.
- **Currency**: yen ↔ your currency converter (default MYR) with live reference rates (European Central Bank via Frankfurter, fallback ExchangeRate-API), kept for offline use; converted amounts shown next to fares and the day's transport total.
- **Settings**: home, LUUP plan, interests, food needs, currency, theme, start over.
- Offline: app shell, saved plan and previously viewed map tiles and photos.

### Prices

Train prices are adult Suica (IC) fares by each operator's distance band, checked October 2026 (Tobu, Tokyo Metro, Toei, JR East after its 14 March 2026 revision), for the hand-written routes; elsewhere Google Maps shows the fare. Fares marked `~` sit near a band edge. LUUP follows your plan: subscription ¥200 per started 30 minutes, pay per ride shown as approximate (~¥50 + ¥25/min, Tokyo rate changed 1 Sep 2026). Constants live in `src/lib/pricing.ts`.

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
  data/places.ts      core destinations, Japanese names, typical hours
  data/morePlaces.ts  extra destinations for the planner and guide
  data/legs.ts        hand-written train routes (line, direction, stops, exits)
  data/itinerary.ts   default day plan
  lib/planner.ts      day planner and recommendation scoring
  lib/prefs.ts        settings (LUUP plan, interests, pace)
  lib/nearby.ts       live search / nearby (Photon, Overpass, Wikipedia)
  lib/lobby.ts        group lobby document and merge rules
  hooks/useLobby.ts   peer-to-peer connection (Trystero / Nostr signalling)
  lib/schedule.ts     timeline, delay projection, skip advice
  lib/maps.ts         Google Maps URL builders, LUUP link
  lib/pricing.ts      fares, LUUP cost, per-leg recommendation
  lib/routing.ts      walking routes (OSRM foot profile)
  hooks/              geolocation, itinerary persistence, theme, clock, online
  components/         Dashboard, MapView, ItineraryView, JourneySheet, TrainGuide…
```

Edit `data/legs.ts` to add step-by-step routes for new pairs of stops; any pair without one falls back to live Google Maps directions.
