import { PLACE_BY_ID } from '../data/places'
import type { ItineraryState, Place } from '../types'

// A plan travels entirely inside the link (#plan=...): no server, nothing
// uploaded. JSON is deflate-compressed where the browser supports it
// (Safari 16.4+), then base64url-encoded. Prefix: z = compressed, j = plain.

const PLACE_KEYS: (keyof Place)[] = ['id', 'name', 'label', 'nameJa', 'mapsQuery', 'wiki', 'lat', 'lng', 'area', 'description', 'suggestedMin', 'kind', 'hidden', 'custom']

function prune(state: ItineraryState): ItineraryState {
  return {
    version: 1,
    startPlaceId: state.startPlaceId,
    startMin: state.startMin,
    endMin: state.endMin,
    date: state.date,
    home: state.home,
    stops: state.stops,
    customPlaces: state.customPlaces?.map((p) => Object.fromEntries(PLACE_KEYS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])) as unknown as Place),
  }
}

const toB64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

async function encodeJson(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value))
  if (typeof CompressionStream !== 'undefined') return `z${toB64url(await pipe(json, new CompressionStream('deflate-raw')))}`
  return `j${toB64url(json)}`
}

async function decodeJson(code: string): Promise<unknown> {
  const raw = fromB64url(code.slice(1))
  const bytes = code[0] === 'z' ? await pipe(raw, new DecompressionStream('deflate-raw')) : raw
  return JSON.parse(new TextDecoder().decode(bytes))
}

export const encodePlan = (state: ItineraryState): Promise<string> => encodeJson(prune(state))

/** Returns null for anything that is not a valid plan. */
export async function decodePlan(code: string): Promise<ItineraryState | null> {
  try {
    const s = (await decodeJson(code)) as ItineraryState
    if (s?.version !== 1 || !Array.isArray(s.stops) || typeof s.startMin !== 'number') return null
    const custom = new Set((s.customPlaces ?? []).map((p) => p.id))
    const known = (id: string) => !!PLACE_BY_ID[id] || custom.has(id)
    if (!known(s.startPlaceId)) return null
    return { ...s, stops: s.stops.filter((st) => known(st.placeId)), lastDepartedAt: undefined }
  } catch {
    return null
  }
}

export async function shareUrl(state: ItineraryState): Promise<string> {
  return `${location.origin}${import.meta.env.BASE_URL}#plan=${await encodePlan(state)}`
}

/** Invite link for a live lobby. Carries the current plan so joiners have it even if nobody else is online. */
export async function lobbyUrl(code: string, state: ItineraryState): Promise<string> {
  return `${location.origin}${import.meta.env.BASE_URL}#lobby=${code}&plan=${await encodePlan(state)}`
}

/** The plan code in the current address, if someone opened a shared link. */
export const incomingCode = (): string | null => /[#&]plan=([^&]+)/.exec(location.hash)?.[1] ?? null

/** The lobby code in the current address, if someone opened an invite. */
export const incomingLobby = (): string | null => /[#&]lobby=([a-z0-9]{6,20})/.exec(location.hash)?.[1] ?? null

export function clearIncoming(): void {
  history.replaceState(null, '', location.pathname + location.search)
}
