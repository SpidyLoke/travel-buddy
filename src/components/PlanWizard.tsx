import { ArrowLeft, Check, Home, LoaderCircle, MapPin, Shuffle, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PLACES, placeLabel } from '../data/places'
import { CITY_CENTRES, DAY_TRIPS, regionOf } from '../data/regions'
import type { Geo } from '../hooks/useGeolocation'
import { addDays, planToItinerary, planTrip, type PlanInput } from '../lib/planner'
import { DIET_LABEL, INTEREST_LABEL, INTERESTS, withPrefs, type Diet, type Prefs } from '../lib/prefs'
import { dateLabel, fmtDuration, fmtMin, nowMinLocal, parseHm, todayLocal, withTimeZone, zoneLabel } from '../lib/time'
import { curatedNear, discoverNearby } from '../lib/discover'
import { localeAt, type Locale } from '../lib/locale'
import type { Interest, ItineraryState, LuupPlan, Pace, Place } from '../types'
import { MODE_META } from './Journey'
import { refreshWeather } from '../lib/weather'
import { PlacePhoto } from './PlacePhoto'
import { PhotosProvider } from '../hooks/usePhotos'
import { RainWarning, WeatherBadge } from './Weather'
import { JoinWithInvite, type JoinInvite } from './Lobby'
import { PlaceSearch } from './PlaceSearch'
import { Button, Card, Notice } from './ui'

type Step = 'welcome' | 'stay' | 'when' | 'likes' | 'extras' | 'preview'

interface Props {
  geo: Geo
  firstRun: boolean
  initialHome: Place | null
  prefs: Prefs
  visited: string[]
  /** One plan per day of the trip. */
  onDone: (days: ItineraryState[], prefs: Partial<Prefs>) => void
  onCancel?: () => void
  onJoinInvite: JoinInvite
}

/** Starting point when you have no hotel yet: a city centre. */
const cityHome = (i: number): Place => {
  const c = CITY_CENTRES[i]
  return {
    id: `city-${c.city.toLowerCase()}`,
    name: c.homeName,
    nameJa: c.homeName,
    mapsQuery: c.mapsQuery,
    lat: c.centre.lat,
    lng: c.centre.lng,
    area: c.city,
    description: '',
    activities: [],
    suggestedMin: 0,
    nearestStation: '',
    custom: true,
    country: c.country,
  }
}

function defaultDay(): { date: string; start: number } {
  const now = nowMinLocal()
  const today = todayLocal()
  if (now < 15 * 60) return { date: today, start: Math.max(9 * 60, Math.ceil((now + 15) / 15) * 15) }
  const t = new Date(Date.now() + 24 * 3600 * 1000)
  return { date: todayLocal(t), start: 10 * 60 }
}

const PACES: { id: Pace; label: string; hint: string }[] = [
  { id: 'relaxed', label: 'Relaxed', hint: 'Up to 4 stops, long visits' },
  { id: 'balanced', label: 'Balanced', hint: 'Up to 6 stops' },
  { id: 'packed', label: 'Packed', hint: 'Up to 8 stops, quick visits' },
]

const LUUPS: { id: LuupPlan; label: string; hint: string }[] = [
  { id: 'none', label: 'No LUUP', hint: 'Trains and walking only' },
  { id: 'payg', label: 'Pay per ride', hint: '~¥50 + ¥25/min, short hops only' },
  { id: 'sub', label: 'Subscription', hint: '¥200 per 30 min, LUUP up to ~4 km' },
]

