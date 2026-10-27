import { BookOpen, Compass, House, ListChecks, Map } from 'lucide-react'
import { inJapan } from '../lib/destination'

export type Tab = 'home' | 'map' | 'nearby' | 'itinerary' | 'guide'

const TABS: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'map', label: 'Map', Icon: Map },
  { id: 'nearby', label: 'Nearby', Icon: Compass },
  { id: 'itinerary', label: 'Itinerary', Icon: ListChecks },
  { id: 'guide', label: 'Trains', Icon: BookOpen },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-[900] nav-blur backdrop-blur-xl border-t border-line pb-safe">
      <div className="grid grid-cols-5">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10.5px] font-semibold ${tab === id ? 'text-accent' : 'text-muted'}`}
          >
            <Icon size={24} strokeWidth={tab === id ? 2.4 : 1.8} />
            {/* Away from Japan the guide tab covers all local transport. */}
            {id === 'guide' && !inJapan() ? 'Transit' : label}
          </button>
        ))}
      </div>
    </nav>
  )
}
