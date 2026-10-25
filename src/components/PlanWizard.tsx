import { ArrowLeft, Check, Home, MapPin, Shuffle, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getPlace, PLACES, placeLabel } from '../data/places'
import type { Geo } from '../hooks/useGeolocation'
import { planDay, planToItinerary, type PlanInput } from '../lib/planner'
import { INTEREST_LABEL, INTERESTS, withPrefs, type Prefs } from '../lib/prefs'
import { dateLabel, fmtDuration, fmtMin, nowMinJst, parseHm, todayJst } from '../lib/time'
import type { Interest, ItineraryState, LuupPlan, Pace, Place } from '../types'
import { MODE_META } from './Journey'
import { PlacePhoto } from './PlacePhoto'
import { PlaceSearch } from './PlaceSearch'
import { Button, Card, Notice } from './ui'

type Step = 'welcome' | 'stay' | 'when' | 'likes' | 'extras' | 'preview'

interface Props {
  geo: Geo
  firstRun: boolean
  initialHome: Place | null
  prefs: Prefs
  visited: string[]
  onDone: (state: ItineraryState, prefs: Partial<Prefs>) => void
  onCancel?: () => void
}

const FALLBACK_HOME = () => ({ ...getPlace('tokyostation'), name: 'Central Tokyo (Tokyo Station)' })

