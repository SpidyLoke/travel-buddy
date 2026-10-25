import { ArrowUpDown, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { fmtMoney, fromYen, getFx, refreshFx, toYen } from '../lib/fx'
import { getPrefs } from '../lib/prefs'
import { Button, Card, Notice, Sheet } from './ui'

const QUICK = [100, 500, 1000, 3000, 5000, 10000]

/** Yen ↔ home currency, using the last saved exchange rate. */
export function ConverterSheet({ online, onClose }: { online: boolean; onClose: () => void }) {
  const cur = getPrefs().currency
  const [yenFirst, setYenFirst] = useState(true)
  const [text, setText] = useState('1000')
  const [, setTick] = useState(0)
  const fx = getFx()
  const n = Number(text.replace(/[^\d.]/g, '')) || 0
  const out = yenFirst ? fromYen(n, cur) : toYen(n, cur)
  const rate = fx?.rates[cur]

  return (
    <Sheet title={`Yen ↔ ${cur}`} onClose={onClose}>
      <div className="space-y-3">
        {!rate ? (
          <Notice tone="warn">{online ? 'Getting the exchange rate…' : 'No exchange rate saved yet. Connect once to download it.'}</Notice>
        ) : (
          <>
            <Card className="p-4 space-y-3">
              <label className="block">
                <span className="text-[13px] font-semibold text-muted">{yenFirst ? 'Japanese yen' : cur}</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-muted">{yenFirst ? '¥' : cur === 'MYR' ? 'RM' : cur}</span>
                  <input
                    inputMode="decimal"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full bg-transparent text-4xl font-bold tabular-nums outline-none"
                    aria-label="Amount"
                  />
                </div>
              </label>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--line)]" />
                <button aria-label="Swap currencies" onClick={() => setYenFirst((v) => !v)} className="size-10 grid place-items-center rounded-full bg-card-2">
                  <ArrowUpDown size={18} />
                </button>
                <div className="h-px flex-1 bg-[var(--line)]" />
              </div>
              <div>
                <span className="text-[13px] font-semibold text-muted">{yenFirst ? cur : 'Japanese yen'}</span>
                <div className="text-4xl font-bold tabular-nums text-accent">{out == null ? '–' : fmtMoney(out, yenFirst ? cur : 'JPY')}</div>
              </div>
            </Card>
            {yenFirst && (
              <div className="grid grid-cols-3 gap-2">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => setText(String(q))} className="rounded-2xl bg-card py-2.5 text-left px-3">
                    <div className="font-semibold tabular-nums">¥{q.toLocaleString('en-GB')}</div>
                    <div className="text-[13px] text-muted tabular-nums">{fmtMoney(fromYen(q, cur)!, cur)}</div>
                  </button>
                ))}
              </div>
            )}
            <p className="px-1 text-[12px] text-muted">
              1 JPY = {rate.toPrecision(4)} {cur} · {fx!.source}, rates for {fx!.date}. Reference rate only: card and money-changer rates will be a little worse.
            </p>
          </>
        )}
        {online && (
          <Button
            className="w-full text-[14px]"
            onClick={async () => {
              const cached = getFx()
              if (cached) cached.fetchedAt = 0
              await refreshFx()
              setTick((t) => t + 1)
            }}
          >
            <RefreshCw size={16} /> Update rate
          </Button>
        )}
        <p className="px-1 text-[12px] text-muted">Change the currency in Settings.</p>
      </div>
    </Sheet>
  )
}
