import { ArrowRight, Bike, ExternalLink, Footprints, Info, TrainFront, TriangleAlert } from 'lucide-react'
import { findLeg } from '../data/legs'
import { placeLabel } from '../data/places'
import { formatDistance } from '../lib/geo'
import { directionsUrl, LUUP_URL } from '../lib/maps'
import { costFor, luupCost, LUUP_BLOCK_MIN, LUUP_BLOCK_YEN, recommend } from '../lib/pricing'
import { estimateTravel } from '../lib/schedule'
import { fmtDuration } from '../lib/time'
import type { LatLng, Leg, Place, TrainSegment, TransportMode } from '../types'
import { Card, LinkButton, Notice } from './ui'

export const MODE_META: Record<TransportMode, { label: string; Icon: typeof TrainFront; colour: string }> = {
  train: { label: 'Train', Icon: TrainFront, colour: 'text-accent' },
  luup: { label: 'LUUP', Icon: Bike, colour: 'text-luup' },
  walk: { label: 'Walk', Icon: Footprints, colour: 'text-ok' },
}

export interface Step {
  title: string
  detail?: string
  colour?: string
  badge?: string
}

function stationName(s: { name: string; nameJa: string; code?: string }) {
  return `${s.name} (${s.nameJa}${s.code ? ` · ${s.code}` : ''})`
}

export function buildTrainSteps(leg: Leg, dest: Place): Step[] {
  const steps: Step[] = []
  const first = leg.segments[0]
  steps.push({ title: leg.walkToStation ?? `Walk to ${first.from.name} Station`, detail: `Station: ${stationName(first.from)}` })
  steps.push({
    title: 'Tap your Suica or PASMO on the ticket gate',
    detail: 'The IC reader is the blue panel on the right-hand side of the gate. Wait for the beep and the gate to stay open.',
  })
  leg.segments.forEach((seg: TrainSegment, i) => {
    if (i > 0) {
      steps.push({
        title: `Transfer at ${seg.from.name} to the ${seg.line}`,
        detail: `Stay inside the gates and follow the ${seg.lineCode ? `"${seg.lineCode}" ` : ''}${seg.line} (${seg.lineJa}) signs.`,
        colour: seg.colour,
        badge: seg.lineCode,
      })
    }
    steps.push({
      title: `Go to the ${seg.line} platform for ${seg.direction}`,
      detail: `Look for ${seg.lineJa} and ${seg.directionJa}方面 (toward ${seg.direction}). Operator: ${seg.operator}.${seg.boardingTip ? ` ${seg.boardingTip}` : ''}`,
      colour: seg.colour,
      badge: seg.lineCode,
    })
    steps.push({
      title: `Ride ${seg.stops} stop${seg.stops > 1 ? 's' : ''}`,
      detail: seg.stopNames.join(' → '),
      colour: seg.colour,
      badge: seg.lineCode,
    })
    steps.push({ title: `Get off at ${seg.to.name}`, detail: stationName(seg.to), colour: seg.colour, badge: seg.to.code })
  })
  steps.push({ title: 'Tap out at the gate and follow the exit signs', detail: leg.exitTip })
  steps.push({ title: `Walk to ${dest.name}`, detail: dest.nameJa })
  return steps
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={i}>
          <Card className="p-4 flex gap-4">
            <div
              className="shrink-0 size-10 rounded-full grid place-items-center font-bold text-white text-[15px]"
              style={{ background: s.colour ?? '#0a84ff' }}
            >
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold leading-snug">{s.title}</div>
              {s.detail && <div className="mt-1 text-[15px] text-muted leading-snug">{s.detail}</div>}
            </div>
          </Card>
        </li>
      ))}
    </ol>
  )
}

export function LineSummary({ leg }: { leg: Leg }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {leg.segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight size={14} className="text-muted" />}
          <span className="rounded-lg px-2 py-1 text-[13px] font-bold text-white" style={{ background: seg.colour }}>
            {seg.line}
          </span>
        </span>
      ))}
    </div>
  )
}

interface CompareProps {
  from: Place
  to: Place
  selected: TransportMode
  onSelect: (m: TransportMode) => void
}

