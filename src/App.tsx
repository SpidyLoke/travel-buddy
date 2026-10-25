import { useEffect, useMemo, useState } from 'react'
import { BottomNav, type Tab } from './components/BottomNav'
import { Dashboard } from './components/Dashboard'
import { ItineraryView } from './components/ItineraryView'
import { HomeSheet } from './components/HomeTrip'
import { JourneySheet } from './components/JourneySheet'
import { MapView } from './components/MapView'
import { TrainGuide } from './components/TrainGuide'
import { useGeolocation } from './hooks/useGeolocation'
import { useItinerary } from './hooks/useItinerary'
import { useNow } from './hooks/useNow'
import { useOnline } from './hooks/useOnline'
import { PhotosProvider } from './hooks/usePhotos'
import { useTheme } from './hooks/useTheme'
import { homeTrip } from './lib/home'
import { adviseSchedule, buildTimeline } from './lib/schedule'
import { nowMinJst } from './lib/time'
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

  const nowMin = nowMinJst(now)
  const timeline = useMemo(() => buildTimeline(itin.state, nowMin), [itin.state, nowMin])
  const advice = useMemo(() => adviseSchedule(itin.state, timeline), [itin.state, timeline])
  const trip = useMemo(() => homeTrip(itin.state, timeline, nowMin), [itin.state, timeline, nowMin])
  const [homeOpen, setHomeOpen] = useState(false)

  // Nothing left to navigate to: stop GPS to save battery.
  const dayDone = timeline.nextIndex === -1
  const { stop: stopGps, status: gpsStatus } = geo
  useEffect(() => {
    if (dayDone && (gpsStatus === 'active' || gpsStatus === 'locating')) stopGps()
  }, [dayDone, gpsStatus, stopGps])

  const journey = journeyStopId ? timeline.entries.find((e) => e.stop.id === journeyStopId) : undefined
  const gps = geo.status === 'active' && !geo.outsideTokyo ? geo.position : null

  const showOnMap = (p: Place) => {
    setFocus({ ...p })
    setTab('map')
  }

  return (
    <PhotosProvider online={online}>
    <div className="min-h-full bg-app">
      {tab === 'home' && (
        <Dashboard
          now={now}
          geo={geo}
          itin={itin}
          timeline={timeline}
          advice={advice}
          online={online}
          theme={theme}
          openJourney={() => timeline.nextIndex >= 0 && setJourneyStopId(timeline.entries[timeline.nextIndex].stop.id)}
          showOnMap={showOnMap}
          trip={trip}
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
        />
      )}
      {tab === 'guide' && <TrainGuide />}

      <BottomNav
        tab={tab}
        onChange={(t) => {
          setTab(t)
          window.scrollTo({ top: 0 })
        }}
      />

      {homeOpen && <HomeSheet trip={trip} gps={gps} onClose={() => setHomeOpen(false)} />}
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
