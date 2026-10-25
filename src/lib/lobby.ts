import { getPlace, PLACE_BY_ID, placeLabel, registerPlace } from '../data/places'
import type { ItineraryState, ItineraryStop, Place } from '../types'

// Shared lobby document. Every phone holds a full copy and they swap copies
// peer to peer; merging two copies always gives the same result whatever
// the order (a last-writer-wins map), so phones converge without a server.
//   - each stop, the stop order and the day settings are separate registers
//   - the newer write wins; ties break on member id
//   - deleted stops stay as tombstones so a deletion is not undone by an
//     older copy arriving later
//   - custom places only ever get added

export interface Reg<T> {
  v: T
  t: number
  by: string
  /** Human summary of the change, e.g. "marked Asakusa visited". */
  what?: string
}

type Meta = Pick<ItineraryState, 'startPlaceId' | 'startMin' | 'endMin' | 'date' | 'home'>
type SharedStop = ItineraryStop & { deleted?: boolean }

export interface Member {
  name: string
  /** Last time this member's phone wrote anything or said hello. */
  seen: number
}

export interface LobbyDoc {
  v: 1
  meta: Reg<Meta>
  order: Reg<string[]>
  stops: Record<string, Reg<SharedStop>>
  places: Record<string, Place>
  members: Record<string, Member>
}

let lastT = 0
/** Wall clock, but never repeating or going backwards on this phone. */
export function tick(): number {
  lastT = Math.max(Date.now(), lastT + 1)
  return lastT
}

const newer = <T>(a: Reg<T> | undefined, b: Reg<T> | undefined): Reg<T> | undefined => {
  if (!a) return b
  if (!b) return a
  if (a.t !== b.t) return a.t > b.t ? a : b
  return a.by >= b.by ? a : b
}

export function mergeDocs(a: LobbyDoc, b: LobbyDoc): LobbyDoc {
  const stops: LobbyDoc['stops'] = { ...a.stops }
  for (const [id, r] of Object.entries(b.stops)) stops[id] = newer(stops[id], r)!
  const members: LobbyDoc['members'] = { ...a.members }
  for (const [id, m] of Object.entries(b.members)) if (!members[id] || m.seen > members[id].seen) members[id] = m
  return {
    v: 1,
    meta: newer(a.meta, b.meta)!,
    order: newer(a.order, b.order)!,
    stops,
    places: { ...b.places, ...a.places },
    members,
  }
}

const strip = (s: SharedStop): ItineraryStop => {
  const { deleted: _deleted, ...rest } = s
  return rest
}

/** The itinerary this document describes. */
export function materialize(doc: LobbyDoc): ItineraryState {
  Object.values(doc.places).forEach(registerPlace)
  const live = Object.entries(doc.stops).filter(([, r]) => !r.v.deleted && PLACE_BY_ID[r.v.placeId])
  const liveIds = new Set(live.map(([id]) => id))
  const ordered = doc.order.v.filter((id) => liveIds.has(id))
  // Stops added concurrently with a reorder are missing from the winning order: append them.
  const extra = live
    .filter(([id]) => !ordered.includes(id))
    .sort((x, y) => x[1].t - y[1].t)
    .map(([id]) => id)
  const ids = [...ordered, ...extra]
  const done = live.filter(([, r]) => r.v.status === 'done').map(([, r]) => r.t)
  return {
    version: 1,
    ...doc.meta.v,
    stops: ids.map((id) => strip(doc.stops[id].v)),
    customPlaces: Object.values(doc.places),
    lastDepartedAt: done.length ? Math.max(...done) : undefined,
  }
}

const name = (placeId: string) => (PLACE_BY_ID[placeId] ? placeLabel(getPlace(placeId)) : 'a place')

function describe(prev: ItineraryStop | undefined, next: ItineraryStop): string {
  if (!prev) return `added ${name(next.placeId)}`
  if (prev.status !== next.status) {
    return next.status === 'done' ? `marked ${name(next.placeId)} visited` : next.status === 'skipped' ? `skipped ${name(next.placeId)}` : `restored ${name(next.placeId)}`
  }
  if (prev.transport !== next.transport) return `switched to ${next.transport === 'luup' ? 'LUUP' : next.transport} for ${name(next.placeId)}`
  if (prev.durationMin !== next.durationMin) return `changed time at ${name(next.placeId)}`
  return `edited ${name(next.placeId)}`
}

const metaOf = (s: ItineraryState): Meta => ({ startPlaceId: s.startPlaceId, startMin: s.startMin, endMin: s.endMin, date: s.date, home: s.home })
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Records a local edit (prev → next) in the document as registers stamped by `me`. */
export function applyLocal(doc: LobbyDoc, prev: ItineraryState, next: ItineraryState, me: string): LobbyDoc {
  const out: LobbyDoc = { ...doc, stops: { ...doc.stops }, places: { ...doc.places }, members: { ...doc.members } }
  const t = tick()
  if (!same(metaOf(prev), metaOf(next))) out.meta = { v: metaOf(next), t, by: me, what: 'changed the day settings' }
  const before = new Map(prev.stops.map((s) => [s.id, s]))
  for (const s of next.stops) {
    const p = before.get(s.id)
    if (!p || !same(p, s)) out.stops[s.id] = { v: s, t, by: me, what: describe(p, s) }
  }
  const after = new Set(next.stops.map((s) => s.id))
  for (const p of prev.stops) if (!after.has(p.id)) out.stops[p.id] = { v: { ...p, deleted: true }, t, by: me, what: `removed ${name(p.placeId)}` }
  const ids = next.stops.map((s) => s.id)
  if (!same(prev.stops.map((s) => s.id), ids)) out.order = { v: ids, t, by: me, what: prev.stops.length === ids.length ? 'reordered the stops' : undefined }
  for (const p of next.customPlaces ?? []) out.places[p.id] = p
  out.members[me] = { ...(out.members[me] ?? { name: 'Someone' }), seen: t }
  return out
}

/** A new lobby seeded from the current plan. */
export function docFromState(state: ItineraryState, me: string, myName: string): LobbyDoc {
  const t = tick()
  return {
    v: 1,
    meta: { v: metaOf(state), t, by: me },
    order: { v: state.stops.map((s) => s.id), t, by: me },
    stops: Object.fromEntries(state.stops.map((s) => [s.id, { v: s, t, by: me }])),
    places: Object.fromEntries((state.customPlaces ?? []).map((p) => [p.id, p])),
    members: { [me]: { name: myName, seen: t } },
  }
}

export function setMember(doc: LobbyDoc, me: string, myName: string): LobbyDoc {
  return { ...doc, members: { ...doc.members, [me]: { name: myName, seen: tick() } } }
}

export interface Activity {
  who: string
  what: string
  t: number
}

/** Most recent described changes, newest first. */
export function recentActivity(doc: LobbyDoc, limit = 5): Activity[] {
  const regs: Reg<unknown>[] = [doc.meta, doc.order, ...Object.values(doc.stops)]
  return regs
    .filter((r) => r.what)
    .sort((a, b) => b.t - a.t)
    .slice(0, limit)
    .map((r) => ({ who: doc.members[r.by]?.name ?? 'Someone', what: r.what!, t: r.t }))
}

export function isLobbyDoc(x: unknown): x is LobbyDoc {
  const d = x as LobbyDoc
  return !!d && d.v === 1 && !!d.meta?.v && Array.isArray(d.order?.v) && typeof d.stops === 'object' && typeof d.members === 'object'
}

/** Short, unguessable-enough lobby code without look-alike characters. */
export function newLobbyCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
