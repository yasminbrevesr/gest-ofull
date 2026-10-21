import { CircleAlert, Inbox, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { errorMessage } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export function LoadingState({ label = 'Carregando…', rows = 3, className }: { label?: string; rows?: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('space-y-3', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function FullPageLoading() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center">
      <span className="sr-only">Carregando…</span>
      <div className="size-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary" />
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-10 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/12 text-primary-text [&_svg]:size-6">
        {icon ?? <Inbox />}
      </div>
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold">{title}</p>
        {description && <div className="max-w-md text-sm text-muted-foreground">{description}</div>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  title = 'Não foi possível carregar',
  className,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-xl border border-coral/45 bg-coral/10 px-6 py-8 text-center', className)}>
      <CircleAlert className="size-7" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Tentar de novo
        </Button>
      )}
    </div>
  )
}
