import { useState, type ReactNode } from 'react'
import { Check, Crosshair, Home, Share, X, ListChecks, LocateFixed, Navigation, SkipForward, SunMoon, Moon, Sun, WifiOff } from 'lucide-react'
import { findTrainLeg } from '../data/legs'
import { PLACES, placeLabel } from '../data/places'
import type { Geo } from '../hooks/useGeolocation'
import { POOR_ACCURACY_M } from '../hooks/useGeolocation'
import type { ItineraryApi } from '../hooks/useItinerary'
import { distanceKm, formatDistance, OFF_ROUTE_KM } from '../lib/geo'
import { directionsUrl, modeToGoogle } from '../lib/maps'
import type { HomeTrip } from '../lib/home'
import { costFor, recommend } from '../lib/pricing'
import { load, save } from '../lib/storage'
import type { Advice, Timeline } from '../lib/schedule'
import { fmtDuration, fmtMin, jstClock, jstDateLabel } from '../lib/time'
import type { Place, ThemePref } from '../types'
import { buildTrainSteps, LineSummary, MODE_META } from './Journey'
import { DonkiCard } from './Donki'
import { LocationHelp } from './LocationHelp'
import { Button, Card, LinkButton, Notice, Pill } from './ui'

interface Props {
  now: Date
  geo: Geo
  itin: ItineraryApi
  timeline: Timeline
  advice: Advice
  online: boolean
  theme: { pref: ThemePref; cycle: () => void }
  openJourney: () => void
  showOnMap: (p: Place) => void
  trip: HomeTrip
  openHome: () => void
}

/** Within this radius of the next stop we treat the user as having arrived. */
const ARRIVED_KM = 0.35

