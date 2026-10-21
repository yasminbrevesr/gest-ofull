import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('size-9 shrink-0', className)}>
      <rect width="64" height="64" rx="14" fill="#488399" />
      <path d="M14 34 50 16 40 50 31 38 22 46 24 36Z" fill="#F4F2F0" />
      <path d="M24 36 50 16 31 38Z" fill="#F1BEBE" />
    </svg>
  )
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="leading-tight">
        <span className="block font-serif text-lg font-semibold">Gestão Decola Full</span>
        <span className="block text-xs text-muted-foreground">Seu começo no Mercado Livre</span>
      </span>
    </span>
  )
}
