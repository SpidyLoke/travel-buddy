import { useEffect, useState } from 'react'

/** Re-renders every `ms` so clocks and schedule projections stay current. */
export function useNow(ms = 30000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
