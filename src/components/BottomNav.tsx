import { BookOpen, House, ListChecks, Map } from 'lucide-react'

export type Tab = 'home' | 'map' | 'itinerary' | 'guide'

const TABS: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'map', label: 'Map', Icon: Map },
  { id: 'itinerary', label: 'Itinerary', Icon: ListChecks },
  { id: 'guide', label: 'Train Guide', Icon: BookOpen },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-[900] nav-blur backdrop-blur-xl border-t border-line pb-safe">
      <div className="grid grid-cols-4">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-semibold ${tab === id ? 'text-accent' : 'text-muted'}`}
          >
            <Icon size={24} strokeWidth={tab === id ? 2.4 : 1.8} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
