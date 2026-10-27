// All plan times are wall-clock times at the destination. The time zone
// follows the active plan (set from App); Japan until a plan says otherwise.
const TZ_KEY = 'tokyo-day:tz'
const validZone = (tz: string | null | undefined): tz is string => {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
const savedZone = (() => {
  try {
    return localStorage.getItem(TZ_KEY)
  } catch {
    return null
  }
})()
let TZ = validZone(savedZone) ? savedZone : 'Asia/Tokyo'

/** Switches the destination time zone (remembered for the next launch). */
export function setTimeZone(tz: string): void {
  if (!validZone(tz) || tz === TZ) return
  TZ = tz
  try {
    localStorage.setItem(TZ_KEY, tz)
  } catch {
    // Private mode: fine for this session.
  }
}

export const getTimeZone = (): string => TZ

/** Runs `fn` with another destination's time zone (e.g. while planning a new trip). */
export function withTimeZone<T>(tz: string | undefined, fn: () => T): T {
  const prev = TZ
  if (validZone(tz)) TZ = tz
  try {
    return fn()
  } finally {
    TZ = prev
  }
}

/** "Japan time", "Kuala Lumpur time"… */
export function zoneLabel(tz = TZ): string {
  if (tz === 'Asia/Tokyo') return 'Japan time'
  return `${tz.split('/').pop()!.replace(/_/g, ' ')} time`
}

/** Minutes east of UTC for a zone at an instant (e.g. +540 for Japan). */
export function zoneOffsetMin(tz: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000)
}

/** Minutes after midnight at the destination. */
export function nowMinLocal(date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

export function localDateLabel(date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(date)
}

export function localClock(date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

/** 690 -> "11:30" */
export function fmtMin(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function fmtDuration(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

/** "11:30" -> 690 */
export function parseHm(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Today's date at the destination as YYYY-MM-DD. */
export function todayLocal(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** 0 = Sunday, for a YYYY-MM-DD date. */
export function weekdayOf(ymd: string): number {
  // 03:00 UTC is the same calendar date almost everywhere people travel.
  return new Date(`${ymd}T03:00:00Z`).getUTCDay()
}

export function dateLabel(ymd: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${ymd}T03:00:00Z`))
}

export type PlanDay = 'today' | 'future' | 'past' | 'undated'

export function planDayStatus(ymd: string | undefined, now = new Date()): PlanDay {
  if (!ymd) return 'undated'
  const t = todayLocal(now)
  return ymd === t ? 'today' : ymd > t ? 'future' : 'past'
}