export function TransportCompare({ from, to, selected, onSelect }: CompareProps) {
  const leg = findLeg(from.id, to.id)
  const modes: TransportMode[] = ['train', 'luup', 'walk']
  const est = Object.fromEntries(modes.map((m) => [m, estimateTravel(from, to, m)])) as Record<TransportMode, ReturnType<typeof estimateTravel>>
  const walkTooFar = est.walk.km > 3.5
  const rec = recommend(from, to)

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {modes.map((m) => {
          const { label, Icon, colour } = MODE_META[m]
          const e = est[m]
          const active = selected === m
          return (
            <button
              key={m}
              onClick={() => onSelect(m)}
              aria-pressed={active}
              className={`rounded-2xl p-3 text-left border-2 transition-colors ${active ? 'border-accent bg-card' : 'border-transparent bg-card'}`}
            >
              <div className="flex items-center justify-between">
                <Icon size={20} className={colour} />
                {rec.mode === m && <span className="text-[10px] font-bold uppercase text-accent">Best</span>}
              </div>
              <div className="mt-2 font-semibold">{label}</div>
              <div className="text-[17px] font-bold tabular-nums">{costFor(from, to, m).label}</div>
              <div className="text-[13px] text-muted">
                ~{fmtDuration(e.min)}
                {e.source === 'calc' && '*'}
              </div>
              <div className="text-[12px] text-muted">
                {m === 'train' ? (leg ? `${leg.segments.length - 1} transfer${leg.segments.length === 2 ? '' : 's'}` : 'Fare in Maps') : m === 'walk' ? (walkTooFar ? 'Long walk' : formatDistance(e.km)) : `¥${LUUP_BLOCK_YEN}/${LUUP_BLOCK_MIN} min`}
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-2 rounded-2xl bg-accent/10 px-4 py-3 text-[14px]">
        <span className="font-bold text-accent">Recommended: {MODE_META[rec.mode].label}.</span> {rec.why}
        {selected !== rec.mode && (
          <button className="ml-1 font-semibold text-accent underline" onClick={() => onSelect(rec.mode)}>
            Switch
          </button>
        )}
      </div>
      <p className="mt-2 px-1 text-[12px] text-muted leading-snug">
        About {formatDistance(est.train.km)}. Times are planning estimates{Object.values(est).some((e) => e.source === 'calc') ? '; * = calculated from distance' : ''}. Train = adult Suica fare, checked Oct 2026{leg?.fareApprox ? ' (~ = could be one distance band off)' : ''}. LUUP = your subscription, ¥{LUUP_BLOCK_YEN} per started {LUUP_BLOCK_MIN} min.
      </p>
    </div>
  )
}

interface ModeProps {
  from: Place
  to: Place
  origin: LatLng | Place
}

export function TrainMode({ from, to, origin }: ModeProps) {
  const leg = findLeg(from.id, to.id)
  return (
    <div className="space-y-3">
      {leg ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <LineSummary leg={leg} />
            {leg.trainFareYen != null && (
              <span className="shrink-0 text-[15px] font-bold tabular-nums">
                {leg.fareApprox && '~'}¥{leg.trainFareYen} <span className="text-[12px] font-medium text-muted">Suica</span>
              </span>
            )}
          </div>
          <StepList steps={buildTrainSteps(leg, to)} />
          {leg.alternatives?.map((a, i) => (
            <Notice key={i} tone="info">
              {a}
            </Notice>
          ))}
        </>
      ) : (
        <Notice tone="info">
          No hand-written steps for {placeLabel(from)} → {placeLabel(to)} yet. Open live directions for the line, direction and transfers, then use the Train Guide tab if you get stuck.
        </Notice>
      )}
      <LinkButton variant="primary" className="w-full min-h-14 text-[17px]" href={directionsUrl(to, 'transit', origin)}>
        <TrainFront size={20} /> Open live train directions
      </LinkButton>
      <p className="px-1 text-[12px] text-muted">Google Maps shows live departures, platforms and fares. This app does not.</p>
    </div>
  )
}

export function WalkMode({ from, to, origin }: ModeProps) {
  const leg = findLeg(from.id, to.id)
  const e = estimateTravel(from, to, 'walk')
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="text-[17px] font-semibold">Walk about {fmtDuration(e.min)}</div>
        <div className="mt-1 text-[15px] text-muted">{leg?.walkNote ?? `Roughly ${formatDistance(e.km)} on foot.`}</div>
      </Card>
      {e.km > 3.5 && <Notice tone="warn">That is a long walk. The train will save energy for later stops.</Notice>}
      <LinkButton variant="primary" className="w-full min-h-14 text-[17px]" href={directionsUrl(to, 'walking', origin)}>
        <Footprints size={20} /> Open walking directions
      </LinkButton>
    </div>
  )
}

export function LuupMode({ from, to, origin }: ModeProps) {
  const leg = findLeg(from.id, to.id)
  const e = estimateTravel(from, to, 'luup')
  const tooFar = e.km > 5
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="text-[17px] font-semibold">
          Ride about {fmtDuration(e.min)}
          {e.source === 'calc' && '*'} · ¥{luupCost(e.min)}
        </div>
        <div className="mt-1 text-[15px] text-muted">
          {leg?.luupNote ?? `Roughly ${formatDistance(e.km)} by road. Find a port near you in the LUUP app and pick a return port near ${placeLabel(to)} before you unlock.`}
        </div>
      </Card>
      {tooFar && <Notice tone="warn">Over 5 km. The train is usually faster and you avoid riding in traffic.</Notice>}
      <Notice tone="bad">
        <span className="flex gap-2">
          <TriangleAlert size={18} className="shrink-0 mt-0.5" />
          <span>Ride on the road, on the left. No pedestrian streets (Nakamise, Takeshita, car-free Ginza / Akihabara). Rentals can only end at a LUUP port.</span>
        </span>
      </Notice>
      <LinkButton variant="luup" className="w-full min-h-14 text-[17px]" href={LUUP_URL}>
        <Bike size={20} /> Open LUUP
      </LinkButton>
      <LinkButton variant="secondary" className="w-full" href={directionsUrl(to, 'bicycling', origin)}>
        <ExternalLink size={18} /> Road route in Google Maps
      </LinkButton>
      <p className="px-1 text-[12px] text-muted flex gap-1.5">
        <Info size={14} className="shrink-0 mt-0.5" />
        This app has no scooter-legal routing or live scooter/port data. Google opens in cycling mode; if it falls back to walking paths, stay on roads. Port locations and availability are only in the LUUP app. Price assumes your subscription rate; going past {LUUP_BLOCK_MIN} min starts another block.
      </p>
    </div>
  )
}

export function ModeContent({ mode, ...p }: ModeProps & { mode: TransportMode }) {
  if (mode === 'walk') return <WalkMode {...p} />
  if (mode === 'luup') return <LuupMode {...p} />
  return <TrainMode {...p} />
}
