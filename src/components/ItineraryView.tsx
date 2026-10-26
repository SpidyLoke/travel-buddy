import { ArrowDown, ArrowUp, CalendarPlus, Check, RefreshCw, ChevronDown, Clock, ListChecks, MapPin, Minus, Navigation, Plus, Share2, SkipForward, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { getPlace, PLACES, placeLabel } from '../data/places'
import type { ItineraryApi } from '../hooks/useItinerary'
import type { Geo } from '../hooks/useGeolocation'
import type { TripApi } from '../hooks/useTrip'
import { homePlace, type HomeTrip } from '../lib/home'
import { regionOf } from '../data/regions'
import { downloadIcs } from '../lib/calendar'
import { inHome } from '../lib/fx'
import { scorePlace, whyPlace } from '../lib/planner'
import { INTEREST_LABEL, INTERESTS, type Prefs } from '../lib/prefs'
import { directionsUrl, modeToGoogle } from '../lib/maps'
import { costFor, recommend } from '../lib/pricing'
import type { Advice, Timeline } from '../lib/schedule'
import { dateLabel, fmtDuration, fmtMin, parseHm, planDayStatus, todayJst } from '../lib/time'
import type { Interest, ItineraryStop, LatLng, Place, TransportMode } from '../types'
import { MODE_META } from './Journey'
import { HomeCard } from './HomeTrip'
import { PlaceCard } from './PlaceCard'
import { OfflineButton } from './OfflineButton'
import { PlacePhoto } from './PlacePhoto'
import { MealRow, mealSlots, type MealSlot } from './Food'
import { DayWeatherNote, RainWarning, WeatherBadge } from './Weather'
import { ShopChips } from './Donki'
import { Button, Card, LinkButton, Notice, Pill, SectionTitle } from './ui'

interface Props {
  itin: ItineraryApi
  timeline: Timeline
  advice: Advice
  gps: LatLng | null
  openJourney: (stopId: string) => void
  showOnMap: (p: Place) => void
  trip: HomeTrip
  openHome: () => void
  geo: Geo
  prefs: Prefs
  planNew: () => void
  openShare: () => void
  lobbyBar: ReactNode
  tripPlan: TripApi
  openFood: (slot: MealSlot) => void
  onReplan: () => void
}

export function ItineraryView({ itin, timeline, advice, gps, openJourney, showOnMap, trip, openHome, geo, prefs, planNew, openShare, lobbyBar, tripPlan, openFood, onReplan }: Props) {
  const [tab, setTab] = useState<'day' | 'places'>('day')
  return (
    <div className="pt-safe bottom-nav-space px-4">
      <div className="flex items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tab === 'day' ? 'My day' : 'Places'}</h1>
          {tab === 'day' && itin.state.date && <div className="text-[14px] text-muted">{dateLabel(itin.state.date)}</div>}
        </div>
        <div className="flex gap-2">
          <Button className="min-h-10 px-3 text-[14px]" onClick={openShare} aria-label="Share plan">
            <Share2 size={16} /> Share
          </Button>
          <Button variant="primary" className="min-h-10 px-3 text-[14px]" onClick={planNew}>
            <Sparkles size={16} /> New plan
          </Button>
        </div>
      </div>
      {lobbyBar && <div className="mt-3">{lobbyBar}</div>}
      {tripPlan.days.length > 1 && (
        <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none]">
          <div className="flex gap-2 w-max">
            {tripPlan.days.map((d, i) => (
              <button
                key={d.date ?? i}
                onClick={() => tripPlan.switchDay(i)}
                aria-pressed={i === tripPlan.active}
                className={`rounded-2xl px-3.5 py-2 text-left ${i === tripPlan.active ? 'bg-accent text-white' : 'bg-card'}`}
              >
                <div className="text-[13px] font-bold">
                  Day {i + 1}
                  {i === tripPlan.todayIndex && ' · today'}
                </div>
                <div className="text-[12px] opacity-80">
                  {d.date ? dateLabel(d.date) : ''} <WeatherBadge date={d.date} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 rounded-2xl bg-card p-1 text-[15px] font-semibold">
        {(['day', 'places'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl py-2 ${tab === t ? 'bg-accent text-white' : 'text-muted'}`}>
            {t === 'day' ? 'Itinerary' : 'Destination guide'}
          </button>
        ))}
      </div>
      {tab === 'day' ? (
        <DayList itin={itin} timeline={timeline} advice={advice} gps={gps} openJourney={openJourney} showOnMap={showOnMap} trip={trip} openHome={openHome} geo={geo} openFood={openFood} onReplan={onReplan} />
      ) : (
        <PlacesGuide itin={itin} gps={gps} showOnMap={showOnMap} interests={prefs.interests} />
      )}
    </div>
  )
}

function DayList({ itin, timeline, advice, gps, openJourney, showOnMap, trip, openHome, geo, openFood, onReplan }: Omit<Props, 'prefs' | 'planNew' | 'openShare' | 'lobbyBar' | 'tripPlan'>) {
  const { state } = itin
  const meals = mealSlots(timeline)
  const [startText, setStartText] = useState(fmtMin(state.startMin))
  const [endText, setEndText] = useState(fmtMin(state.endMin))
  const start = getPlace(state.startPlaceId)
  const dayCost = timeline.entries.reduce(
    (acc, e) => {
      const c = costFor(e.prev, e.place, e.stop.transport)
      return c.yen == null ? { ...acc, unknown: acc.unknown + 1 } : { ...acc, yen: acc.yen + c.yen }
    },
    { yen: 0, unknown: 0 },
  )

  return (
    <div className="space-y-3 pt-3">
      <DayWeatherNote date={itin.state.date ?? todayJst()} />
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

      {timeline.started && timeline.nextIndex >= 0 && (planDayStatus(state.date) === 'today' || planDayStatus(state.date) === 'undated') && (
        <Button className="w-full text-[14px]" onClick={onReplan}>
          <RefreshCw size={16} /> Re-plan the rest of today from now
        </Button>
      )}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="pin start !size-9 shrink-0">S</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{start.name}</div>
            <div className="text-[13px] text-muted">{start.nameJa}</div>
          </div>
          <label className="text-right">
            <span className="block text-[11px] font-semibold uppercase text-muted">Start</span>
            <input
              type="time"
              value={startText}
              onChange={(e) => {
                setStartText(e.target.value)
                const m = parseHm(e.target.value)
                if (m != null) itin.setStart(m)
              }}
              className="bg-card-2 rounded-xl px-2 py-1.5 text-[16px] font-semibold tabular-nums"
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-muted">Day ends at</span>
          <input
            type="time"
            value={endText}
            onChange={(e) => {
              setEndText(e.target.value)
              const m = parseHm(e.target.value)
              if (m != null) itin.setEnd(m)
            }}
            className="bg-card-2 rounded-xl px-2 py-1.5 text-[16px] font-semibold tabular-nums"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">Set all remaining to</span>
          {(['train', 'luup', 'walk'] as TransportMode[]).map((m) => {
            const { Icon, label, colour } = MODE_META[m]
            return (
              <button key={m} onClick={() => itin.setAllTransport(m)} className="flex items-center gap-1 rounded-full bg-card-2 px-2.5 py-1.5 font-semibold">
                <Icon size={14} className={colour} /> {label}
              </button>
            )
          })}
        </div>
      </Card>

      <ol className="space-y-3">
        {state.stops.map((stop, i) => (
          <Fragment key={stop.id}>
          <StopCard
            key={stop.id}
            stop={stop}
            index={i}
            count={state.stops.length}
            itin={itin}
            timeline={timeline}
            gps={gps}
            openJourney={openJourney}
            showOnMap={showOnMap}
          />
          {meals
            .filter((m) => m.stopId === stop.id && stop.status === 'pending')
            .map((m) => (
              <li key={m.meal.label}>
                <MealRow slot={m} onOpen={() => openFood(m)} />
              </li>
            ))}
          </Fragment>
        ))}
      </ol>

      <HomeCard trip={trip} itin={itin} gps={gps} geo={geo} openHome={openHome} />

      <div className="flex justify-between items-center pt-1 px-1">
        <span className="text-[13px] text-muted">
          Planned finish {fmtMin(timeline.plannedEnd)} · now ~{fmtMin(timeline.projectedEnd)}
          <br />
          Transport today ≈ ¥{dayCost.yen.toLocaleString('en-GB')}
          {inHome(dayCost.yen)}
          {dayCost.unknown > 0 && ` + ${dayCost.unknown} fare${dayCost.unknown > 1 ? 's' : ''} in Maps`}
        </span>

      </div>
      <OfflineButton days={[state]} label="Save this day for offline (map + photos)" />
      <Button className="w-full text-[14px]" onClick={() => downloadIcs([state])}>
        <CalendarPlus size={16} /> Add this day to Calendar (with leave-by alerts)
      </Button>
      <p className="px-1 text-[12px] text-muted">Times are planning estimates, not train timetables. Add places from the Destination guide or the Nearby tab.</p>
    </div>
  )
}

interface StopProps {
  stop: ItineraryStop
  index: number
  count: number
  itin: ItineraryApi
  timeline: Timeline
  gps: LatLng | null
  openJourney: (stopId: string) => void
  showOnMap: (p: Place) => void
}

function StopCard({ stop, index, count, itin, timeline, gps, openJourney, showOnMap }: StopProps) {
  const [open, setOpen] = useState(false)
  const place = getPlace(stop.placeId)
  const entry = timeline.entries.find((e) => e.stop.id === stop.id)
  const isNext = timeline.nextIndex >= 0 && timeline.entries[timeline.nextIndex]?.stop.id === stop.id
  const { Icon, colour, label } = MODE_META[stop.transport]
  const late = entry && entry.projectedArrive - entry.plannedArrive > 10 && stop.status === 'pending'
  const dim = stop.status !== 'pending'

  return (
    <li>
      <Card className={`overflow-hidden ${isNext ? 'ring-2 ring-accent' : ''}`}>
        <div className="p-4">
          {stop.status === 'pending' && <PlacePhoto place={place} aspect="aspect-[21/9]" className="mb-3" />}
          <div className="flex items-start gap-3">
            <div className={`pin ${stop.status === 'done' ? 'done' : stop.status === 'skipped' ? 'skipped' : isNext ? 'next' : 'upcoming'} !size-9 shrink-0 !text-[13px]`}>
              {stop.status === 'done' ? '✓' : stop.status === 'skipped' ? '–' : index + 1}
            </div>
            <button className="flex-1 min-w-0 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              <div className={`text-[19px] font-bold leading-tight ${dim ? 'text-muted' : ''} ${stop.status === 'skipped' ? 'line-through' : ''}`}>{placeLabel(place)}</div>
              <div className="text-[13px] text-muted truncate">
                {place.name !== placeLabel(place) ? `${place.name} · ` : ''}
                {place.nameJa}
              </div>
              {stop.note && stop.status === 'pending' && <div className="mt-0.5 text-[13px] text-accent">{stop.note}</div>}
            </button>
            <div className="text-right shrink-0">
              {entry ? (
                <>
                  <div className={`text-[17px] font-bold tabular-nums ${late ? 'text-warn' : ''}`}>{fmtMin(stop.status === 'pending' ? entry.projectedArrive : entry.plannedArrive)}</div>
                  {late && <div className="text-[11px] text-muted line-through tabular-nums">{fmtMin(entry.plannedArrive)}</div>}
                </>
              ) : (
                <Pill className="bg-card-2 text-muted">Skipped</Pill>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
            <Pill className="bg-card-2">
              <Icon size={14} className={colour} /> {label}
              {entry && ` ~${fmtDuration(entry.travel.min)}${entry.travel.source === 'calc' ? '*' : ''} · ${costFor(entry.prev, place, stop.transport).label}`}
            </Pill>
            {entry && stop.status === 'pending' && recommend(entry.prev, place).mode !== stop.transport && (
              <button
                className="rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent"
                onClick={() => itin.updateStop(stop.id, { transport: recommend(entry.prev, place).mode })}
              >
                Try {MODE_META[recommend(entry.prev, place).mode].label}
              </button>
            )}
            <Pill className="bg-card-2">
              <Clock size={13} /> Stay {fmtDuration(stop.durationMin)}
            </Pill>
            {stop.must && <Pill className="bg-accent/12 text-accent">Your pick</Pill>}
            {entry && stop.status === 'pending' && <RainWarning place={place} date={itin.state.date ?? todayJst()} atMin={entry.projectedArrive} />}
            <ShopChips stopPlaceId={place.id} />
            {place.closesLabel && <Pill className="bg-warn/15 text-[#a66a00] dark:text-warn">{place.closesLabel}</Pill>}
            <button className="ml-auto text-muted" onClick={() => setOpen((v) => !v)} aria-label="More">
              <ChevronDown size={20} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {stop.status === 'pending' && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <LinkButton variant={isNext ? 'primary' : 'secondary'} className="px-2 text-[14px]" href={directionsUrl(place, modeToGoogle[stop.transport], isNext ? gps ?? entry?.prev : entry?.prev)}>
                <Navigation size={16} /> Go
              </LinkButton>
              <Button className="px-2 text-[14px]" onClick={() => itin.setStatus(stop.id, 'done')}>
                <Check size={16} className="text-ok" /> Visited
              </Button>
              <Button className="px-2 text-[14px]" onClick={() => itin.setStatus(stop.id, 'skipped')}>
                <SkipForward size={16} /> Skip
              </Button>
            </div>
          )}
          {stop.status !== 'pending' && (
            <Button variant="ghost" className="mt-2 text-accent text-[14px] min-h-9 px-0" onClick={() => itin.setStatus(stop.id, 'pending')}>
              <Undo2 size={15} /> Restore
            </Button>
          )}
        </div>

        {open && (
          <div className="border-t border-line p-4 space-y-3 bg-card">
            {stop.status !== 'pending' && <PlacePhoto place={place} />}
            <p className="text-[15px] leading-snug">{place.description}</p>
            {place.hours && <p className="text-[13px] text-muted">Typical hours: {place.hours} Check before going.</p>}
            <div>
              <div className="text-[12px] font-semibold uppercase text-muted mb-1.5">Getting there</div>
              <div className="grid grid-cols-3 gap-2">
                {(['train', 'luup', 'walk'] as TransportMode[]).map((m) => {
                  const meta = MODE_META[m]
                  return (
                    <button
                      key={m}
                      onClick={() => itin.updateStop(stop.id, { transport: m })}
                      className={`rounded-xl py-2 flex items-center justify-center gap-1.5 font-semibold text-[14px] border-2 ${stop.transport === m ? 'border-accent' : 'border-transparent bg-card-2'}`}
                    >
                      <meta.Icon size={15} className={meta.colour} /> {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase text-muted">Visit length</span>
              <div className="flex items-center gap-2">
                <Button className="size-10 !min-h-10 !px-0" aria-label="15 minutes less" onClick={() => itin.updateStop(stop.id, { durationMin: Math.max(0, stop.durationMin - 15) })}>
                  <Minus size={16} />
                </Button>
                <span className="w-20 text-center font-semibold tabular-nums">{fmtDuration(stop.durationMin)}</span>
                <Button className="size-10 !min-h-10 !px-0" aria-label="15 minutes more" onClick={() => itin.updateStop(stop.id, { durationMin: stop.durationMin + 15 })}>
                  <Plus size={16} />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="text-[14px]" onClick={() => openJourney(stop.id)} disabled={!entry}>
                <ListChecks size={16} /> Step-by-step
              </Button>
              <Button className="text-[14px]" onClick={() => showOnMap(place)}>
                <MapPin size={16} /> On map
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button className="flex-1 text-[14px]" disabled={index === 0} onClick={() => itin.move(stop.id, -1)}>
                <ArrowUp size={16} /> Earlier
              </Button>
              <Button className="flex-1 text-[14px]" disabled={index === count - 1} onClick={() => itin.move(stop.id, 1)}>
                <ArrowDown size={16} /> Later
              </Button>
              <Button
                variant="danger"
                className="text-[14px]"
                aria-label="Remove"
                onClick={() => confirm(`Remove ${placeLabel(place)} from the itinerary?`) && itin.remove(stop.id)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </li>
  )
}

type GuideArea = 'tokyo' | 'tokyo-trips' | 'kansai' | 'kansai-trips'
const GUIDE_AREAS: { id: GuideArea; label: string }[] = [
  { id: 'tokyo', label: 'Tokyo' },
  { id: 'tokyo-trips', label: 'Day trips from Tokyo' },
  { id: 'kansai', label: 'Kyoto & Osaka' },
  { id: 'kansai-trips', label: 'Nara' },
]

function PlacesGuide({ itin, gps, showOnMap, interests }: { itin: ItineraryApi; gps: LatLng | null; showOnMap: (p: Place) => void; interests: Interest[] }) {
  const [filter, setFilter] = useState<Interest | 'all'>('all')
  const homeRegion = (() => {
    const h = homePlace(itin.state)
    return Number.isFinite(h.lat) ? regionOf(h) : 'tokyo'
  })()
  const [area, setArea] = useState<GuideArea>(homeRegion === 'kansai' ? 'kansai' : 'tokyo')
  const inPlan = new Set(itin.state.stops.map((s) => s.placeId))
  const inArea = (p: Place) =>
    area === 'tokyo'
      ? (p.region ?? 'tokyo') === 'tokyo' && !p.dayTrip
      : area === 'tokyo-trips'
        ? (p.region ?? 'tokyo') === 'tokyo' && !!p.dayTrip
        : area === 'kansai'
          ? p.region === 'kansai' && !p.dayTrip
          : p.region === 'kansai' && !!p.dayTrip
  const visible = PLACES.filter((p) => !p.hidden && p.id !== itin.state.startPlaceId && !p.custom && inArea(p))
  const recommended = visible
    .filter((p) => p.tags?.length && p.kind !== 'shop' && !inPlan.has(p.id))
    .sort((a, b) => scorePlace(b, interests) - scorePlace(a, interests))
    .slice(0, 5)
  const list = filter === 'all' ? visible : visible.filter((p) => p.tags?.includes(filter))

  return (
    <div>
      <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex gap-2 w-max">
          {GUIDE_AREAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setArea(a.id)}
              className={`rounded-2xl px-3.5 py-2 text-[14px] font-semibold ${area === a.id ? 'bg-accent text-white' : 'bg-card'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <SectionTitle>Recommended for you</SectionTitle>
      <p className="px-1 -mt-1 mb-2 text-[13px] text-muted">
        {interests.length ? `Based on ${interests.map((i) => INTEREST_LABEL[i]).join(', ')}.` : 'Tokyo classics. Set interests in Settings to personalise.'} Not already in your day.
      </p>
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex gap-3 w-max pb-1">
          {recommended.map((p) => (
            <Card key={p.id} className="w-64 p-3 space-y-2 shrink-0">
              <PlacePhoto place={p} />
              <div className="font-bold leading-tight">{p.name}</div>
              <div className="text-[13px] text-accent">{whyPlace(p, interests)}</div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="primary" className="min-h-10 px-2 text-[14px]" onClick={() => itin.add(p.id)}>
                  <Plus size={15} /> Add
                </Button>
                <Button className="min-h-10 px-2 text-[14px]" onClick={() => showOnMap(p)}>
                  <MapPin size={15} /> Map
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <SectionTitle>All destinations</SectionTitle>
      <div className="-mx-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
        <div className="flex gap-2 w-max">
          {(['all', ...INTERESTS] as const).map((i) => (
            <button
              key={i}
              onClick={() => setFilter(i)}
              className={`rounded-full px-3.5 py-2 text-[14px] font-semibold ${filter === i ? 'bg-accent text-white' : 'bg-card'}`}
            >
              {i === 'all' ? 'All' : INTEREST_LABEL[i]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {list.map((p) => (
          <PlaceCard key={p.id} place={p} gps={gps} inPlan={inPlan.has(p.id)} onAdd={() => itin.add(p.id)} onMap={() => showOnMap(p)} />
        ))}
      </div>
    </div>
  )
}