export function PlanWizard({ geo, firstRun, initialHome, prefs, visited, onDone, onCancel, onJoinInvite }: Props) {
  const [joining, setJoining] = useState(false)
  const steps: Step[] = firstRun ? ['welcome', 'stay', 'when', 'likes', 'extras', 'preview'] : ['stay', 'when', 'likes', 'extras', 'preview']
  const [step, setStep] = useState<Step>(steps[0])
  const idx = steps.indexOf(step)
  const next = () => setStep(steps[Math.min(idx + 1, steps.length - 1)])
  const back = () => setStep(steps[Math.max(idx - 1, 0)])

  const [home, setHome] = useState<Place | null>(initialHome)
  const base = home ?? cityHome(0)
  const region = regionOf(base)

  // Country and time zone of the stay: dates, times and the plan follow the destination.
  // Kept with the coordinates it's for, so a new stay never runs with the last one's locale.
  const baseKey = `${base.lat},${base.lng}`
  const [found, setFound] = useState<{ key: string; locale: Locale } | null>(null)
  const locale = found?.key === baseKey ? found.locale : null
  useEffect(() => {
    const ctrl = new AbortController()
    localeAt(base, base.country ?? (region !== 'live' ? 'JP' : undefined), ctrl.signal).then((l) => setFound({ key: baseKey, locale: l }), () => {})
    return () => ctrl.abort()
  }, [baseKey])
  const inJapan = (locale?.country ?? base.country ?? 'JP') === 'JP'
  // LUUP and step-by-step trains: only in the cities with built-in guides.
  const cityGuide = inJapan && region !== 'live'

  // Outside the built-in city guides, find things to do around the stay.
  const [live, setLive] = useState<{ places: Place[]; status: 'idle' | 'loading' | 'ready' | 'error' }>({ places: [], status: 'idle' })
  useEffect(() => {
    if (region !== 'live' || !locale) return
    const ctrl = new AbortController()
    setLive({ places: [], status: 'loading' })
    discoverNearby(base, { inJapan: locale.country === 'JP', signal: ctrl.signal }).then(
      (places) => setLive({ places, status: 'ready' }),
      () => !ctrl.signal.aborted && setLive({ places: [], status: 'error' }),
    )
    return () => ctrl.abort()
  }, [region, locale])
  const liveLoading = region === 'live' && (!locale || live.status === 'loading')

  const d = useMemo(() => withTimeZone(locale?.tz, defaultDay), [locale?.tz])
  const [date, setDate] = useState(d.date)
  const [startText, setStartText] = useState(fmtMin(d.start))
  // Until you change them, date and start time follow the destination's clock.
  const [timesTouched, setTimesTouched] = useState(false)
  useEffect(() => {
    if (timesTouched) return
    setDate(d.date)
    setStartText(fmtMin(d.start))
  }, [d])
  const [endText, setEndText] = useState('21:00')
  const [interests, setInterests] = useState<Interest[]>(prefs.interests)
  const [pace, setPace] = useState<Pace>(prefs.pace)
  const [luup, setLuup] = useState<LuupPlan>(prefs.luup)
  const [musts, setMusts] = useState<string[]>([])
  const [diet, setDiet] = useState<Diet[]>(prefs.diet)
  const [skipVisited, setSkipVisited] = useState(visited.length > 0)
  const [seed, setSeed] = useState(0)
  const [days, setDays] = useState(1)
  const [dayTrips, setDayTrips] = useState<string[]>([])
  const tripOptions = DAY_TRIPS.filter((t) => t.from === region)
  const [shown, setShown] = useState(0)

  const startMin = parseHm(startText) ?? d.start
  const endMin = parseHm(endText) ?? 21 * 60
  const timeError = endMin - startMin < 120 ? 'Allow at least 2 hours between start and finish.' : null

  const input: PlanInput = {
    home: base,
    date,
    startMin,
    endMin,
    interests,
    pace,
    mustIds: musts,
    excludeIds: skipVisited ? visited : [],
    jitter: seed ? 3 : 0,
    extra: live.places,
    tz: locale?.tz,
    country: locale?.country,
  }
  // The planner reads the LUUP plan from prefs, so preview with the choice applied.
  // Inputs cannot change while the preview step is showing, so step + seed is enough.
  const trip = useMemo(
    () =>
      step === 'preview' && !liveLoading
        ? withTimeZone(locale?.tz, () =>
            withPrefs({ luup: cityGuide ? luup : 'none' }, () => planTrip({ ...input, startDate: date, days, dayTrips: dayTrips.filter((t) => tripOptions.some((o) => o.id === t)) })),
          )
        : null,
    [step, seed, liveLoading],
  )
  const day = trip?.[Math.min(shown, (trip?.length ?? 1) - 1)]
  // Forecast for the trip dates, so the preview can flag rainy outdoor stops.
  const [, setWx] = useState(0)
  useEffect(() => {
    if (step === 'preview' && trip) refreshWeather(input.home, trip.map((d) => d.input.date)).then(() => setWx((n) => n + 1))
  }, [step, trip])
  const plan = day?.plan ?? null

  const mustOptions =
    region === 'live'
      ? [...curatedNear(base), ...live.places].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 16)
      : PLACES.filter((p) => !p.hidden && !p.dayTrip && (p.region ?? 'tokyo') === region && p.tags?.length && p.kind !== 'shop' && (p.score ?? 0) >= 3).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <div className="fixed inset-0 z-[1100] bg-app overflow-y-auto">
      <div className="pt-safe px-4 pb-40 max-w-xl mx-auto">
        <div className="flex items-center justify-between pt-2 h-12">
          {idx > 0 ? (
            <button aria-label="Back" onClick={back} className="size-10 grid place-items-center rounded-full bg-card">
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <span key={s} className={`h-1.5 rounded-full transition-all ${i <= idx ? 'w-5 bg-accent' : 'w-1.5 bg-card'}`} />
            ))}
          </div>
          {onCancel ? (
            <button aria-label="Close" onClick={onCancel} className="size-10 grid place-items-center rounded-full bg-card">
              <X size={18} />
            </button>
          ) : (
            <span className="size-10" />
          )}
        </div>

        {step === 'welcome' && (
          <div className="pt-10 space-y-5">
            <div className="size-16 rounded-3xl bg-accent text-white grid place-items-center">
              <Sparkles size={30} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight leading-tight">Your days away, planned and navigated.</h1>
            <ul className="space-y-3 text-[17px]">
              <li>🗺️ A day plan built around what you like, in an order that makes sense.</li>
              <li>🚆 Step-by-step trains for first-timers in Japan; transit and taxi directions everywhere else.</li>
              <li>📍 Live help wherever you are: food, prayer spaces, toilets, landmarks and the way home.</li>
            </ul>
            <Card className="p-4 space-y-3">
              <button className="w-full text-left font-semibold text-accent" onClick={() => setJoining((v) => !v)}>
                Joining friends who already have a plan? Paste their invite
              </button>
              {joining && <JoinWithInvite onJoinInvite={onJoinInvite} />}
            </Card>
            <p className="text-muted">
              Built-in guides for Tokyo, Kyoto, Osaka and day trips like Kamakura, Hakone, Fuji and Nara. Anywhere else, such as Kawaguchiko, Kuala Lumpur or Penang,
              it finds things to do around your stay. About a minute to set up. Everything stays on your phone.
            </p>
          </div>
        )}

        {step === 'stay' && (
          <div className="pt-6 space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">Where are you staying?</h1>
            <p className="text-muted">Your day starts and ends here, and the app can always guide you back.</p>
            {home && (
              <Card className="p-4 flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-accent text-white grid place-items-center shrink-0">
                  <Home size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{home.name}</div>
                  <div className="text-[13px] text-muted truncate">{home.area || home.description || 'Saved as home'}</div>
                </div>
                <Check className="text-ok" />
              </Card>
            )}
            <PlaceSearch geo={geo} onPick={setHome} />
            {!home && (
              <div>
                <div className="px-1 pb-2 text-[13px] font-semibold text-muted">No hotel yet? Start from a city centre:</div>
                <div className="grid grid-cols-2 gap-2">
                  {CITY_CENTRES.map((c, i) => (
                    <Button key={c.city} onClick={() => setHome(cityHome(i))}>
                      {c.city}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'when' && (
          <div className="pt-6 space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">When are you going?</h1>
            <Card className="p-4 space-y-4">
              <label className="flex items-center justify-between gap-3">
                <span className="font-semibold">Date</span>
                <input type="date" value={date} min={todayLocal()} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setTimesTouched(true) } }} className="bg-card-2 rounded-xl px-3 py-2 text-[16px]" />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="font-semibold">Leave home at</span>
                <input type="time" value={startText} onChange={(e) => { setStartText(e.target.value); setTimesTouched(true) }} className="bg-card-2 rounded-xl px-3 py-2 text-[16px] tabular-nums" />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="font-semibold">Wrap up by</span>
                <input type="time" value={endText} onChange={(e) => setEndText(e.target.value)} className="bg-card-2 rounded-xl px-3 py-2 text-[16px] tabular-nums" />
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">Days</span>
                <div className="flex items-center gap-2">
                  <Button className="size-10 !min-h-10 !px-0" aria-label="One day fewer" disabled={days <= 1} onClick={() => setDays((n) => n - 1)}>
                    –
                  </Button>
                  <span className="w-8 text-center text-lg font-bold tabular-nums">{days}</span>
                  <Button className="size-10 !min-h-10 !px-0" aria-label="One day more" disabled={days >= 7} onClick={() => setDays((n) => n + 1)}>
                    +
                  </Button>
                </div>
              </div>
            </Card>
            <p className="px-1 text-[14px] text-muted">
              {days === 1 ? dateLabel(date) : `${dateLabel(date)} to ${dateLabel(addDays(date, days - 1))}`}. Opening days and hours are planned around
              {days === 1 ? ' this date' : ' each date'}; the same hours apply every day.{locale && ` Times are ${zoneLabel(locale.tz)}.`}
            </p>
            {timeError && <Notice tone="warn">{timeError}</Notice>}
          </div>
        )}

        {step === 'likes' && (
          <div className="pt-6 space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">What do you enjoy?</h1>
            <p className="text-muted">Pick any. None means a classic first-timer's day.</p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <button
                  key={i}
                  onClick={() => setInterests((l) => toggle(l, i))}
                  className={`rounded-full px-4 py-2.5 text-[15px] font-semibold ${interests.includes(i) ? 'bg-accent text-white' : 'bg-card'}`}
                >
                  {INTEREST_LABEL[i]}
                </button>
              ))}
            </div>
            <h2 className="pt-2 text-xl font-bold">Pace</h2>
            <div className="grid grid-cols-3 gap-2">
              {PACES.map((p) => (
                <button key={p.id} onClick={() => setPace(p.id)} className={`rounded-2xl p-3 text-left border-2 ${pace === p.id ? 'border-accent bg-card' : 'border-transparent bg-card'}`}>
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-[12px] text-muted">{p.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'extras' && (
          <div className="pt-6 space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">{cityGuide ? 'Getting around' : 'A few extras'}</h1>
            {cityGuide && <div className="space-y-2">
              {LUUPS.map((l) => (
                <button key={l.id} onClick={() => setLuup(l.id)} className={`w-full rounded-2xl p-4 text-left border-2 ${luup === l.id ? 'border-accent bg-card' : 'border-transparent bg-card'}`}>
                  <div className="font-semibold">{l.label}</div>
                  <div className="text-[13px] text-muted">{l.hint}</div>
                </button>
              ))}
              <p className="px-1 text-[13px] text-muted">LUUP is Tokyo's e-scooter share. New riders sign up in the LUUP app with ID and a short rules quiz.</p>
            </div>}
            <h2 className={`${cityGuide ? 'pt-2 ' : ''}text-xl font-bold`}>Food needs</h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DIET_LABEL) as Diet[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDiet((l) => toggle(l, d))}
                  className={`rounded-full px-3.5 py-2 text-[14px] font-semibold ${diet.includes(d) ? 'bg-accent text-white' : 'bg-card'}`}
                >
                  {DIET_LABEL[d]}
                </button>
              ))}
            </div>
            <p className="px-1 text-[13px] text-muted">Lunch and dinner ideas near your route will match these.</p>
            {tripOptions.length > 0 && (
              <>
                <h2 className="pt-2 text-xl font-bold">Day trips (optional)</h2>
                <div className="space-y-2">
                  {tripOptions.map((t) => {
                    const on = dayTrips.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        onClick={() => setDayTrips((l) => toggle(l, t.id))}
                        className={`w-full rounded-2xl p-4 text-left border-2 ${on ? 'border-accent bg-card' : 'border-transparent bg-card'}`}
                      >
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-[13px] text-muted">{t.blurb}</div>
                      </button>
                    )
                  })}
                </div>
                <p className="px-1 text-[13px] text-muted">
                  Each day trip takes a whole day{days > 1 ? ', from day 2 onwards' : ''}.{dayTrips.length > days ? ` You picked ${dayTrips.length} for ${days} day${days > 1 ? 's' : ''}: only the first ${days} fit.` : ''}
                </p>
              </>
            )}
            <h2 className="pt-2 text-xl font-bold">Must-sees (optional)</h2>
            {region === 'live' && liveLoading && (
              <p className="flex items-center gap-2 px-1 text-[14px] text-muted">
                <LoaderCircle size={16} className="animate-spin" /> Finding things to do near {base.name}…
              </p>
            )}
            {region === 'live' && live.status === 'error' && (
              <Notice tone="warn">Couldn't look up places near {base.name} (no connection?). The plan will use the built-in guide only.</Notice>
            )}
            <div className="flex flex-wrap gap-2">
              {mustOptions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setMusts((l) => toggle(l, p.id))}
                  className={`rounded-full px-3.5 py-2 text-[14px] font-semibold ${musts.includes(p.id) ? 'bg-accent text-white' : 'bg-card'}`}
                >
                  {placeLabel(p)}
                </button>
              ))}
            </div>
            {visited.length > 0 && (
              <label className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4">
                <span>
                  <span className="block font-semibold">Skip places I've visited</span>
                  <span className="block text-[13px] text-muted">{visited.length} visited on earlier days</span>
                </span>
                <input type="checkbox" checked={skipVisited} onChange={(e) => setSkipVisited(e.target.checked)} className="size-6 accent-[#0a84ff]" />
              </label>
            )}
          </div>
        )}

        {step === 'preview' && liveLoading && (
          <div className="pt-24 flex flex-col items-center gap-3 text-center text-muted">
            <LoaderCircle size={32} className="animate-spin text-accent" />
            <p>Finding the best things to do near {base.name}…</p>
          </div>
        )}

        {step === 'preview' && plan && (
          <div className="pt-6 space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">{days > 1 ? 'Your trip' : 'Your day'}</h1>
            {trip && trip.length > 1 && (
              <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
                <div className="flex gap-2 w-max">
                  {trip.map((d, i) => (
                    <button
                      key={d.input.date}
                      onClick={() => setShown(i)}
                      className={`rounded-2xl px-3.5 py-2 text-left ${i === shown ? 'bg-accent text-white' : 'bg-card'}`}
                    >
                      <div className="text-[13px] font-bold">Day {i + 1}</div>
                      <div className="text-[12px] opacity-80">{dateLabel(d.input.date)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-muted">
              {dateLabel(day!.input.date)} · from {input.home.name} <WeatherBadge date={day!.input.date} />
            </p>
            {plan.warnings.map((w) => (
              <Notice key={w} tone="warn">
                <span className="flex gap-2">
                  <TriangleAlert size={16} className="shrink-0 mt-0.5" />
                  {w}
                </span>
              </Notice>
            ))}
            <PhotosProvider online={navigator.onLine} places={plan.stops.map((s) => s.place).filter((p) => p.region === 'live')}>
              <ol className="space-y-2">
                {plan.stops.map((s, i) => {
                  const M = MODE_META[s.transport]
                  return (
                    <li key={s.place.id}>
                      <div className="flex items-center gap-2 px-2 pb-1 text-[12px] text-muted">
                        <M.Icon size={13} className={M.colour} /> {s.transport === 'train' && !cityGuide ? 'Transit' : M.label} ~{fmtDuration(s.travelMin)}
                      </div>
                      <Card className="p-4 flex gap-3">
                        <div className="pin upcoming !size-8 shrink-0 !text-[13px]">{i + 1}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="text-[17px] font-bold leading-tight">{placeLabel(s.place)}</div>
                            <div className="text-[14px] font-semibold tabular-nums shrink-0">
                              {fmtMin(s.start)}–{fmtMin(s.depart)}
                            </div>
                          </div>
                          {s.place.name !== placeLabel(s.place) && <div className="text-[13px] text-muted">{s.place.name}</div>}
                          <div className="mt-1 text-[13px] text-accent">{s.note}</div>
                          <div className="mt-1 empty:hidden">
                            <RainWarning place={s.place} date={day!.input.date} atMin={s.arrive} />
                          </div>
                          <PlacePhoto place={s.place} aspect="aspect-[21/9]" className="mt-2" />
                        </div>
                      </Card>
                    </li>
                  )
                })}
              </ol>
            </PhotosProvider>
            <Card className="p-4 flex items-center gap-3">
              <MapPin size={18} className="text-accent" />
              <span className="flex-1">Back home around</span>
              <span className="font-bold tabular-nums">{fmtMin(plan.homeArrive)}</span>
            </Card>
            {plan.stops.length === 0 && <Notice tone="warn">Nothing fits. Try a longer day or fewer must-sees.</Notice>}
            <p className="px-1 text-[12px] text-muted">
              Built from typical opening hours and travel estimates, not live timetables.
              {region === 'live' && ' Places found on Wikipedia come without opening hours: check before going.'} Edit, reorder or add places any time.
            </p>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-app/95 backdrop-blur border-t border-line px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto space-y-2">
          {step === 'preview' ? (
            <>
              <Button variant="primary" className="w-full min-h-14 text-[17px]" disabled={!trip?.some((d) => d.plan.stops.length)}
                onClick={() => trip && onDone(trip.map((d) => planToItinerary(d.input, d.plan)), { interests, pace, luup, diet, onboarded: true })}
              >
                <Check size={20} /> {days > 1 ? `Use this ${days}-day plan` : 'Use this plan'}
              </Button>
              <Button className="w-full" onClick={() => setSeed((n) => n + 1)}>
                <Shuffle size={18} /> Show me a different mix
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" className="w-full min-h-14 text-[17px]" disabled={step === 'when' && !!timeError} onClick={next}>
                {step === 'welcome' ? "Let's plan" : step === 'extras' ? (days > 1 ? 'Build my trip' : 'Build my day') : step === 'stay' && !home ? 'Skip for now' : 'Next'}
              </Button>
              {step === 'stay' && !home && <p className="text-center text-[13px] text-muted">No hotel yet? Pick a city above, or skip to start from central Tokyo.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

