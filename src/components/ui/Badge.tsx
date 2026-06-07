import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Tone = 'neutral' | 'gain' | 'loss' | 'gold' | 'brand'

const tones: Record<Tone, string> = {
  neutral: 'bg-[var(--color-canvas)] text-[var(--color-muted)]',
  gain: 'bg-brand-50 text-brand-700',
  loss: 'bg-rose-50 text-rose-600',
  gold: 'bg-amber-50 text-amber-600',
  brand: 'bg-brand-600 text-white',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tnum',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
