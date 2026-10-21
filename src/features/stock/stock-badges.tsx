import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { StockStatus } from './types'

const config = {
  out: { variant: 'danger', label: 'Sem estoque', icon: CircleAlert },
  low: { variant: 'warning', label: 'Estoque baixo', icon: TriangleAlert },
  ok: { variant: 'muted', label: 'Em estoque', icon: CircleCheck },
} as const

export function StockStatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  const { variant, label, icon: Icon } = config[status]
  return (
    <Badge variant={variant} className={className}>
      <Icon aria-hidden /> {label}
    </Badge>
  )
}