function defaultDay(): { date: string; start: number } {
  const now = nowMinJst()
  const today = todayJst()
  if (now < 15 * 60) return { date: today, start: Math.max(9 * 60, Math.ceil((now + 15) / 15) * 15) }
  const t = new Date(Date.now() + 24 * 3600 * 1000)
  return { date: todayJst(t), start: 10 * 60 }
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

export function PlanWizard({ geo, firstRun, initialHome, prefs, visited, onDone, onCancel }: Props) {
  const steps: Step[] = firstRun ? ['welcome', 'stay', 'when', 'likes', 'extras', 'preview'] : ['stay', 'when', 'likes', 'extras', 'preview']
  const [step, setStep] = useState<Step>(steps[0])
  const idx = steps.indexOf(step)
  const next = () => setStep(steps[Math.min(idx + 1, steps.length - 1)])
  const back = () => setStep(steps[Math.max(idx - 1, 0)])

  const d = useMemo(defaultDay, [])
  const [home, setHome] = useState<Place | null>(initialHome)
  const [date, setDate] = useState(d.date)
  const [startText, setStartText] = useState(fmtMin(d.start))
  const [endText, setEndText] = useState('21:00')
  const [interests, setInterests] = useState<Interest[]>(prefs.interests)
  const [pace, setPace] = useState<Pace>(prefs.pace)
  const [luup, setLuup] = useState<LuupPlan>(prefs.luup)
  const [musts, setMusts] = useState<string[]>([])
  const [skipVisited, setSkipVisited] = useState(visited.length > 0)
  const [seed, setSeed] = useState(0)

  const startMin = parseHm(startText) ?? d.start
  const endMin = parseHm(endText) ?? 21 * 60
  const timeError = endMin - startMin < 120 ? 'Allow at least 2 hours between start and finish.' : null

  const input: PlanInput = {
    home: home ?? FALLBACK_HOME(),
    date,
    startMin,
    endMin,
    interests,
    pace,
    mustIds: musts,
    excludeIds: skipVisited ? visited : [],
    jitter: seed ? 3 : 0,
  }
  // The planner reads the LUUP plan from prefs, so preview with the choice applied.
  // Inputs cannot change while the preview step is showing, so step + seed is enough.
  const plan = useMemo(() => (step === 'preview' ? withPrefs({ luup }, () => planDay(input)) : null), [step, seed])

  const mustOptions = PLACES.filter((p) => !p.hidden && p.tags?.length && p.kind !== 'shop' && (p.score ?? 0) >= 3).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
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
            <h1 className="text-4xl font-bold tracking-tight leading-tight">Your Tokyo day, planned and navigated.</h1>
            <ul className="space-y-3 text-[17px]">
              <li>🗺️ A day plan built around what you like, in an order that makes sense.</li>
              <li>🚆 Step-by-step trains for first-timers: which line, which direction, where to get off.</li>
              <li>📍 Live help wherever you are: food, toilets, Donki, landmarks and the way home.</li>
            </ul>
            <p className="text-muted">About a minute to set up. Everything stays on your phone.</p>
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
          </div>
        )}

        {step === 'when' && (
          <div className="pt-6 space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">When are you going?</h1>
            <Card className="p-4 space-y-4">
              <label className="flex items-center justify-between gap-3">
                <span className="font-semibold">Date</span>
                <input type="date" value={date} min={todayJst()} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-card-2 rounded-xl px-3 py-2 text-[16px]" />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="font-semibold">Leave home at</span>
                <input type="time" value={startText} onChange={(e) => setStartText(e.target.value)} className="bg-card-2 rounded-xl px-3 py-2 text-[16px] tabular-nums" />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="font-semibold">Wrap up by</span>
                <input type="time" value={endText} onChange={(e) => setEndText(e.target.value)} className="bg-card-2 rounded-xl px-3 py-2 text-[16px] tabular-nums" />
              </label>
            </Card>
            <p className="px-1 text-[14px] text-muted">{dateLabel(date)}. Opening days and hours are planned around this date.</p>
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
            <h1 className="text-3xl font-bold tracking-tight">Getting around</h1>
            <div className="space-y-2">
              {LUUPS.map((l) => (
                <button key={l.id} onClick={() => setLuup(l.id)} className={`w-full rounded-2xl p-4 text-left border-2 ${luup === l.id ? 'border-accent bg-card' : 'border-transparent bg-card'}`}>
                  <div className="font-semibold">{l.label}</div>
                  <div className="text-[13px] text-muted">{l.hint}</div>
                </button>
              ))}
              <p className="px-1 text-[13px] text-muted">LUUP is Tokyo's e-scooter share. New riders sign up in the LUUP app with ID and a short rules quiz.</p>
            </div>
            <h2 className="pt-2 text-xl font-bold">Must-sees (optional)</h2>
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

        {step === 'preview' && plan && (
          <div className="pt-6 space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">Your day</h1>
            <p className="text-muted">
              {dateLabel(date)} · from {input.home.name}
            </p>
            {plan.warnings.map((w) => (
              <Notice key={w} tone="warn">
                <span className="flex gap-2">
                  <TriangleAlert size={16} className="shrink-0 mt-0.5" />
                  {w}
                </span>
              </Notice>
            ))}
            <ol className="space-y-2">
              {plan.stops.map((s, i) => {
                const M = MODE_META[s.transport]
                return (
                  <li key={s.place.id}>
                    <div className="flex items-center gap-2 px-2 pb-1 text-[12px] text-muted">
                      <M.Icon size={13} className={M.colour} /> {M.label} ~{fmtDuration(s.travelMin)}
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
                        <PlacePhoto place={s.place} aspect="aspect-[21/9]" className="mt-2" />
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ol>
            <Card className="p-4 flex items-center gap-3">
              <MapPin size={18} className="text-accent" />
              <span className="flex-1">Back home around</span>
              <span className="font-bold tabular-nums">{fmtMin(plan.homeArrive)}</span>
            </Card>
            {plan.stops.length === 0 && <Notice tone="warn">Nothing fits. Try a longer day or fewer must-sees.</Notice>}
            <p className="px-1 text-[12px] text-muted">Built from typical opening hours and travel estimates, not live timetables. Edit, reorder or add places any time.</p>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-app/95 backdrop-blur border-t border-line px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto space-y-2">
          {step === 'preview' ? (
            <>
              <Button variant="primary" className="w-full min-h-14 text-[17px]" disabled={!plan?.stops.length} onClick={() => plan && onDone(planToItinerary(input, plan), { interests, pace, luup, onboarded: true })}>
                <Check size={20} /> Use this plan
              </Button>
              <Button className="w-full" onClick={() => setSeed((n) => n + 1)}>
                <Shuffle size={18} /> Show me a different mix
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" className="w-full min-h-14 text-[17px]" disabled={step === 'when' && !!timeError} onClick={next}>
                {step === 'welcome' ? "Let's plan" : step === 'extras' ? 'Build my day' : step === 'stay' && !home ? 'Skip for now' : 'Next'}
              </Button>
              {step === 'stay' && !home && <p className="text-center text-[13px] text-muted">Skipping uses central Tokyo. Change it later in Settings.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