export function Dashboard({ now, geo, itin, timeline, advice, online, theme, openJourney, showOnMap, trip, openHome }: Props) {
  const cur = timeline.nextIndex >= 0 ? timeline.entries[timeline.nextIndex] : undefined
  const total = timeline.entries.length
  const done = timeline.entries.filter((e) => e.stop.status === 'done').length
  const pos = geo.position

  const nearest = pos
    ? PLACES.map((p) => ({ p, d: distanceKm(pos, p) })).sort((a, b) => a.d - b.d)[0]
    : null
  const distToNext = pos && cur ? distanceKm(pos, cur.place) : null
  const arrived = distToNext != null && distToNext < ARRIVED_KM
  const leg = cur ? findTrainLeg(cur.prev.id, cur.place.id) : undefined
  const mode = cur?.stop.transport ?? 'train'
  const ModeIcon = MODE_META[mode].Icon
  // GPS says you are nowhere near where this leg starts (e.g. you went off-plan).
  const livePos = geo.status === 'active' && !geo.outsideTokyo ? pos : null
  const boardAt = leg?.segments[0].from
  const offRoute = !!(livePos && cur && !arrived && distanceKm(livePos, cur.prev) > OFF_ROUTE_KM && (!boardAt || distanceKm(livePos, boardAt) > OFF_ROUTE_KM))
  const firstStep = offRoute
    ? `You are ${formatDistance(distanceKm(livePos!, cur!.prev))} from ${placeLabel(cur!.prev)}, where this route starts. Tap Navigate for live directions from where you are.`
    : cur && leg && mode === 'train'
      ? buildTrainSteps(leg, cur.place)[0]?.title
      : undefined
  const rec = cur ? recommend(cur.prev, cur.place) : null
  const cost = cur ? costFor(cur.prev, cur.place, mode) : null
  const ThemeIcon = theme.pref === 'dark' ? Moon : theme.pref === 'light' ? Sun : SunMoon

  return (
    <div className="pt-safe bottom-nav-space px-4 space-y-3">
      <header className="flex items-end justify-between pt-2">
        <div>
          <div className="text-[13px] font-semibold text-muted">{jstDateLabel(now)} · Japan time</div>
          <div className="text-4xl font-bold tracking-tight tabular-nums">{jstClock(now)}</div>
        </div>
        <div className="flex items-center gap-2">
          {!online && (
            <Pill className="bg-warn/20 text-[#a66a00] dark:text-warn">
              <WifiOff size={14} /> Offline
            </Pill>
          )}
          <button aria-label="Route home" onClick={openHome} className="size-10 grid place-items-center rounded-full bg-card">
            <Home size={18} />
          </button>
          <button aria-label={`Theme: ${theme.pref}`} onClick={theme.cycle} className="size-10 grid place-items-center rounded-full bg-card">
            <ThemeIcon size={18} />
          </button>
        </div>
      </header>

      <InstallHint />

      {/* Progress */}
      <div>
        <div className="flex justify-between text-[13px] text-muted font-medium mb-1.5">
          <span>
            {done} of {total} stops
          </span>
          <span>Finish ~{fmtMin(timeline.projectedEnd)}</span>
        </div>
        <div className="h-2 rounded-full bg-card overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>

      <Notice
        tone={advice.tone === 'ok' ? 'ok' : advice.tone === 'warn' ? 'warn' : 'bad'}
        action={
          advice.skipStopId ? (
            <Button variant="secondary" className="min-h-9 px-3 text-[13px]" onClick={() => itin.setStatus(advice.skipStopId!, 'skipped')}>
              Skip {advice.skipLabel}
            </Button>
          ) : undefined
        }
      >
        {advice.message}
      </Notice>

      {/* WHERE AM I */}
      <Card className="p-4">
        <Label>Where am I?</Label>
        {pos && nearest ? (
          <div className="mt-1">
            <div className="text-[22px] font-bold leading-tight">
              {nearest.d < 0.5 ? `At ${nearest.p.name}` : `${formatDistance(nearest.d)} from ${placeLabel(nearest.p)}`}
            </div>
            <div className="mt-1 text-[13px] text-muted flex items-center gap-1.5 flex-wrap">
              <LocateFixed size={14} />
              {geo.status === 'paused' ? (
                <span>Last known position · tracking off</span>
              ) : (
                <>
                  GPS ±{Math.round(geo.accuracy ?? 0)} m
                  {(geo.accuracy ?? 0) > POOR_ACCURACY_M && <span className="text-warn font-semibold">· weak signal, position may be off</span>}
                </>
              )}
              <button className="ml-auto font-semibold text-accent" onClick={geo.status === 'paused' ? geo.start : geo.stop}>
                {geo.status === 'paused' ? 'Resume GPS' : 'Stop GPS'}
              </button>
            </div>
            {geo.outsideTokyo && <div className="mt-2"><Notice tone="warn">You appear to be outside Tokyo. Distances will look large.</Notice></div>}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {geo.status === 'denied' || geo.status === 'unsupported' || geo.status === 'unavailable' ? (
              <LocationHelp geo={geo} />
            ) : (
              <Button variant="primary" className="w-full" onClick={geo.start} disabled={geo.status === 'locating'}>
                <Crosshair size={18} /> {geo.status === 'locating' ? 'Finding you…' : 'Show my location'}
              </Button>
            )}
          </div>
        )}
      </Card>

      {cur ? (
        <>
          {/* WHERE AM I GOING */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Label>{arrived ? 'You have arrived' : 'Where am I going?'}</Label>
                <div className="mt-1 text-[28px] font-bold leading-tight">{placeLabel(cur.place)}</div>
                <div className="text-[15px] text-muted">
                  {cur.place.name !== placeLabel(cur.place) && `${cur.place.name} · `}
                  {cur.place.nameJa}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] text-muted">{arrived ? 'Leave by' : 'Arrive'}</div>
                <div className="text-xl font-bold tabular-nums">{fmtMin(arrived ? cur.projectedDepart : cur.projectedArrive)}</div>
                {distToNext != null && !arrived && <div className="text-[13px] text-muted">{formatDistance(distToNext)} away</div>}
              </div>
            </div>
            {arrived && <p className="mt-2 text-[15px]">Enjoy it. Tap <b>Visited</b> when you leave and the next stop loads.</p>}
          </Card>

          {/* HOW DO I GET THERE */}
          {!arrived && rec && cost && (
            <Card className="p-4 space-y-3">
              <Label>How do I get there?</Label>
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-card-2 grid place-items-center">
                  <ModeIcon size={22} className={MODE_META[mode].colour} />
                </div>
                <div className="min-w-0">
                  <div className="text-[17px] font-semibold">
                    {MODE_META[mode].label} · ~{fmtDuration(cur.travel.min)}
                    {cur.travel.source === 'calc' && '*'} · {cost.label}
                  </div>
                  <div className="text-[13px] text-muted">{offRoute ? 'From your current location' : `From ${placeLabel(cur.prev)}`}</div>
                </div>
              </div>
              {rec.mode === mode ? (
                <div className="text-[14px] leading-snug">
                  <span className="font-bold text-accent">Recommended.</span> <span className="text-muted">{rec.why}</span>
                </div>
              ) : (
                <div className="rounded-2xl bg-accent/10 px-3 py-2.5 text-[14px] leading-snug flex items-center gap-3">
                  <span className="flex-1">
                    <span className="font-bold text-accent">
                      {MODE_META[rec.mode].label} is better here ({costFor(cur.prev, cur.place, rec.mode).label}).
                    </span>{' '}
                    {rec.why}
                  </span>
                  <Button variant="primary" className="min-h-9 px-3 text-[13px] shrink-0" onClick={() => itin.updateStop(cur.stop.id, { transport: rec.mode })}>
                    Switch
                  </Button>
                </div>
              )}
              {mode === 'train' && leg && (
                <div className="space-y-2">
                  <LineSummary leg={leg} />
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
                    <dt className="text-muted">Direction</dt>
                    <dd className="font-semibold">
                      {leg.segments[0].direction} <span className="text-muted font-normal">{leg.segments[0].directionJa}方面</span>
                    </dd>
                    <dt className="text-muted">Get off at</dt>
                    <dd className="font-semibold">
                      {leg.segments.at(-1)!.to.name} <span className="text-muted font-normal">{leg.segments.at(-1)!.to.nameJa}</span>
                    </dd>
                    {leg.segments.length > 1 && (
                      <>
                        <dt className="text-muted">Change at</dt>
                        <dd className="font-semibold">{leg.segments.slice(1).map((s) => s.from.name).join(', ')}</dd>
                      </>
                    )}
                  </dl>
                </div>
              )}
              <div className="rounded-2xl bg-card-2 p-3">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">What do I do next?</div>
                <div className="mt-0.5 text-[16px] font-semibold leading-snug">
                  {firstStep ?? (mode === 'luup' ? 'Open LUUP, find a port near you and choose a return port near your destination.' : mode === 'walk' ? 'Start walking. Tap Navigate for turn-by-turn.' : 'Tap Navigate for the live train route.')}
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-2">
            <LinkButton variant={mode === 'luup' ? 'luup' : 'primary'} className="min-h-14 text-[18px]" href={directionsUrl(cur.place, modeToGoogle[mode], geo.status === 'active' && !geo.outsideTokyo ? pos : undefined)}>
              <Navigation size={20} /> Navigate
            </LinkButton>
            <Button variant="secondary" className="min-h-13" onClick={openJourney}>
              <ListChecks size={18} /> {mode === 'train' ? 'View train instructions' : mode === 'luup' ? 'LUUP guide & options' : 'Walking & other options'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => itin.setStatus(cur.stop.id, 'done')}>
                <Check size={18} className="text-ok" /> Visited
              </Button>
              <Button variant="secondary" onClick={() => itin.setStatus(cur.stop.id, 'skipped')}>
                <SkipForward size={18} className="text-muted" /> Skip
              </Button>
            </div>
          </div>
          {cur.travel.source === 'calc' && <p className="px-1 text-[12px] text-muted">*Travel time calculated from distance, not a timetable.</p>}
        </>
      ) : (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-accent text-white grid place-items-center">
              <Home size={22} />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-bold uppercase tracking-wider text-muted">All stops done · head home</div>
              <div className="text-[22px] font-bold leading-tight">{trip.home.name}</div>
              <div className="text-[13px] text-muted">
                {trip.arriveMin != null ? `Leave now, home ~${fmtMin(trip.arriveMin)}` : 'Live directions from where you are'}
              </div>
            </div>
          </div>
          {trip.leg && <LineSummary leg={trip.leg} />}
          <LinkButton variant="primary" className="w-full min-h-14 text-[18px]" href={directionsUrl(trip.home, 'transit', livePos ?? undefined)}>
            <Navigation size={20} /> Navigate home
          </LinkButton>
          <Button className="w-full" onClick={openHome}>
            <ListChecks size={18} /> Steps, last train &amp; taxi
          </Button>
        </Card>
      )}

      <DonkiCard timeline={timeline} gps={livePos} showOnMap={showOnMap} />
    </div>
  )
}

const HINT_KEY = 'tokyo-day:install-hint-dismissed'

/** iPhone Safari only: suggests Add to Home Screen until dismissed or installed. */
function InstallHint() {
  const [show, setShow] = useState(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    return ios && !standalone && !load(HINT_KEY, false)
  })
  if (!show) return null
  return (
    <Notice
      tone="info"
      action={
        <button
          aria-label="Dismiss"
          onClick={() => {
            save(HINT_KEY, true)
            setShow(false)
          }}
        >
          <X size={18} />
        </button>
      }
    >
      Install it: tap <Share size={14} className="inline -mt-1" /> Share, then <b>Add to Home Screen</b>. Opens full screen and keeps working offline.
    </Notice>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-[12px] font-bold uppercase tracking-wider text-muted">{children}</div>
}
