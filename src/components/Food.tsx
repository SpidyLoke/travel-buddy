import { ExternalLink, Footprints, LoaderCircle, TrainFront, Utensils } from 'lucide-react'
import { useEffect, useState } from 'react'
import { placeLabel } from '../data/places'
import { findFood, findPrayerSpaces, MEALS, type FoodResult, type Meal } from '../lib/food'
import { formatDistance } from '../lib/geo'
import { directionsUrl } from '../lib/maps'
import type { NearbyResult } from '../lib/nearby'
import { DIET_LABEL, getPrefs, type Diet } from '../lib/prefs'
import type { Timeline } from '../lib/schedule'
import { fmtMin } from '../lib/time'
import type { LatLng, Place } from '../types'
import { Card, LinkButton, Notice, Pill, SectionTitle, Sheet } from './ui'

export interface MealSlot {
  meal: Meal
  place: Place
  /** Stop the meal falls at or just before. */
  stopId: string
}

/** Where you'll be at lunch and dinner time, from the projected timeline. */
export function mealSlots(tl: Timeline): MealSlot[] {
  const out: MealSlot[] = []
  for (const meal of MEALS) {
    const i = tl.entries.findIndex((e, k) => {
      const next = tl.entries[k + 1]
      return meal.at >= e.projectedArrive - 30 && (meal.at <= e.projectedDepart || (next && meal.at < next.projectedArrive))
    })
    if (i < 0) continue
    const e = tl.entries[i]
    // Between stops: eat where you are heading.
    const atNext = meal.at > e.projectedDepart && tl.entries[i + 1]
    const target = atNext ? tl.entries[i + 1] : e
    out.push({ meal, place: target.place, stopId: target.stop.id })
  }
  return out
}

export function MealRow({ slot, onOpen }: { slot: MealSlot; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-3 text-left">
      <Utensils size={18} className="shrink-0 text-accent" />
      <span className="flex-1 text-[14px]">
        <b>
          {slot.meal.label} ~{fmtMin(slot.meal.at)}
        </b>{' '}
        near {placeLabel(slot.place)}
      </span>
      <span className="text-[13px] font-semibold text-accent">Ideas</span>
    </button>
  )
}

function Badges({ r }: { r: FoodResult }) {
  return (
    <>
      {r.halal && <Pill className="bg-ok/12 text-ok">Halal</Pill>}
      {r.vegetarian && <Pill className="bg-ok/12 text-ok">Vegetarian</Pill>}
    </>
  )
}

function ResultRow({ r, gps, food }: { r: NearbyResult; gps: LatLng | null; food?: FoodResult }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold leading-tight">{r.place.name}</div>
          {r.place.nameJa !== r.place.name && <div className="text-[13px] text-muted">{r.place.nameJa}</div>}
          {r.detail && <div className="mt-0.5 text-[13px] text-muted line-clamp-2">{r.detail}</div>}
        </div>
        <span className="shrink-0 text-[14px] font-bold tabular-nums">{formatDistance(r.km)}</span>
      </div>
      {food && (food.halal || food.vegetarian) && (
        <div className="flex gap-2">
          <Badges r={food} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <LinkButton variant={r.km < 1.5 ? 'primary' : 'secondary'} className="min-h-10 text-[14px]" href={directionsUrl(r.place, 'walking', gps)}>
          <Footprints size={15} /> Walk
        </LinkButton>
        <LinkButton className="min-h-10 text-[14px]" href={directionsUrl(r.place, 'transit', gps)}>
          <TrainFront size={15} /> Train
        </LinkButton>
      </div>
    </Card>
  )
}

/** Food ideas (and prayer spaces for halal) around a place. */
export function FoodSheet({ title, near, gps, online, onClose }: { title: string; near: Place; gps: LatLng | null; online: boolean; onClose: () => void }) {
  const [diet, setDiet] = useState<Diet[]>(getPrefs().diet)
  const [food, setFood] = useState<FoodResult[] | null>(null)
  const [prayer, setPrayer] = useState<NearbyResult[] | null>(null)
  const [error, setError] = useState(false)
  const halal = diet.includes('halal')

  useEffect(() => {
    if (!online) return
    const ctrl = new AbortController()
    setFood(null)
    setError(false)
    findFood(near, diet, ctrl.signal)
      .then(setFood)
      .catch(() => !ctrl.signal.aborted && setError(true))
    if (halal) findPrayerSpaces(near, ctrl.signal).then(setPrayer).catch(() => setPrayer([]))
    return () => ctrl.abort()
  }, [near, diet, halal, online])

  const query = `${diet.includes('halal') ? 'halal ' : diet.includes('vegetarian') ? 'vegetarian ' : ''}restaurant near ${placeLabel(near)}`
  const google = `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query })}`

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DIET_LABEL) as Diet[]).map((d) => (
            <button
              key={d}
              onClick={() => setDiet((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]))}
              className={`rounded-full px-3.5 py-2 text-[14px] font-semibold ${diet.includes(d) ? 'bg-accent text-white' : 'bg-card'}`}
            >
              {DIET_LABEL[d]}
            </button>
          ))}
        </div>
        {!online && <Notice tone="warn">Food search needs a connection.</Notice>}
        {error && <Notice tone="warn">Could not reach OpenStreetMap. Try Google Maps below.</Notice>}
        {online && !food && !error && (
          <div className="flex justify-center py-6 text-muted">
            <LoaderCircle className="animate-spin" />
          </div>
        )}
        {food?.length === 0 && <Notice tone="info">Nothing tagged nearby in OpenStreetMap. Google Maps usually knows more.</Notice>}
        {food?.map((r) => <ResultRow key={r.place.id} r={r} gps={gps} food={r} />)}
        <LinkButton className="w-full text-[14px]" href={google}>
          <ExternalLink size={16} /> Search “{query}” in Google Maps
        </LinkButton>
        {(diet.includes('halal') || diet.includes('vegetarian')) && (
          <p className="px-1 text-[12px] text-muted">Diet labels come from OpenStreetMap contributors. Confirm with the restaurant (look for halal certification or ask staff).</p>
        )}

        {halal && (
          <>
            <SectionTitle>Prayer spaces</SectionTitle>
            {prayer == null && online && (
              <div className="flex justify-center py-4 text-muted">
                <LoaderCircle className="animate-spin" />
              </div>
            )}
            {prayer?.length === 0 && <Notice tone="info">None mapped within 5 km. Many stations, airports and department stores have prayer rooms: ask at an information desk.</Notice>}
            {prayer?.map((r) => <ResultRow key={r.place.id} r={r} gps={gps} />)}
            <LinkButton className="w-full text-[14px]" href={`https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: `prayer room near ${placeLabel(near)}` })}`}>
              <ExternalLink size={16} /> Search prayer rooms in Google Maps
            </LinkButton>
          </>
        )}
      </div>
    </Sheet>
  )
}
