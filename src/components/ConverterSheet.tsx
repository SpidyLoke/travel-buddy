import { ArrowUpDown, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { convert, currencySymbol, fmtMoney, getFx, localCurrency, quickAmounts, refreshFx } from '../lib/fx'
import { getPrefs } from '../lib/prefs'
import { Button, Card, Notice, Sheet } from './ui'

const NAMES: Record<string, string> = {
  JPY: 'Japanese yen',
  MYR: 'Malaysian ringgit',
  SGD: 'Singapore dollar',
  THB: 'Thai baht',
  KRW: 'Korean won',
  USD: 'US dollar',
  GBP: 'Pound sterling',
  EUR: 'Euro',
}
const nameOf = (c: string) => NAMES[c] ?? c

/** Local currency ↔ your home currency, using the last saved exchange rate. */
export function ConverterSheet({ online, onClose }: { online: boolean; onClose: () => void }) {
  const home = getPrefs().currency
  // Paying in your own currency? Then yen is the useful other side.
  const local = localCurrency() === home ? (home === 'JPY' ? 'USD' : 'JPY') : localCurrency()
  const [localFirst, setLocalFirst] = useState(true)
  const [text, setText] = useState(String(quickAmounts(local)[2]))
  const [, setTick] = useState(0)
  const fx = getFx()
  const n = Number(text.replace(/[^\d.]/g, '')) || 0
  const [a, b] = localFirst ? [local, home] : [home, local]
  const out = convert(n, a, b)
  const rate = convert(1, local, home)

  return (
    <Sheet title={`${local} ↔ ${home}`} onClose={onClose}>
      <div className="space-y-3">
        {localCurrency() === home && (
          <Notice tone="info">
            Prices here are in {home}, your own currency. Showing {nameOf(local)} instead.
          </Notice>
        )}
        {rate == null ? (
          <Notice tone="warn">{online ? 'Getting the exchange rate…' : 'No exchange rate saved yet. Connect once to download it.'}</Notice>
        ) : (
          <>
            <Card className="p-4 space-y-3">
              <label className="block">
                <span className="text-[13px] font-semibold text-muted">{nameOf(a)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-muted">{currencySymbol(a)}</span>
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
                <button aria-label="Swap currencies" onClick={() => setLocalFirst((v) => !v)} className="size-10 grid place-items-center rounded-full bg-card-2">
                  <ArrowUpDown size={18} />
                </button>
                <div className="h-px flex-1 bg-[var(--line)]" />
              </div>
              <div>
                <span className="text-[13px] font-semibold text-muted">{nameOf(b)}</span>
                <div className="text-4xl font-bold tabular-nums text-accent">{out == null ? '–' : fmtMoney(out, b)}</div>
              </div>
            </Card>
            {localFirst && (
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts(local).map((q) => (
                  <button key={q} onClick={() => setText(String(q))} className="rounded-2xl bg-card py-2.5 text-left px-3">
                    <div className="font-semibold tabular-nums">{fmtMoney(q, local)}</div>
                    <div className="text-[13px] text-muted tabular-nums">{fmtMoney(convert(q, local, home)!, home)}</div>
                  </button>
                ))}
              </div>
            )}
            <p className="px-1 text-[12px] text-muted">
              1 {local} = {rate.toPrecision(4)} {home} · {fx!.source}, rates for {fx!.date}. Reference rate only: card and money-changer rates will be a little worse.
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
