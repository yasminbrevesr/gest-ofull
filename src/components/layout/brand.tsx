import { useId } from 'react'
import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  const gradient = useId()
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('size-9 shrink-0 drop-shadow-[0_0_14px_rgb(16_224_154/0.35)]', className)}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10E09A" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gradient})`} />
      <path d="M14 34 50 16 40 50 31 38 22 46 24 36Z" fill="#04120C" />
      <path d="M24 36 50 16 31 38Z" fill="#0B3B2A" />
    </svg>
  )
}

/** Marca: "gestão" + "DECOLA FULL" em verde, espaçado (como no login). */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="leading-none">
        <span className="sr-only">Gestão Decola Full</span>
        <span aria-hidden className="block font-display text-lg font-bold tracking-tight">
          gestão
        </span>
        <span aria-hidden className="mt-1 block text-[10px] font-bold tracking-[0.32em] text-primary-text">
          DECOLA FULL
        </span>
      </span>
    </span>
  )
}
