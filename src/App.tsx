import { useEffect, useMemo, useState } from 'react'
import { BottomNav, type Tab } from './components/BottomNav'
import { Dashboard } from './components/Dashboard'
import { ItineraryView } from './components/ItineraryView'
import { HomeSheet } from './components/HomeTrip'
import { JourneySheet } from './components/JourneySheet'
import { MapView } from './components/MapView'
import { NearbyView } from './components/NearbyView'
import { PlanWizard } from './components/PlanWizard'
import { SettingsSheet } from './components/SettingsSheet'
import { ConverterSheet } from './components/ConverterSheet'
import { ImportSheet } from './components/ImportSheet'
import { ShareSheet } from './components/ShareSheet'
import { FoodSheet, type MealSlot } from './components/Food'
import { JoinLobbySheet, LobbyBar, LobbySheet } from './components/Lobby'
import { resetDonki } from './components/Donki'
import { TrainGuide } from './components/TrainGuide'
import { useGeolocation } from './hooks/useGeolocation'
import { loadVisited, useItinerary } from './hooks/useItinerary'
import { useNow } from './hooks/useNow'
import { useOnline } from './hooks/useOnline'
import { PhotosProvider } from './hooks/usePhotos'
import { useLobby } from './hooks/useLobby'
import { usePrefs } from './hooks/usePrefs'
import { useTrip } from './hooks/useTrip'
import { useReminders } from './hooks/useReminders'
import { useTheme } from './hooks/useTheme'
import { existingHome, homePlace, homeTrip, homeTripFromHere } from './lib/home'
import { adviseSchedule, buildTimeline } from './lib/schedule'
import { fmtMin, nowMinLocal, setTimeZone, todayLocal } from './lib/time'
import { setDestination } from './lib/destination'
import { countryOfZone, deviceTz } from './lib/locale'
import { regionOf } from './data/regions'
import { replanFromNow } from './lib/replan'
import { refreshWeather } from './lib/weather'
import { PLACES, placeLabel } from './data/places'
import { refreshFx } from './lib/fx'
import { clearIncoming, decodePlan, parseInvite } from './lib/share'
import type { ItineraryState, Place } from './types'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [journeyStopId, setJourneyStopId] = useState<string | null>(null)
  const [focus, setFocus] = useState<Place | null>(null)
  const now = useNow()
  const geo = useGeolocation()
  const itin = useItinerary()
  // Clocks, prices and transport follow wherever the active plan is.
  // No plan yet: go by the phone's own clock and country.
  const noPlan = !itin.state.home
  setTimeZone(itin.state.tz ?? (noPlan ? deviceTz() : 'Asia/Tokyo'))
  const planHome = homePlace(itin.state)
  setDestination(
    itin.state.country ?? (noPlan ? (countryOfZone(deviceTz()) ?? '??') : undefined),
    noPlan ? 'live' : Number.isFinite(planHome.lat) ? regionOf(planHome) : 'tokyo',
  )
  const online = useOnline()
  const theme = useTheme()
  const prefs = usePrefs()
  const [wizard, setWizard] = useState<'new' | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [converterOpen, setConverterOpen] = useState(false)
  const [foodFor, setFoodFor] = useState<MealSlot | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  const tripPlan = useTrip(itin)
  const lobby = useLobby(itin)
  const [lobbyOpen, setLobbyOpen] = useState(false)

  // Opened from a shared plan link or a lobby invite?
  const [incoming, setIncoming] = useState<ItineraryState | null>(null)
  const [invite, setInvite] = useState<{ code: string; plan: ItineraryState | null; link: string | null } | null>(null)

  /** Opens a lobby invite or shared plan from a link or pasted text. False if it isn't one. */
  const openInvite = async (text: string, fromLink: boolean): Promise<boolean | 'already'> => {
    const parsed = parseInvite(text)
    if (!parsed) return false
    const plan = parsed.plan ? await decodePlan(parsed.plan) : null
    if (parsed.lobby) {
      if (parsed.lobby === lobby.code) return 'already'
      setInvite({ code: parsed.lobby, plan, link: fromLink ? location.href : null })
      return true
    }
    if (!plan) return false
    setIncoming(plan)
    return true
  }

  useEffect(() => {
    if (!location.hash) return
    openInvite(location.hash, true).then((ok) => ok !== true && clearIncoming())
    // Only on first load.
  }, [])

  // Weather for the trip's dates at home (or central Tokyo); re-render when it arrives.
  const [, setWxTick] = useState(0)
  const wxHome = homePlace(itin.state)
  const wxAt = Number.isFinite(wxHome.lat) ? wxHome : { lat: 35.68, lng: 139.76 }
  const wxDates = [...new Set([todayLocal(), ...tripPlan.days.map((d) => d.date ?? todayLocal())])].join(',')
  useEffect(() => {
    if (online) refreshWeather(wxAt, wxDates.split(',')).then(() => setWxTick((t) => t + 1))
    // wxAt is captured via its rounded coordinates in the key below.
  }, [online, wxDates, `${wxAt.lat.toFixed(2)},${wxAt.lng.toFixed(2)}`])

  // Exchange rates: refresh when online; re-render once they arrive.
  const [, setFxTick] = useState(0)
  useEffect(() => {
    if (online) refreshFx().then(() => setFxTick((t) => t + 1))
  }, [online, itin.state.country])

  const showWizard = (!prefs.prefs.onboarded || wizard !== null) && !incoming && !invite

  const nowMin = nowMinLocal(now)
  // Where you are (live, or a recent last-known fix), so projections start from reality.
  const fresh = geo.updatedAt != null && Date.now() - geo.updatedAt < 45 * 60000
  const here = (geo.status === 'active' || geo.status === 'paused') && fresh ? geo.position : null
  const hereKey = here ? `${here.lat.toFixed(3)},${here.lng.toFixed(3)}` : ''
  const timeline = useMemo(() => buildTimeline(itin.state, nowMin, here), [itin.state, nowMin, hereKey]) // here via hereKey

  const replan = () => {
    const r = replanFromNow(itin.state, nowMinLocal(), here)
    if (!r) return
    const msg = [
      `New order from ${here ? 'where you are' : 'your last stop'}, leaving now:`,
      r.keep.length ? r.keep.join(' → ') : '(nothing fits)',
      r.shortened ? `\nVisits shortened to about ${Math.round(r.shortened * 100)}% to fit everything in.` : '',
      r.drop.length ? `\nSkipping (won't fit): ${r.drop.join(', ')}` : '',
      `\nBack home around ${fmtMin(r.homeArrive)}. Skipped stops can be restored.`,
    ].join('\n')
    if (confirm(msg)) itin.replace(r.state)
  }
  const advice = useMemo(() => adviseSchedule(itin.state, timeline), [itin.state, timeline])
  useReminders(timeline, itin.state.date, prefs.prefs.alerts)
  const trip = useMemo(() => homeTrip(itin.state, timeline, nowMin), [itin.state, timeline, nowMin])
  const gpsLive = geo.status === 'active' ? geo.position : null
  const hereTrip = useMemo(() => (gpsLive ? homeTripFromHere(itin.state, gpsLive, nowMin) : null), [itin.state, gpsLive, nowMin])
  const [homeOpen, setHomeOpen] = useState(false)

  // Nothing left to navigate to: stop GPS to save battery.
  const dayDone = timeline.nextIndex === -1
  const { stop: stopGps, status: gpsStatus } = geo
  useEffect(() => {
    if (dayDone && (gpsStatus === 'active' || gpsStatus === 'locating')) stopGps()
  }, [dayDone, gpsStatus, stopGps])

  const journey = journeyStopId ? timeline.entries.find((e) => e.stop.id === journeyStopId) : undefined
  const gps = geo.status === 'active' ? geo.position : null

  // Built-in destinations plus anything added from Nearby/search.
  const photoPlaces = useMemo(
    () => [...PLACES, ...(itin.state.customPlaces ?? [])].filter((p) => !p.hidden),
    [itin.state.customPlaces],
  )

  const planNew = () => {
    setSettingsOpen(false)
    setWizard('new')
  }

  const showOnMap = (p: Place) => {
    setFocus({ ...p })
    setTab('map')
  }

  return (
    <PhotosProvider online={online} places={photoPlaces}>
    <div className="min-h-full bg-app">
      {tab === 'home' && (
        <Dashboard
          now={now}
          geo={geo}
          itin={itin}
          timeline={timeline}
          advice={advice}
          online={online}
          openSettings={() => setSettingsOpen(true)}
          openConverter={() => setConverterOpen(true)}
          onReplan={replan}
          tripPlan={tripPlan}
          openFood={setFoodFor}
          lobbyBar={<LobbyBar lobby={lobby} onOpen={() => setLobbyOpen(true)} />}
          planNew={planNew}
          openNearby={() => setTab('nearby')}
          openJourney={() => timeline.nextIndex >= 0 && setJourneyStopId(timeline.entries[timeline.nextIndex].stop.id)}
          showOnMap={showOnMap}
          trip={hereTrip ?? trip}
          openHome={() => setHomeOpen(true)}
        />
      )}
      <MapView visible={tab === 'map'} geo={geo} state={itin.state} timeline={timeline} focus={focus} online={online} />
      {tab === 'itinerary' && (
        <ItineraryView
          itin={itin}
          timeline={timeline}
          advice={advice}
          gps={gps}
          openJourney={setJourneyStopId}
          showOnMap={showOnMap}
          trip={trip}
          openHome={() => setHomeOpen(true)}
          geo={geo}
          prefs={prefs.prefs}
          planNew={planNew}
          openShare={() => setShareOpen(true)}
          lobbyBar={<LobbyBar lobby={lobby} onOpen={() => setLobbyOpen(true)} />}
          tripPlan={tripPlan}
          openFood={setFoodFor}
          onReplan={replan}
        />
      )}
      {tab === 'nearby' && <NearbyView geo={geo} timeline={timeline} itin={itin} online={online} showOnMap={showOnMap} />}
      {tab === 'guide' && <TrainGuide />}

      <BottomNav
        tab={tab}
        onChange={(t) => {
          setTab(t)
          window.scrollTo({ top: 0 })
        }}
      />

      {invite && (
        <JoinLobbySheet
          plan={invite.plan}
          link={invite.link}
          onJoin={(name) => {
            lobby.join(invite.code, name, invite.plan)
            prefs.update({ onboarded: true })
            setInvite(null)
            clearIncoming()
            setTab('itinerary')
          }}
          onClose={() => {
            setInvite(null)
            clearIncoming()
          }}
        />
      )}
      {lobbyOpen && <LobbySheet lobby={lobby} state={itin.state} onClose={() => setLobbyOpen(false)} />}
      {incoming && (
        <ImportSheet
          plan={incoming}
          onUse={() => {
            itin.replace(incoming)
            prefs.update({ onboarded: true })
            setIncoming(null)
            clearIncoming()
            setTab('itinerary')
          }}
          onClose={() => {
            setIncoming(null)
            clearIncoming()
          }}
        />
      )}
      {foodFor && (
        <FoodSheet
          title={`${foodFor.meal.label} near ${placeLabel(foodFor.place)}`}
          near={foodFor.place}
          gps={gps}
          online={online}
          onClose={() => setFoodFor(null)}
        />
      )}
      {converterOpen && <ConverterSheet online={online} onClose={() => setConverterOpen(false)} />}
      {shareOpen && (
        <ShareSheet
          state={itin.state}
          lobby={lobby}
          onOpenLobby={() => {
            setShareOpen(false)
            setLobbyOpen(true)
          }}
          onJoinInvite={async (text) => {
            const ok = await openInvite(text, false)
            if (ok === true) setShareOpen(false)
            return ok
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
      {settingsOpen && <SettingsSheet onJoinInvite={async (text) => { const ok = await openInvite(text, false); if (ok === true) setSettingsOpen(false); return ok }} tripDays={tripPlan.days} geo={geo} itin={itin} prefs={prefs} theme={theme} onPlanNew={planNew} onClose={() => setSettingsOpen(false)} />}
      {showWizard && (
        <PlanWizard
          geo={geo}
          firstRun={!prefs.prefs.onboarded}
          initialHome={prefs.prefs.onboarded ? existingHome(itin.state) : null}
          prefs={prefs.prefs}
          visited={loadVisited()}
          onCancel={prefs.prefs.onboarded ? () => setWizard(null) : undefined}
          onJoinInvite={(text) => openInvite(text, false)}
          onDone={(days, patch) => {
            prefs.update(patch)
            tripPlan.setDays(days)
            resetDonki()
            setWizard(null)
            setTab('home')
            window.scrollTo({ top: 0 })
          }}
        />
      )}
      {homeOpen && (
        <HomeSheet
          planTrip={trip}
          hereTrip={hereTrip}
          gps={gps}
          pendingStops={itin.state.stops.filter((s) => s.status === 'pending').length}
          onEndDay={itin.skipRemaining}
          onClose={() => setHomeOpen(false)}
        />
      )}
      {journey && (
        <JourneySheet
          from={journey.prev}
          to={journey.place}
          mode={journey.stop.transport}
          gps={gps}
          onModeChange={(m) => itin.updateStop(journey.stop.id, { transport: m })}
          onClose={() => setJourneyStopId(null)}
        />
      )}
    </div>
    </PhotosProvider>
  )
}
