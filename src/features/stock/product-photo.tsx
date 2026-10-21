import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Miniatura da foto do produto (ou ícone quando não há foto). */
export function ProductPhoto({ url, name, className }: { url?: string | null; name: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground',
        className,
      )}
    >
      {url ? <img src={url} alt={name} className="size-full object-cover" loading="lazy" /> : <Package className="size-1/2" strokeWidth={1.5} aria-hidden />}
    </span>
  )
}
