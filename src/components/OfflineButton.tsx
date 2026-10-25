import { CloudDownload, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { downloadForOffline, offlineProblem, type OfflineResult } from '../lib/offline'
import type { ItineraryState } from '../types'
import { Button, Notice } from './ui'

/** Saves map tiles around each stop and the plan's photos for use without signal. */
export function OfflineButton({ days, label }: { days: ItineraryState[]; label: string }) {
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [result, setResult] = useState<OfflineResult | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const run = async () => {
    const p = offlineProblem()
    if (p) {
      setProblem(p === 'offline' ? 'You are offline. Connect first.' : 'Offline saving is still starting up. Close and reopen the app once, then try again.')
      return
    }
    setProblem(null)
    setResult(null)
    setProgress([0, 1])
    const r = await downloadForOffline(days, (d, t) => setProgress([d, t]))
    setProgress(null)
    setResult(r)
  }

  return (
    <div className="space-y-2">
      <Button className="w-full text-[14px]" onClick={run} disabled={!!progress}>
        {progress ? <LoaderCircle size={16} className="animate-spin" /> : <CloudDownload size={16} />}
        {progress ? `Saving… ${Math.round((progress[0] / progress[1]) * 100)}%` : label}
      </Button>
      {problem && <Notice tone="warn">{problem}</Notice>}
      {result && (
        <Notice tone={result.failed ? 'warn' : 'ok'}>
          Saved map around your stops ({result.tiles} map tiles) and {result.photos} photos{result.failed ? `; ${result.failed} failed` : ''}. Steps, times and the
          train guide work offline. Live directions, search and weather still need signal.
        </Notice>
      )}
    </div>
  )
}
