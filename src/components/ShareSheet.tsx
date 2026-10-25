import { Check, Copy, LoaderCircle, Share2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { renderSVG } from 'uqr'
import { placeLabel, getPlace } from '../data/places'
import type { LobbyApi } from '../hooks/useLobby'
import { shareUrl } from '../lib/share'
import { StartLobby } from './Lobby'
import { dateLabel } from '../lib/time'
import type { ItineraryState } from '../types'
import { Button, Card, Notice, Sheet } from './ui'

/** Link + QR code that opens this plan on someone else's phone. */
export function ShareSheet({ state, lobby, onOpenLobby, onClose }: { state: ItineraryState; lobby: LobbyApi; onOpenLobby: () => void; onClose: () => void }) {
  const [mode, setMode] = useState<'live' | 'copy'>('live')
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    shareUrl(state).then(setUrl)
  }, [state])

  const stops = state.stops.filter((s) => s.status !== 'skipped')
  const summary = `${stops.length} stops${state.date ? ` on ${dateLabel(state.date)}` : ''}: ${stops.map((s) => placeLabel(getPlace(s.placeId))).join(' → ')}`
  // QR codes hold about 2,900 characters; beyond that, links still work.
  const qrOk = url != null && url.length < 2800

  return (
    <Sheet title="Share this plan" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 rounded-2xl bg-card p-1 text-[14px] font-semibold">
          <button onClick={() => setMode('live')} className={`rounded-xl py-2 ${mode === 'live' ? 'bg-accent text-white' : 'text-muted'}`}>
            Live group lobby
          </button>
          <button onClick={() => setMode('copy')} className={`rounded-xl py-2 ${mode === 'copy' ? 'bg-accent text-white' : 'text-muted'}`}>
            Send a copy
          </button>
        </div>
        <p className="px-1 text-[14px] text-muted">{summary}</p>
        {mode === 'live' ? (
          lobby.active ? (
            <Button variant="primary" className="w-full min-h-14 text-[17px]" onClick={onOpenLobby}>
              <Users size={20} /> You're in a lobby: invite people
            </Button>
          ) : (
            <StartLobby lobby={lobby} />
          )
        ) : !url ? (
          <div className="flex justify-center py-10 text-muted">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : (
          <>
            {qrOk ? (
              <Card className="p-4">
                <div className="mx-auto w-full max-w-[280px] rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: renderSVG(url, { border: 1 }) }} />
                <p className="mt-2 text-center text-[13px] text-muted">Scan with the iPhone camera to open the plan.</p>
              </Card>
            ) : (
              <Notice tone="info">This plan is too big for a QR code. Send the link instead.</Notice>
            )}
            {'share' in navigator && (
              <Button
                variant="primary"
                className="w-full min-h-14 text-[17px]"
                onClick={() => navigator.share({ title: 'Tokyo day plan', text: summary, url }).catch(() => {})}
              >
                <Share2 size={20} /> Send link
              </Button>
            )}
            <Button
              className="w-full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  prompt('Copy this link', url)
                }
              }}
            >
              {copied ? <Check size={18} className="text-ok" /> : <Copy size={18} />} {copied ? 'Copied' : 'Copy link'}
            </Button>
            <p className="px-1 text-[12px] text-muted">
              The whole plan travels inside the link: nothing is uploaded. It includes your stops, times, notes and where you're staying, so share it only with
              people you'd tell that to.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
