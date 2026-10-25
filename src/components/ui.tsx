import type { ComponentProps, ReactNode } from 'react'
import { X } from 'lucide-react'

export function Card({ className = '', ...rest }: ComponentProps<'div'>) {
  return <div className={`bg-card rounded-3xl ${className}`} {...rest} />
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'luup' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white active:opacity-80',
  secondary: 'bg-fill active:opacity-70',
  ghost: 'active:opacity-60',
  luup: 'bg-luup text-white active:opacity-80',
  danger: 'bg-bad/10 text-bad active:opacity-70',
}

export function Button({ variant = 'secondary', className = '', ...rest }: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 min-h-12 font-semibold text-[15px] transition-opacity disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

/** Anchor styled as a button. External links always open in a new context. */
export function LinkButton({ variant = 'secondary', className = '', onClick, ...rest }: ComponentProps<'a'> & { variant?: Variant }) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!navigator.onLine && !confirm('You are offline. Google Maps and LUUP need a connection and may not load. Open anyway?')) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 min-h-12 font-semibold text-[15px] transition-opacity ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="sheet-enter mt-auto max-h-[94dvh] bg-app rounded-t-[28px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <div className="flex-1 min-w-0 text-lg font-bold">{title}</div>
          <button aria-label="Close" onClick={onClose} className="size-9 grid place-items-center rounded-full bg-card-2">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-[calc(24px+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

export function Pill({ className = '', ...rest }: ComponentProps<'span'>) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`} {...rest} />
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-5 pb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h2>
}

export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; children: ReactNode; action?: ReactNode }) {
  const t = { info: 'bg-accent/10 text-accent', warn: 'bg-warn/15 text-[#a66a00] dark:text-warn', bad: 'bg-bad/12 text-bad', ok: 'bg-ok/12 text-ok' }[tone]
  return (
    <div className={`rounded-2xl px-4 py-3 text-[14px] font-medium flex items-center gap-3 ${t}`}>
      <div className="flex-1">{children}</div>
      {action}
    </div>
  )
}
