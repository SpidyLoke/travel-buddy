import { joinRoom, type Room } from 'trystero'
import { useCallback, useEffect, useRef, useState } from 'react'
import { applyLocal, docFromState, isLobbyDoc, materialize, mergeDocs, newLobbyCode, setMember, type LobbyDoc } from '../lib/lobby'
import { load, save } from '../lib/storage'
import type { ItineraryState } from '../types'
import type { ItineraryApi } from './useItinerary'

// Peer-to-peer lobby: phones find each other through public Nostr relays
// (WebRTC signalling only; the plan itself goes phone to phone, encrypted by
// the lobby code) and swap full copies of the lobby document, which merge
// deterministically (see lib/lobby.ts). Nothing is stored on a server, so a
// phone only syncs while at least one other member has the app open.

const KEY = 'tokyo-day:lobby:v1'
const MEMBER_KEY = 'tokyo-day:member-id'
const APP_ID = 'tokyo-day-travel-buddy'

interface Saved {
  code: string
  name: string
  doc: LobbyDoc
}

function memberId(): string {
  let id = load<string | null>(MEMBER_KEY, null)
  if (!id) {
    id = crypto.randomUUID()
    save(MEMBER_KEY, id)
  }
  return id
}

/** A plan received in an invite link: its registers start at time 0 so anything the group has changed wins. */
function seedFrom(state: ItineraryState, me: string, name: string): LobbyDoc {
  const d = docFromState(state, me, name)
  const zero = <T extends { t: number }>(r: T): T => ({ ...r, t: 0, by: '' })
  return { ...d, meta: zero(d.meta), order: zero(d.order), stops: Object.fromEntries(Object.entries(d.stops).map(([k, r]) => [k, zero(r)])) }
}

export function useLobby(itin: ItineraryApi) {
  const me = useRef(memberId()).current
  const [saved, setSaved] = useState<Saved | null>(() => load<Saved | null>(KEY, null))
  const [peers, setPeers] = useState<Record<string, string>>({})
  const [connecting, setConnecting] = useState(false)
  const [reconnect, setReconnect] = useState(0)

  const docRef = useRef<LobbyDoc | null>(saved?.doc ?? null)
  const prevRef = useRef<ItineraryState>(itin.state)
  const applyingRemote = useRef(false)
  const sendDoc = useRef<((d: LobbyDoc) => void) | null>(null)

  const persist = useCallback((doc: LobbyDoc) => {
    docRef.current = doc
    setSaved((s) => {
      if (!s) return s
      const next = { ...s, doc }
      save(KEY, next)
      return next
    })
  }, [])

  // The itinerary API object changes every render; read it through a ref so
  // the connection effect below does not tear down and rejoin each time.
  const itinRef = useRef(itin)
  itinRef.current = itin

  /** Show a merged document as the itinerary, without echoing it back out. */
  const show = useCallback((doc: LobbyDoc) => {
    const next = materialize(doc)
    applyingRemote.current = true
    prevRef.current = next
    itinRef.current.replace(next)
  }, [])

  // Connect while in a lobby.
  const code = saved?.code
  useEffect(() => {
    if (!code) return
    setConnecting(true)
    let room: Room
    try {
      room = joinRoom({ appId: APP_ID, password: code }, code)
    } catch {
      setConnecting(false)
      return
    }
    // Sent as a JSON string: the document is plain data.
    const docAction = room.makeAction<string>('doc')
    const hello = room.makeAction<{ member: string; name: string }>('hi')
    sendDoc.current = (d) => void docAction.send(JSON.stringify(d)).catch(() => {})
    docAction.onMessage = (raw) => {
      let incoming: unknown
      try {
        incoming = JSON.parse(raw)
      } catch {
        return
      }
      if (!isLobbyDoc(incoming) || !docRef.current) return
      const before = docRef.current
      const merged = mergeDocs(before, incoming)
      if (JSON.stringify(merged) === JSON.stringify(before)) return
      persist(merged)
      // Only touch the itinerary if the plan itself changed (not just member info).
      if (JSON.stringify(materialize(merged)) !== JSON.stringify(materialize(before))) show(merged)
    }
    hello.onMessage = (h, { peerId }) => {
      setConnecting(false)
      setPeers((p) => ({ ...p, [peerId]: h.member }))
      if (docRef.current && !docRef.current.members[h.member]) persist(setMember(docRef.current, h.member, h.name))
    }
    room.onPeerJoin = (peerId) => {
      const s = load<Saved | null>(KEY, null)
      void hello.send({ member: me, name: s?.name ?? 'Someone' }, { target: peerId }).catch(() => {})
      if (docRef.current) void docAction.send(JSON.stringify(docRef.current), { target: peerId }).catch(() => {})
    }
    room.onPeerLeave = (peerId) =>
      setPeers((p) => {
        const { [peerId]: _gone, ...rest } = p
        return rest
      })
    const settle = setTimeout(() => setConnecting(false), 8000)
    return () => {
      clearTimeout(settle)
      sendDoc.current = null
      setPeers({})
      void room.leave()
    }
  }, [code, reconnect, me, persist, show])

  // iPhone drops connections in the background: reconnect when the app comes back.
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && code && setReconnect((n) => n + 1)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [code])

  // Local edits: record them in the document and send to everyone.
  useEffect(() => {
    if (applyingRemote.current) {
      applyingRemote.current = false
      prevRef.current = itin.state
      return
    }
    const doc = docRef.current
    if (!saved || !doc) {
      prevRef.current = itin.state
      return
    }
    if (itin.state === prevRef.current) return
    const next = applyLocal(doc, prevRef.current, itin.state, me)
    prevRef.current = itin.state
    persist(next)
    sendDoc.current?.(next)
  }, [itin.state, saved, me, persist])

  const start = useCallback(
    (name: string) => {
      const doc = docFromState(itin.state, me, name)
      const s = { code: newLobbyCode(), name, doc }
      docRef.current = doc
      prevRef.current = itin.state
      save(KEY, s)
      setSaved(s)
    },
    [itin.state, me],
  )

  const join = useCallback(
    (lobbyCode: string, name: string, plan: ItineraryState | null) => {
      const base = plan ?? itin.state
      const doc = setMember(seedFrom(base, me, name), me, name)
      const s = { code: lobbyCode, name, doc }
      docRef.current = doc
      save(KEY, s)
      setSaved(s)
      applyingRemote.current = true
      prevRef.current = materialize(doc)
      itinRef.current.replace(prevRef.current)
    },
    [itin.state, me],
  )

  const leave = useCallback(() => {
    save(KEY, null)
    docRef.current = null
    setSaved(null)
  }, [])

  const rename = useCallback(
    (name: string) => {
      if (!docRef.current || !saved) return
      const doc = setMember(docRef.current, me, name)
      const s = { ...saved, name, doc }
      docRef.current = doc
      save(KEY, s)
      setSaved(s)
      sendDoc.current?.(doc)
    },
    [saved, me],
  )

  const onlineMembers = new Set([me, ...Object.values(peers)])
  return {
    active: !!saved,
    code: saved?.code ?? null,
    name: saved?.name ?? '',
    doc: saved?.doc ?? null,
    me,
    onlineMembers,
    peerCount: Object.keys(peers).length,
    connecting,
    start,
    join,
    leave,
    rename,
  }
}

export type LobbyApi = ReturnType<typeof useLobby>
