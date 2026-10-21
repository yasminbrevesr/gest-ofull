import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MarginStatus } from './engine'
import { statusLabels } from './labels'

const variants = { healthy: 'success', tight: 'warning', loss: 'danger' } as const
const icons = { healthy: CircleCheck, tight: TriangleAlert, loss: CircleX }

/** Selo do indicador (cor + ícone + texto, para não depender só da cor). */
export function MarginBadge({ status, className }: { status: MarginStatus; className?: string }) {
  const Icon = icons[status]
  return (
    <Badge variant={variants[status]} className={cn('text-sm', className)}>
      <Icon aria-hidden /> {statusLabels[status]}
    </Badge>
  )
}

export const statusSurface: Record<MarginStatus, string> = {
  healthy: 'border-success/30 bg-success/10',
  tight: 'border-butter/40 bg-butter/10',
  loss: 'border-coral/45 bg-coral/12',
}

export const statusText: Record<MarginStatus, string> = {
  healthy: 'text-success-text',
  tight: 'text-butter-text',
  loss: 'text-coral-text',
}
