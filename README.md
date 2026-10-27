# Tokyo Day: travel companion

Mobile-first web app that plans days away around what you like (built-in guides for Tokyo, Kyoto, Osaka and Japanese day trips; anywhere else, such as Kawaguchiko or Kuala Lumpur, it finds things to do live) and then navigates it: which train line and direction, where to get off, when LUUP or walking is better, what's around you, and how to get back to where you're staying. Built for iPhone Safari, installable to the home screen, no account, no API keys, everything stored on the phone.

Live site: **https://spidyloke.github.io/travel-buddy/**

## What it does

- **First-run setup** (about a minute): where you're staying (search or current location), date and hours, interests, pace, LUUP plan (none / pay per ride / subscription), optional must-sees, then a generated day plan to accept or reshuffle. "Plan a new day" any time from Settings or the Itinerary tab; places visited on earlier days can be skipped.
- **Cities and day trips**: Tokyo, Kyoto and Osaka catalogues, and day trips to Kamakura, Hakone, Nikkō and Fuji Five Lakes (from Tokyo) or Nara (from Kyoto/Osaka). The region comes from where you're staying; each chosen day trip gets its own day, filled with as much of that area as fits (the ride out and back is treated as a fixed cost). Step-by-step train cards and fares exist for central Tokyo routes; elsewhere you get time estimates and live Google Maps directions.
- **Anywhere else** (`src/lib/discover.ts`): stay more than ~35 km from Tokyo or ~40 km from Kyoto/Osaka and the app looks up Wikipedia articles with coordinates within ~25 km of your stay, keeps the ones whose short description is something to visit (temple, museum, park, lake, market, tower…; stations, towns, hotels and the like are dropped), ranks them by page views over the last 30 days and gives each a typical visit length and best time of day. Built-in places in range (e.g. Chūreitō Pagoda when staying at Kawaguchiko) are mixed in. Results are cached per stay for two weeks. No opening hours are known for these, and every card says so.
- **Country-aware**: the stay's country and time zone (Photon reverse geocode, Open-Meteo `timezone=auto`) are saved with the plan. Clocks, dates, countdowns, weather and calendar exports use the destination's time; the calendar file is written in UTC so it shows correctly on a phone set to any zone. LUUP and Suica details only appear in the Japanese cities that have them; elsewhere the mode is "Transit" with a taxi / Grab driving option, and the Trains tab becomes **Transit** with a Getting around guide (Malaysia: Rapid KL, Touch 'n Go, Grab, free GoKL and CAT buses; other countries: the generic basics). GPS and place search work worldwide.
- **Multi-day trips**: plan up to 7 days at once. Must-sees are split across days by geography, places never repeat, later days relax interest matching so they still fill up. Day tabs in the Itinerary; Home offers to switch to today's day.
- **Weather**: Open-Meteo forecast (free, no key) for the trip dates, up to 16 days ahead: day summary, temperatures on day tabs, and a warning on outdoor stops when rain is 50%+ around your arrival time. Warn only, the plan is never changed automatically.
- **Food**: lunch (~12:30) and dinner (~19:00) rows in the itinerary at wherever you'll be, and a Home card at meal times. Ideas from OpenStreetMap, filtered by your food needs (halal / Muslim-friendly, vegetarian, no seafood); halal also lists mosques and prayer rooms within 5 km. Halal, Vegetarian and Prayer space categories in Nearby.
- **Planner** (`src/lib/planner.ts`): scores ~35 destinations by popularity and your interests, inserts the best ones where they add the least travel, and keeps the day feasible against typical opening hours, closed days (e.g. Imperial Palace East Gardens on Mon/Fri, Tsukiji on Sun/Wed) and your finish time. Time-of-day aware: shrines and markets early, views at dusk, nightlife late. One stop per area, then a reordering pass to remove zigzags.
- **Home**: local time at the destination, where you are (street-level), next stop, which line/direction/stop, the next action, Navigate, recommended mode with price and reason, schedule advice, Don Quijote picker when your plan passes one. 🏠 opens the route back to where you're staying from wherever you are.
- **Map**: your position, numbered stops, stations for upcoming train legs, walking route (OpenStreetMap foot routing), found places pinned.
- **Nearby**: live search for any place and categories around you or your next stop (landmarks with photos, Don Quijote, konbini, food, ramen, cafés, toilets, ATMs, drugstores, lockers, souvenirs, stations). Add any result to the day or set it as home.
- **Itinerary**: visited / skip / restore, reorder, add, remove, visit length, times, transport, notes on why each stop was picked, transport total. **Destination guide** with "Recommended for you" and interest filters, credited photos.
- **Trains**: beginner guide (Suica in Apple Wallet, gates, directions, transfers, exits, station codes, wrong train, low balance), sign glossary, etiquette, LUUP rules.
- **Group lobby** (peer to peer): start a lobby from Share, invite by link or QR, everyone edits one live plan. Visited / skip / reorder / add / time changes sync to every phone that has the app open, with who's online and a feed of who changed what. Phones connect directly over WebRTC (Trystero, public Nostr relays used only to find each other, data encrypted with the lobby code); nothing is stored on a server, so a phone catches up when it is opened while another member is online. Copies merge deterministically (last-writer-wins registers per stop, order and day settings, with tombstones for deletions; `src/lib/lobby.ts`).
- **Reminders**: leave-by countdown on Home ("Leave in 12 min", "Leave now", "8 min behind plan"); Add to Calendar exports the day or whole trip as .ics with an alert 10 minutes before each time to leave (fires even with the app closed); optional best-effort in-app notifications (iPhone: Home Screen app only).
- **Joining from the Home Screen app**: iPhone opens shared links (and camera-scanned QR codes) in Safari, whose storage is separate from the Home Screen app. Invites therefore also carry a short lobby code, and the app has **Join with invite** (Share sheet, Settings, first setup screen) to paste a link or type the code. A link opened in Safari on iPhone explains this and offers Copy invite.
- **Share**: send a one-off copy of a plan as a link or QR code. The plan travels inside the link (compressed, nothing uploaded); opening it on another phone offers to load it.
- **Currency**: local currency ↔ your currency converter (default MYR; yen in Japan, ringgit in Malaysia; when they're the same it shows yen) with live reference rates against the US dollar so any pair works (European Central Bank via Frankfurter; ExchangeRate-API as fallback and for currencies the ECB doesn't publish), kept for offline use; converted amounts shown next to fares and the day's transport total.
- **Settings**: home, LUUP plan, interests, food needs, currency, theme, start over.
- Offline: app shell and saved plan always; **Save for offline** (Itinerary / Settings) fetches the map around each stop (zoom 14–16, ~500 m, capped at 400 tiles to respect OpenStreetMap's tile policy) and the plan's photos; anything viewed before is cached too.

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
  data/morePlaces.ts  extra Tokyo destinations for the planner and guide
  data/regions.ts     Kyoto, Osaka, Nara and day-trip destinations, region detection
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
