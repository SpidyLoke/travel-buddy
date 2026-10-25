import { dayWeather, describeWeather, RAIN_WARN, weatherAt } from '../lib/weather'
import type { Place } from '../types'

/** "☀️ 18°/11°" (plus rain chance when notable) for a date, if forecast. */
export function WeatherBadge({ date, className = '' }: { date: string | undefined; className?: string }) {
  const w = dayWeather(date)
  if (!w) return null
  const { icon, label } = describeWeather(w.code)
  return (
    <span className={`whitespace-nowrap ${className}`} title={label}>
      {icon} {w.max}°/{w.min}°{w.rainMax >= 30 ? ` · ${w.rainMax}%` : ''}
    </span>
  )
}

/** Warning pill for an outdoor stop when rain is likely around the time you're there. */
export function RainWarning({ place, date, atMin }: { place: Place; date: string | undefined; atMin: number }) {
  if (!place.outdoor) return null
  const w = weatherAt(date, atMin)
  if (!w || w.rainProb < RAIN_WARN) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent">
      🌧️ {w.rainProb}% rain · mostly outdoors
    </span>
  )
}

/** One-line summary for a day, e.g. "Showers likely from 14:00 (70%)". */
export function DayWeatherNote({ date }: { date: string | undefined }) {
  const w = dayWeather(date)
  if (!w) return null
  const { icon, label } = describeWeather(w.code)
  let firstWet: number | null = null
  for (let h = 9; h <= 21 && firstWet == null; h++) if ((weatherAt(date, h * 60)?.rainProb ?? 0) >= RAIN_WARN) firstWet = h
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-[14px]">
      <span className="text-2xl">{icon}</span>
      <span className="flex-1">
        <b>
          {label}, {w.max}° / {w.min}°
        </b>
        <span className="block text-muted">
          {firstWet != null ? `Rain likely from about ${firstWet}:00. Outdoor stops are flagged.` : w.rainMax >= 30 ? `Up to ${w.rainMax}% chance of rain.` : 'Dry day expected.'}
        </span>
      </span>
    </div>
  )
}
