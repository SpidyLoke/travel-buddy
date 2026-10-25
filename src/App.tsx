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
import { resetDonki } from './components/Donki'
import { TrainGuide } from './components/TrainGuide'
import { useGeolocation } from './hooks/useGeolocation'
import { loadVisited, useItinerary } from './hooks/useItinerary'
import { useNow } from './hooks/useNow'
import { useOnline } from './hooks/useOnline'
import { PhotosProvider } from './hooks/usePhotos'
import { usePrefs } from './hooks/usePrefs'
import { useTheme } from './hooks/useTheme'
import { existingHome, homeTrip, homeTripFromHere } from './lib/home'
import { adviseSchedule, buildTimeline } from './lib/schedule'
import { nowMinJst } from './lib/time'
import { PLACES } from './data/places'
import type { Place } from './types'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [journeyStopId, setJourneyStopId] = useState<string | null>(null)
  const [focus, setFocus] = useState<Place | null>(null)
  const now = useNow()
  const geo = useGeolocation()
  const itin = useItinerary()
  const online = useOnline()
  const theme = useTheme()
  const prefs = usePrefs()
  const [wizard, setWizard] = useState<'new' | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const showWizard = !prefs.prefs.onboarded || wizard !== null

  const nowMin = nowMinJst(now)
  const timeline = useMemo(() => buildTimeline(itin.state, nowMin), [itin.state, nowMin])
  const advice = useMemo(() => adviseSchedule(itin.state, timeline), [itin.state, timeline])
  const trip = useMemo(() => homeTrip(itin.state, timeline, nowMin), [itin.state, timeline, nowMin])
  const gpsLive = geo.status === 'active' && !geo.outsideTokyo ? geo.position : null
  const hereTrip = useMemo(() => (gpsLive ? homeTripFromHere(itin.state, gpsLive, nowMin) : null), [itin.state, gpsLive, nowMin])
  const [homeOpen, setHomeOpen] = useState(false)

  // Nothing left to navigate to: stop GPS to save battery.
  const dayDone = timeline.nextIndex === -1
  const { stop: stopGps, status: gpsStatus } = geo
  useEffect(() => {
    if (dayDone && (gpsStatus === 'active' || gpsStatus === 'locating')) stopGps()
  }, [dayDone, gpsStatus, stopGps])

  const journey = journeyStopId ? timeline.entries.find((e) => e.stop.id === journeyStopId) : undefined
  const gps = geo.status === 'active' && !geo.outsideTokyo ? geo.position : null

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
          planNew={planNew}
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

      {settingsOpen && <SettingsSheet geo={geo} itin={itin} prefs={prefs} theme={theme} onPlanNew={planNew} onClose={() => setSettingsOpen(false)} />}
      {showWizard && (
        <PlanWizard
          geo={geo}
          firstRun={!prefs.prefs.onboarded}
          initialHome={prefs.prefs.onboarded ? existingHome(itin.state) : null}
          prefs={prefs.prefs}
          visited={loadVisited()}
          onCancel={prefs.prefs.onboarded ? () => setWizard(null) : undefined}
          onDone={(state, patch) => {
            prefs.update(patch)
            itin.replace(state)
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
