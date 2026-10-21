import { CircleCheck, CircleDashed, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { StepState } from './progress'

export function StepBadge({ state }: { state: StepState }) {
  if (state === 'done')
    return (
      <Badge variant="success">
        <CircleCheck aria-hidden /> Concluída
      </Badge>
    )
  if (state === 'likely-done')
    return (
      <Badge variant="rose">
        <Sparkles aria-hidden /> Você já deve ter feito
      </Badge>
    )
  return (
    <Badge variant="muted">
      <CircleDashed aria-hidden /> Pendente
    </Badge>
  )
}
