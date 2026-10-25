import { placeLabel } from '../data/places'
import type { ItineraryState } from '../types'
import { directionsUrl, modeToGoogle } from './maps'
import { buildTimeline } from './schedule'
import { todayJst } from './time'

// iCalendar export: one event per stop with an alert 10 minutes before you
// need to leave for it. Calendar alerts fire even when this web app is
// closed, which in-app notifications on iPhone cannot guarantee.

const ALERT_MIN = 10

const pad = (n: number) => String(n).padStart(2, '0')

/** "20261114T103000" in Japan time (floats past midnight into the next day). */
function stamp(ymd: string, min: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCMinutes(d.getUTCMinutes() + Math.round(min))
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

/** Lines longer than 75 octets must be folded; count bytes, not characters (Japanese is 3 bytes each). */
function fold(line: string): string {
  const enc = new TextEncoder()
  const parts: string[] = []
  let cur = ''
  for (const ch of line) {
    if (enc.encode(cur + ch).length > 73) {
      parts.push(cur)
      cur = ''
    }
    cur += ch
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

export function buildIcs(days: ItineraryState[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tokyo Day//Travel companion//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Tokyo',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:JST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  for (const day of days) {
    const date = day.date ?? todayJst()
    // Plan as written (not projected from the current clock).
    const tl = buildTimeline(day, 0)
    tl.entries
      .filter((e) => e.stop.status === 'pending')
      .forEach((e) => {
        const leave = e.plannedArrive - e.travel.min
        const name = placeLabel(e.place)
        lines.push(
          'BEGIN:VEVENT',
          `UID:${date}-${e.stop.id}@tokyo-day`,
          `DTSTAMP:${now}`,
          `DTSTART;TZID=Asia/Tokyo:${stamp(date, e.plannedArrive)}`,
          `DTEND;TZID=Asia/Tokyo:${stamp(date, e.plannedDepart)}`,
          fold(`SUMMARY:${esc(name)}`),
          fold(`LOCATION:${esc(`${e.place.name}, ${e.place.nameJa}`)}`),
          fold(`DESCRIPTION:${esc(`Leave ${placeLabel(e.prev)} by about ${pad(Math.floor(leave / 60) % 24)}:${pad(leave % 60)} (${e.stop.transport}).\nDirections: ${directionsUrl(e.place, modeToGoogle[e.stop.transport])}`)}`),
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          fold(`DESCRIPTION:${esc(`Leave for ${name} in ${ALERT_MIN} min`)}`),
          // Alert relative to the event start: travel time plus the warning.
          `TRIGGER:-PT${Math.round(e.travel.min + ALERT_MIN)}M`,
          'END:VALARM',
          'END:VEVENT',
        )
      })
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

/** Opens the .ics; iPhone offers "Add All" to Calendar. */
export function downloadIcs(days: ItineraryState[], filename = 'tokyo-day.ics'): void {
  const blob = new Blob([buildIcs(days)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
