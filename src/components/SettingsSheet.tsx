import { Home, Moon, RotateCcw, Sparkles, Sun, SunMoon } from 'lucide-react'
import { useState } from 'react'
import type { Geo } from '../hooks/useGeolocation'
import type { ItineraryApi } from '../hooks/useItinerary'
import type { PrefsApi } from '../hooks/usePrefs'
import { CURRENCIES } from '../lib/fx'
import { homePlace } from '../lib/home'
import { DIET_LABEL, INTEREST_LABEL, INTERESTS, type Diet } from '../lib/prefs'
import type { LuupPlan, ThemePref } from '../types'
import { PlaceSearch } from './PlaceSearch'
import { Button, Card, SectionTitle, Sheet } from './ui'

interface Props {
  geo: Geo
  itin: ItineraryApi
  prefs: PrefsApi
  theme: { pref: ThemePref; set: (t: ThemePref) => void }
  onPlanNew: () => void
  onClose: () => void
}

const LUUPS: { id: LuupPlan; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'payg', label: 'Pay per ride' },
  { id: 'sub', label: 'Subscription' },
]

export function SettingsSheet({ geo, itin, prefs, theme, onPlanNew, onClose }: Props) {
  const [editHome, setEditHome] = useState(false)
  const home = homePlace(itin.state)
  const seg = (active: boolean) => `rounded-xl py-2 text-[14px] font-semibold ${active ? 'bg-accent text-white' : 'text-muted'}`

  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="space-y-1">
        <Button variant="primary" className="w-full min-h-14 text-[17px]" onClick={onPlanNew}>
          <Sparkles size={20} /> Plan a new day
        </Button>

        <SectionTitle>Home / where you're staying</SectionTitle>
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Home size={20} className="text-accent shrink-0" />
            <div className="min-w-0 flex-1 font-semibold truncate">{home.name}</div>
            <Button className="min-h-9 px-3 text-[14px]" onClick={() => setEditHome((v) => !v)}>
              {editHome ? 'Cancel' : 'Change'}
            </Button>
          </div>
          {editHome && (
            <PlaceSearch
              geo={geo}
              onPick={(p) => {
                itin.setHome({ name: p.name, query: p.mapsQuery, lat: p.lat, lng: p.lng })
                setEditHome(false)
              }}
            />
          )}
        </Card>

        <SectionTitle>LUUP e-scooters</SectionTitle>
        <div className="grid grid-cols-3 rounded-2xl bg-card p-1">
          {LUUPS.map((l) => (
            <button key={l.id} onClick={() => prefs.update({ luup: l.id })} className={seg(prefs.prefs.luup === l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <p className="px-1 pt-1 text-[13px] text-muted">Changes which rides are recommended and how they are priced.</p>

        <SectionTitle>Interests (for recommendations)</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = prefs.prefs.interests.includes(i)
            return (
              <button
                key={i}
                onClick={() => prefs.update({ interests: on ? prefs.prefs.interests.filter((x) => x !== i) : [...prefs.prefs.interests, i] })}
                className={`rounded-full px-3.5 py-2 text-[14px] font-semibold ${on ? 'bg-accent text-white' : 'bg-card'}`}
              >
                {INTEREST_LABEL[i]}
              </button>
            )
          })}
        </div>

        <SectionTitle>Food needs</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DIET_LABEL) as Diet[]).map((d) => {
            const on = prefs.prefs.diet.includes(d)
            return (
              <button
                key={d}
                onClick={() => prefs.update({ diet: on ? prefs.prefs.diet.filter((x) => x !== d) : [...prefs.prefs.diet, d] })}
                className={`rounded-full px-3.5 py-2 text-[14px] font-semibold ${on ? 'bg-accent text-white' : 'bg-card'}`}
              >
                {DIET_LABEL[d]}
              </button>
            )
          })}
        </div>
        <p className="px-1 pt-1 text-[13px] text-muted">Used for lunch and dinner ideas. Halal also shows prayer spaces.</p>

        <SectionTitle>Your currency</SectionTitle>
        <Card className="p-4 flex items-center justify-between gap-3">
          <span className="font-semibold">Show prices in</span>
          <select
            value={prefs.prefs.currency}
            onChange={(e) => prefs.update({ currency: e.target.value })}
            className="bg-card-2 rounded-xl px-3 py-2 text-[16px] font-semibold"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Card>

        <SectionTitle>Appearance</SectionTitle>
        <div className="grid grid-cols-3 rounded-2xl bg-card p-1">
          {(
            [
              ['system', 'Auto', SunMoon],
              ['light', 'Light', Sun],
              ['dark', 'Dark', Moon],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} onClick={() => theme.set(id)} className={`flex items-center justify-center gap-1.5 ${seg(theme.pref === id)}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <SectionTitle>Data</SectionTitle>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (!confirm('Delete your plan, home, history and settings from this phone?')) return
            try {
              Object.keys(localStorage)
                .filter((k) => k.startsWith('tokyo-day:'))
                .forEach((k) => localStorage.removeItem(k))
            } catch {
              // Storage unavailable: nothing to clear.
            }
            location.reload()
          }}
        >
          <RotateCcw size={16} /> Start over
        </Button>
        <p className="px-1 pt-1 text-[12px] text-muted">Everything is stored only on this phone.</p>
      </div>
    </Sheet>
  )
}
