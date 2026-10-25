import { useEffect, useState } from 'react'
import { load, save } from '../lib/storage'
import type { ThemePref } from '../types'

const KEY = 'tokyo-day:theme'

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => load<ThemePref>(KEY, 'system'))
  useEffect(() => {
    save(KEY, pref)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#f2f2f7')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [pref])
  const cycle = () => setPref((p) => (p === 'system' ? 'light' : p === 'light' ? 'dark' : 'system'))
  return { pref, cycle, set: setPref }
}
