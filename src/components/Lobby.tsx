import { Check, ChevronRight, ClipboardPaste, Copy, LoaderCircle, LogOut, Share2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { renderSVG } from 'uqr'
import { getPlace, placeLabel } from '../data/places'
import type { LobbyApi } from '../hooks/useLobby'
import { recentActivity } from '../lib/lobby'
import { formatLobbyCode, isIos, isStandalone, lobbyUrl } from '../lib/share'
import { dateLabel } from '../lib/time'
import type { ItineraryState } from '../types'
import { Button, Card, Notice, SectionTitle, Sheet } from './ui'

function ago(t: number): string {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

/** Slim status bar shown while in a lobby. */
export function LobbyBar({ lobby, onOpen }: { lobby: LobbyApi; onOpen: () => void }) {
  if (!lobby.active || !lobby.doc) return null
  const last = recentActivity(lobby.doc, 1)[0]
  const total = Object.keys(lobby.doc.members).length
  const online = lobby.onlineMembers.size
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3 text-left">
      <Users size={20} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-accent">
          Group lobby · {online} of {total} online{lobby.connecting && lobby.peerCount === 0 ? ' · connecting…' : ''}
        </span>
        <span className="block truncate text-[13px] text-muted">
          {lobby.doc.order.v.length === 0
            ? "Waiting for the group's plan: it arrives when another member has the app open"
            : last
              ? `${last.who === lobby.name ? 'You' : last.who} ${last.what} · ${ago(last.t)}`
              : 'Changes sync to everyone here'}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </button>
  )
}

function Invite({ lobby, state }: { lobby: LobbyApi; state: ItineraryState }) {
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (lobby.code) lobbyUrl(lobby.code, state).then(setUrl)
  }, [lobby.code, state])
  if (!url) return <LoaderCircle className="mx-auto animate-spin text-muted" />
  return (
    <div className="space-y-2">
      <Card className="flex items-center justify-between gap-3 px-4 py-3">
        <span>
          <span className="block text-[12px] font-semibold uppercase text-muted">Lobby code</span>
          <span className="block font-mono text-xl font-bold tracking-wider">{formatLobbyCode(lobby.code!)}</span>
        </span>
        <span className="text-right text-[12px] text-muted">Friends using the Home Screen app: Share → Join with invite</span>
      </Card>
      {url.length < 2800 && (
        <Card className="p-4">
          <div className="mx-auto w-full max-w-[240px] rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: renderSVG(url, { border: 1 }) }} />
          <p className="mt-2 text-center text-[13px] text-muted">Friends scan this with the iPhone camera to join.</p>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        {'share' in navigator && (
          <Button
            variant="primary"
            onClick={() =>
              navigator
                .share({
                  title: 'Join our trip lobby',
                  text: `Join our trip lobby in Travel Buddy. Open the link, or if you use the app from your Home Screen, open it and tap Share → Join with invite, then paste this. Code: ${formatLobbyCode(lobby.code!)}`,
                  url,
                })
                .catch(() => {})
            }
          >
            <Share2 size={18} /> Invite
          </Button>
        )}
        <Button
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
      </div>
    </div>
  )
}

/** Lobby details: who's here, what changed, invite, leave. */
export function LobbySheet({ lobby, state, onClose }: { lobby: LobbyApi; state: ItineraryState; onClose: () => void }) {
  const [name, setName] = useState(lobby.name)
  if (!lobby.doc) return null
  const members = Object.entries(lobby.doc.members).sort((a, b) => b[1].seen - a[1].seen)
  return (
    <Sheet title="Group lobby" onClose={onClose}>
      <div className="space-y-1">
        {lobby.peerCount === 0 && (
          <Notice tone="info">
            {lobby.connecting ? 'Looking for others in the lobby…' : 'Nobody else has the app open right now.'} Your changes are saved and sync when someone opens it.
          </Notice>
        )}
        <SectionTitle>In this lobby</SectionTitle>
        <Card className="divide-line">
          {members.map(([id, m]) => {
            const online = lobby.onlineMembers.has(id)
            return (
              <div key={id} className="flex items-center gap-3 px-4 py-3">
                <span className={`size-2.5 rounded-full ${online ? 'bg-ok' : 'bg-[var(--line)]'}`} />
                <span className="flex-1 font-semibold">
                  {m.name}
                  {id === lobby.me && <span className="font-normal text-muted"> (you)</span>}
                </span>
                <span className="text-[13px] text-muted">{online ? 'online' : `seen ${ago(m.seen)}`}</span>
              </div>
            )
          })}
        </Card>

        <SectionTitle>Recent changes</SectionTitle>
        <Card className="divide-line">
          {recentActivity(lobby.doc, 8).map((a, i) => (
            <div key={i} className="px-4 py-2.5 text-[14px]">
              <b>{a.who}</b> {a.what} <span className="text-muted">· {ago(a.t)}</span>
            </div>
          ))}
          {recentActivity(lobby.doc, 1).length === 0 && <div className="px-4 py-3 text-[14px] text-muted">No changes yet.</div>}
        </Card>

        <SectionTitle>Invite more people</SectionTitle>
        <Invite lobby={lobby} state={state} />

        <SectionTitle>Your name</SectionTitle>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) lobby.rename(name.trim())
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-2xl bg-card px-4 py-3 text-[16px]" maxLength={24} />
          <Button type="submit">Save</Button>
        </form>

        <div className="pt-4">
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm('Leave the lobby? You keep a copy of the plan; it stops syncing.')) {
                lobby.leave()
                onClose()
              }
            }}
          >
            <LogOut size={16} /> Leave lobby
          </Button>
        </div>
        <p className="px-1 pt-2 text-[12px] text-muted">
          Phones connect directly to each other (public relays only help them find each other). Nothing is stored on a server, so syncing needs at least one other
          member to have the app open.
        </p>
      </div>
    </Sheet>
  )
}

