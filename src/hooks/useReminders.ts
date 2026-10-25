import { useEffect } from 'react'
import { placeLabel } from '../data/places'
import type { Timeline } from '../lib/schedule'
import { nowMinJst, planDayStatus } from '../lib/time'

// Best-effort "time to leave" notifications. Timers only run while the app is
// open (or briefly in the background); iPhone allows web notifications only
// for apps added to the Home Screen. Calendar export is the reliable option.

export const ALERT_LEAD_MIN = 10

export type ReminderSupport = 'ok' | 'needs-install' | 'unsupported' | 'denied'

export function reminderSupport(): ReminderSupport {
  if (!('Notification' in window)) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    return ios ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  return 'ok'
}

export async function enableReminders(): Promise<boolean> {
  if (!('Notification' in window)) return false
  return (await Notification.requestPermission()) === 'granted'
}

async function notify(title: string, body: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icon-192.png`, tag: title })
    else new Notification(title, { body })
  } catch {
    // Notification failed (permission revoked, unsupported): nothing to do.
  }
}

export function useReminders(tl: Timeline, date: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return
    const day = planDayStatus(date)
    if (day !== 'today' && day !== 'undated') return
    const now = nowMinJst()
    const timers = tl.entries
      .filter((e) => e.stop.status === 'pending')
      .map((e) => {
        const leave = e.projectedArrive - e.travel.min
        const fireIn = (leave - ALERT_LEAD_MIN - now) * 60000
        if (fireIn < 0 || fireIn > 12 * 3600000) return null
        return setTimeout(() => notify(`Leave for ${placeLabel(e.place)} in ${ALERT_LEAD_MIN} min`, `From ${placeLabel(e.prev)}, ~${Math.round(e.travel.min)} min by ${e.stop.transport}.`), fireIn)
      })
    return () => timers.forEach((t) => t && clearTimeout(t))
  }, [tl, date, enabled])
}
