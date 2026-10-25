import { useCallback, useState } from 'react'
import { getPrefs, writePrefs, type Prefs } from '../lib/prefs'

export function usePrefs() {
  const [prefs, setState] = useState<Prefs>(getPrefs)
  const update = useCallback((patch: Partial<Prefs>) => {
    const next = { ...getPrefs(), ...patch }
    writePrefs(next)
    setState(next)
  }, [])
  return { prefs, update }
}

export type PrefsApi = ReturnType<typeof usePrefs>