/** Start a lobby from the share screen. */
export function StartLobby({ lobby }: { lobby: LobbyApi }) {
  const [name, setName] = useState('')
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) lobby.start(name.trim())
      }}
    >
      <p className="px-1 text-[14px] text-muted">Everyone in the lobby sees the same plan. Anyone's Visited, Skip, reorder or added place updates on every phone.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={24}
        className="w-full rounded-2xl bg-card px-4 py-3 text-[16px]"
      />
      <Button type="submit" variant="primary" className="w-full min-h-14 text-[17px]" disabled={!name.trim()}>
        <Users size={20} /> Start group lobby
      </Button>
    </form>
  )
}

/** Shown when the app is opened from a lobby invite. */
export function JoinLobbySheet({ plan, link, onJoin, onClose }: { plan: ItineraryState | null; link: string | null; onJoin: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [copied, setCopied] = useState(false)
  // Opened from a link in Safari on iPhone: the Home Screen app can't see this.
  const inSafari = !!link && isIos() && !isStandalone()
  const stops = plan?.stops.filter((s) => s.status !== 'skipped') ?? []
  return (
    <Sheet title="Join the group lobby" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onJoin(name.trim())
        }}
      >
        {inSafari && (
          <Notice tone="info">
            <span className="block">
              <b>Using the app from your Home Screen?</b> iPhone opened this in Safari, which keeps separate data. Copy the invite, open the app, then tap Share → Join
              with invite → Paste.
            </span>
            <Button
              type="button"
              className="mt-2 w-full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link!)
                  setCopied(true)
                } catch {
                  prompt('Copy this invite', link!)
                }
              }}
            >
              {copied ? <Check size={18} className="text-ok" /> : <Copy size={18} />} {copied ? 'Copied: now open the app' : 'Copy invite'}
            </Button>
          </Notice>
        )}
        {plan && (
          <p className="px-1 text-[15px] text-muted">
            {plan.date ? `${dateLabel(plan.date)} · ` : ''}
            {stops.map((s) => placeLabel(getPlace(s.placeId))).join(' → ')}
          </p>
        )}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className="w-full rounded-2xl bg-card px-4 py-3 text-[16px]"
        />
        <Button type="submit" variant="primary" className="w-full min-h-14 text-[17px]" disabled={!name.trim()}>
          <Users size={20} /> {inSafari ? 'Join here in Safari instead' : 'Join'}
        </Button>
        <Button type="button" className="w-full" onClick={onClose}>
          Not now
        </Button>
        <p className="px-1 text-[12px] text-muted">Joining replaces the plan on this phone with the group's. Your name is shown to others in the lobby.</p>
      </form>
    </Sheet>
  )
}

export type JoinInvite = (text: string) => Promise<boolean | 'already'>

/**
 * Join from inside the app by pasting an invite link or typing the code.
 * iPhone opens shared links in Safari, which can't see the Home Screen app's data.
 */
export function JoinWithInvite({ onJoinInvite }: { onJoinInvite: JoinInvite }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = async (value: string) => {
    setError(null)
    const ok = await onJoinInvite(value)
    if (ok === false) setError("That isn't an invite link or lobby code.")
    else if (ok === 'already') setError("You're already in that lobby.")
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) submit(text)
      }}
    >
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste invite link or type code"
          autoCapitalize="none"
          autoCorrect="off"
          className="min-w-0 flex-1 rounded-2xl bg-card px-4 py-3 text-[16px]"
        />
        <Button
          type="button"
          onClick={async () => {
            try {
              const clip = await navigator.clipboard.readText()
              setText(clip)
              if (clip.trim()) submit(clip)
            } catch {
              setError('Could not read the clipboard: long-press the box and tap Paste.')
            }
          }}
        >
          <ClipboardPaste size={18} /> Paste
        </Button>
      </div>
      <Button type="submit" variant="primary" className="w-full" disabled={!text.trim()}>
        <Users size={18} /> Join
      </Button>
      {error && <p className="px-1 text-[13px] text-bad">{error}</p>}
    </form>
  )
}
