import type { LatLng } from '../types'
import { load, save } from './storage'
import { addDays } from './planner'
import { getTimeZone, todayLocal } from './time'

// Forecasts from Open-Meteo (free, no key, CORS-enabled), in destination time.
// Up to 16 days ahead; saved for an hour so it also shows offline.

export interface DayWeather {
  code: number
  max: number
  min: number
  rainMax: number
}

export interface HourWeather {
  code: number
  rainProb: number
  temp: number
}

export interface Forecast {
  key: string
  fetchedAt: number
  daily: Record<string, DayWeather>
  /** Keyed "YYYY-MM-DDTHH". */
  hourly: Record<string, HourWeather>
}

const KEY = 'tokyo-day:weather:v1'
const TTL = 60 * 60 * 1000
export const FORECAST_DAYS = 16

let current: Forecast | null = load<Forecast | null>(KEY, null)
export const getForecast = (): Forecast | null => current

export async function refreshWeather(at: LatLng, dates: string[], signal?: AbortSignal): Promise<Forecast | null> {
  const today = todayLocal()
  const last = addDays(today, FORECAST_DAYS - 1)
  const wanted = dates.filter((d) => d >= today && d <= last).sort()
  if (!wanted.length) return current
  const start = wanted[0]
  const end = wanted.at(-1)!
  const tz = getTimeZone()
  const key = `${at.lat.toFixed(2)},${at.lng.toFixed(2)},${start},${end},${tz}`
  if (current?.key === key && Date.now() - current.fetchedAt < TTL) return current
  const params = new URLSearchParams({
    latitude: at.lat.toFixed(3),
    longitude: at.lng.toFixed(3),
    hourly: 'precipitation_probability,weather_code,temperature_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: tz,
    start_date: start,
    end_date: end,
  })
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
    const j = await res.json()
    const daily: Forecast['daily'] = {}
    j.daily.time.forEach((d: string, i: number) => {
      daily[d] = {
        code: j.daily.weather_code[i],
        max: Math.round(j.daily.temperature_2m_max[i]),
        min: Math.round(j.daily.temperature_2m_min[i]),
        rainMax: j.daily.precipitation_probability_max[i] ?? 0,
      }
    })
    const hourly: Forecast['hourly'] = {}
    j.hourly.time.forEach((t: string, i: number) => {
      hourly[t.slice(0, 13)] = { code: j.hourly.weather_code[i], rainProb: j.hourly.precipitation_probability[i] ?? 0, temp: Math.round(j.hourly.temperature_2m[i]) }
    })
    current = { key, fetchedAt: Date.now(), daily, hourly }
    save(KEY, current)
  } catch {
    // Keep the last forecast.
  }
  return current
}

/** WMO weather code to an emoji and a word. */
export function describeWeather(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Clear' }
  if (code <= 2) return { icon: '🌤️', label: 'Partly cloudy' }
  if (code === 3) return { icon: '☁️', label: 'Cloudy' }
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Fog' }
  if (code >= 51 && code <= 67) return { icon: '🌧️', label: 'Rain' }
  if (code >= 71 && code <= 77) return { icon: '❄️', label: 'Snow' }
  if (code >= 80 && code <= 82) return { icon: '🌦️', label: 'Showers' }
  if (code >= 85 && code <= 86) return { icon: '🌨️', label: 'Snow showers' }
  if (code >= 95) return { icon: '⛈️', label: 'Thunderstorms' }
  return { icon: '🌡️', label: 'Weather' }
}

export const dayWeather = (date: string | undefined): DayWeather | null => (date && current?.daily[date]) || null

/** Hourly forecast at a time of day on a date (minutes after midnight, destination time). */
export function weatherAt(date: string | undefined, min: number): HourWeather | null {
  if (!date || !current) return null
  const h = Math.min(23, Math.max(0, Math.floor(min / 60)))
  return current.hourly[`${date}T${String(h).padStart(2, '0')}`] ?? null
}

/** Rain chance at which outdoor stops get a warning. */
export const RAIN_WARN = 50
