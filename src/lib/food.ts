import type { LatLng, Place } from '../types'
import { distanceKm } from './geo'
import { makePlace, overpass, type NearbyResult, type OsmElement } from './nearby'
import type { Diet } from './prefs'

// Meal ideas and prayer spaces from OpenStreetMap. Diet tags are whatever
// mappers recorded: the UI always says to confirm with the restaurant.

const SEAFOOD = /sushi|seafood|fish|kaisen|kaiten|海鮮|寿司|鮨|魚/i

const HALAL_FILTERS = ['["diet:halal"~"yes|only"]', '["cuisine"~"halal",i]', '["name"~"halal|ハラル",i]']
const VEG_FILTERS = ['["diet:vegetarian"~"yes|only"]', '["diet:vegan"~"yes|only"]', '["cuisine"~"vegetarian|vegan",i]']
const FOOD = '["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]'

export interface FoodResult extends NearbyResult {
  halal: boolean
  vegetarian: boolean
  seafood: boolean
}

function toFood(el: OsmElement, at: LatLng): FoodResult | null {
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  const t = el.tags ?? {}
  const ja = t.name ?? t['name:ja']
  if (lat == null || lng == null || !ja) return null
  const cuisine = (t.cuisine ?? '').replace(/;/g, ', ').replace(/_/g, ' ')
  const halal = /yes|only/.test(t['diet:halal'] ?? '') || /halal/i.test(cuisine) || /halal|ハラル/i.test(ja)
  const vegetarian = /yes|only/.test(t['diet:vegetarian'] ?? '') || /yes|only/.test(t['diet:vegan'] ?? '') || /vegetarian|vegan/i.test(cuisine)
  const place = makePlace(`osm-${el.type}-${el.id}`, t['name:en'] ?? ja, ja, lat, lng, 'Food', { kind: 'shop', suggestedMin: 45 })
  return {
    place,
    km: distanceKm(at, place),
    detail: [cuisine, t.opening_hours ? `Hours (OSM): ${t.opening_hours}` : ''].filter(Boolean).join(' · ') || undefined,
    halal,
    vegetarian,
    seafood: SEAFOOD.test(`${cuisine} ${ja}`),
  }
}

/** Places to eat near a point, matching any of the positive diets, minus seafood if asked. */
export async function findFood(at: LatLng, diet: Diet[], signal?: AbortSignal): Promise<FoodResult[]> {
  const positive = [...(diet.includes('halal') ? HALAL_FILTERS : []), ...(diet.includes('vegetarian') ? VEG_FILTERS : [])]
  // Diet-specific places are rarer: look further.
  const radius = positive.length ? 1500 : 600
  const around = `(around:${radius},${at.lat.toFixed(5)},${at.lng.toFixed(5)})`
  const filters = positive.length ? positive.map((f) => `${FOOD}${f}`) : [FOOD]
  const q = `[out:json][timeout:20];(${filters.map((f) => `nwr${around}${f};`).join('')});out center 80;`
  const seen = new Set<string>()
  return (await overpass(q, signal))
    .map((el) => toFood(el, at))
    .filter((r): r is FoodResult => !!r && !(diet.includes('noseafood') && r.seafood))
    .sort((a, b) => a.km - b.km)
    .filter((r) => (seen.has(r.place.id) ? false : (seen.add(r.place.id), true)))
    .slice(0, 25)
}

/** Mosques and Muslim prayer rooms near a point. */
export async function findPrayerSpaces(at: LatLng, signal?: AbortSignal): Promise<NearbyResult[]> {
  const around = `(around:5000,${at.lat.toFixed(5)},${at.lng.toFixed(5)})`
  const q = `[out:json][timeout:20];(nwr${around}["amenity"="place_of_worship"]["religion"="muslim"];nwr${around}["amenity"="prayer_room"];);out center 30;`
  return (await overpass(q, signal))
    .map((el): NearbyResult | null => {
      const lat = el.lat ?? el.center?.lat
      const lng = el.lon ?? el.center?.lon
      const t = el.tags ?? {}
      const ja = t.name ?? t['name:ja'] ?? 'Prayer space'
      if (lat == null || lng == null) return null
      const place: Place = makePlace(`osm-${el.type}-${el.id}`, t['name:en'] ?? ja, ja, lat, lng, 'Prayer space', { suggestedMin: 20 })
      return { place, km: distanceKm(at, place), detail: t.opening_hours ? `Hours (OSM): ${t.opening_hours}` : undefined }
    })
    .filter((r): r is NearbyResult => !!r)
    .sort((a, b) => a.km - b.km)
    .slice(0, 10)
}

export interface Meal {
  label: 'Lunch' | 'Dinner'
  /** Planned time (minutes after midnight). */
  at: number
}

export const MEALS: Meal[] = [
  { label: 'Lunch', at: 12 * 60 + 30 },
  { label: 'Dinner', at: 19 * 60 },
]
