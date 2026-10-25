import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Layers, Navigation } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { findLeg } from '../data/legs'
import { getPlace, placeLabel } from '../data/places'
import type { Geo } from '../hooks/useGeolocation'
import { distanceKm, formatDistance } from '../lib/geo'
import { directionsUrl, modeToGoogle } from '../lib/maps'
import type { Timeline } from '../lib/schedule'
import { fmtMin } from '../lib/time'
import type { ItineraryState, Place } from '../types'
import { LocationHelp } from './LocationHelp'
import { Card, LinkButton, Notice } from './ui'

interface Props {
  visible: boolean
  geo: Geo
  state: ItineraryState
  timeline: Timeline
  focus: Place | null
  online: boolean
}

const TOKYO: L.LatLngTuple = [35.69, 139.76]

export function MapView({ visible, geo, state, timeline, focus, online }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<L.LayerGroup | null>(null)
  const userLayer = useRef<L.LayerGroup | null>(null)
  const centredOnce = useRef(false)
  const [tileErrors, setTileErrors] = useState(0)
  const [showStations, setShowStations] = useState(true)

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(TOKYO, 12)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
    tiles.on('tileerror', () => setTileErrors((n) => n + 1))
    tiles.on('tileload', () => setTileErrors(0))
    tiles.addTo(m)
    layers.current = L.layerGroup().addTo(m)
    userLayer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  // Leaflet needs a size recalculation when its tab becomes visible.
  const { status: geoStatus, start: geoStart } = geo
  useEffect(() => {
    if (visible) setTimeout(() => map.current?.invalidateSize(), 50)
    if (visible && geoStatus === 'idle') geoStart()
  }, [visible, geoStatus, geoStart])

  // Itinerary markers, straight-line route and stations of the next leg.
  useEffect(() => {
    const g = layers.current
    if (!g) return
    g.clearLayers()
    const start = getPlace(state.startPlaceId)
    const pts: L.LatLngTuple[] = [[start.lat, start.lng]]
    L.marker([start.lat, start.lng], { icon: L.divIcon({ className: '', html: '<div class="pin start">S</div>', iconSize: [30, 30] }) })
      .bindPopup(`<b>Start: ${start.name}</b><br>${start.nameJa}<br>${fmtMin(state.startMin)}`)
      .addTo(g)

    let n = 0
    state.stops.forEach((stop) => {
      const p = getPlace(stop.placeId)
      const entry = timeline.entries.find((e) => e.stop.id === stop.id)
      const isNext = timeline.nextIndex >= 0 && timeline.entries[timeline.nextIndex]?.stop.id === stop.id
      const cls = stop.status === 'skipped' ? 'skipped' : stop.status === 'done' ? 'done' : isNext ? 'next' : 'upcoming'
      const label = stop.status === 'skipped' ? '–' : stop.status === 'done' ? '✓' : String(++n)
      if (stop.status !== 'skipped') {
        if (stop.status === 'done') n++
        pts.push([p.lat, p.lng])
      }
      const size = isNext ? 40 : 30
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: `<div class="pin ${cls}">${label}</div>`, iconSize: [size, size] }),
        zIndexOffset: isNext ? 1000 : 0,
      })
        .bindPopup(`<b>${placeLabel(p)}</b><br>${p.nameJa}${entry ? `<br>Arrive ~${fmtMin(entry.projectedArrive)}` : ''}${stop.status !== 'pending' ? `<br><i>${stop.status}</i>` : ''}`)
        .addTo(g)
    })
    L.polyline(pts, { color: '#0a84ff', weight: 3, opacity: 0.55, dashArray: '6 8' }).addTo(g)

    if (showStations) {
      timeline.entries
        .filter((e) => e.stop.status === 'pending' && e.stop.transport === 'train')
        .forEach((e) => {
          const leg = findLeg(e.prev.id, e.place.id)
          leg?.segments.forEach((seg) =>
            [seg.from, seg.to].forEach((st) =>
              L.marker([st.lat, st.lng], {
                icon: L.divIcon({ className: '', html: `<div class="station-dot" style="border-color:${seg.colour}"></div>`, iconSize: [12, 12] }),
              })
                .bindPopup(`<b>${st.name} Station</b><br>${st.nameJa}${st.code ? ` · ${st.code}` : ''}<br>${seg.line}`)
                .addTo(g),
            ),
          )
        })
    }
  }, [state, timeline, showStations])

  // Blue dot and accuracy circle.
  useEffect(() => {
    const g = userLayer.current
    if (!g) return
    g.clearLayers()
    if (!geo.position) return
    const ll: L.LatLngTuple = [geo.position.lat, geo.position.lng]
    if (geo.accuracy) L.circle(ll, { radius: geo.accuracy, color: '#0a84ff', weight: 1, fillOpacity: 0.1 }).addTo(g)
    L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [18, 18] }), zIndexOffset: 2000 }).addTo(g)
    if (!centredOnce.current && visible && !geo.outsideTokyo) {
      map.current?.setView(ll, 15)
      centredOnce.current = true
    }
  }, [geo.position, geo.accuracy, geo.outsideTokyo, visible])

  useEffect(() => {
    if (focus && visible) {
      map.current?.setView([focus.lat, focus.lng], 16)
    }
  }, [focus, visible])

  const cur = timeline.nextIndex >= 0 ? timeline.entries[timeline.nextIndex] : undefined
  const recentre = () => {
    if (geo.position) map.current?.setView([geo.position.lat, geo.position.lng], 16)
    else geo.start()
  }
  const showAll = () => {
    const b = L.latLngBounds(timeline.entries.map((e) => [e.place.lat, e.place.lng] as L.LatLngTuple))
    const s = getPlace(state.startPlaceId)
    b.extend([s.lat, s.lng])
    map.current?.fitBounds(b, { padding: [40, 40] })
  }

  return (
    <div className="fixed inset-0" style={{ display: visible ? 'block' : 'none' }}>
      <div ref={el} className="absolute inset-0" />

      <div className="absolute right-3 top-[max(env(safe-area-inset-top),12px)] z-[500] flex flex-col gap-2">
        <MapBtn label="Centre on me" onClick={recentre}>
          <Crosshair size={20} className={geo.position ? 'text-accent' : ''} />
        </MapBtn>
        <MapBtn label="Show whole day" onClick={showAll}>
          <Navigation size={20} />
        </MapBtn>
        <MapBtn label="Toggle stations" onClick={() => setShowStations((v) => !v)}>
          <Layers size={20} className={showStations ? 'text-accent' : ''} />
        </MapBtn>
      </div>

      <div className="absolute left-3 right-3 z-[500] space-y-2" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
        {(!online || tileErrors > 3) && (
          <Notice tone="warn">{online ? 'Map tiles are failing to load. Markers still work.' : 'Offline: only map areas you viewed before will show.'}</Notice>
        )}
        {(geo.status === 'denied' || geo.status === 'unavailable' || geo.status === 'unsupported') && (
          <Card className="p-3">
            <LocationHelp geo={geo} />
          </Card>
        )}
        {cur && (
          <Card className="p-3 flex items-center gap-3 shadow-lg">
            <div className="pin next !size-10 shrink-0">{timeline.nextIndex + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold uppercase text-muted">Next stop</div>
              <div className="text-[17px] font-bold truncate">{placeLabel(cur.place)}</div>
              <div className="text-[13px] text-muted">
                {geo.position ? `${formatDistance(distanceKm(geo.position, cur.place))} straight line` : `Arrive ~${fmtMin(cur.projectedArrive)}`}
              </div>
            </div>
            <LinkButton variant="primary" className="shrink-0" href={directionsUrl(cur.place, modeToGoogle[cur.stop.transport], geo.position ?? cur.prev)}>
              Go
            </LinkButton>
          </Card>
        )}
        <div className="flex gap-3 justify-center text-[11px] font-medium">
          <Legend cls="start" text="Start" />
          <Legend cls="next" text="Next" />
          <Legend cls="upcoming" text="Upcoming" />
          <Legend cls="done" text="Done" />
        </div>
      </div>
    </div>
  )
}

function MapBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="size-12 grid place-items-center rounded-2xl bg-card shadow-lg">
      {children}
    </button>
  )
}

function Legend({ cls, text }: { cls: string; text: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-card px-2 py-1 shadow">
      <span className={`pin ${cls}`} style={{ width: 10, height: 10, borderWidth: 1.5, boxShadow: 'none' }} />
      {text}
    </span>
  )
}
