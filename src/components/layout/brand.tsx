import { useId } from 'react'
import { cn } from '@/lib/utils'

/** Traços do monograma RV (coordenadas da arte original, 1256×1256). */
const RV_PATHS = ['M354 538V276.5H555A128.5 128.5 0 0 1 603 524.4L793 858L1008 489', 'M333 538.5H488.5L728 1001', 'M354 628V791.5H620']

/** Monograma RV solto (sem fundo), na cor do texto atual. */
export function RvGlyph({ className, strokeWidth = 43 }: { className?: string; strokeWidth?: number }) {
  const clip = `rv${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg viewBox="304 229 740 780" aria-hidden className={cn('shrink-0', className)}>
      <clipPath id={clip}>
        <path d="M300 200H900V520H1060V980H300Z" />
      </clipPath>
      <g fill="none" stroke="currentColor" strokeWidth={strokeWidth} clipPath={`url(#${clip})`}>
        {RV_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  )
}

/** Ícone da marca: bloco amarelo com o monograma RV em preto. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-on-accent shadow-[0_0_18px_-4px_rgb(255_196_0/0.55)]',
        className,
      )}
    >
      <RvGlyph className="size-[66%]" strokeWidth={58} />
    </span>
  )
}

/** Marca: "gestão" + "DECOLA FULL" em amarelo, espaçado (como no login). */
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
