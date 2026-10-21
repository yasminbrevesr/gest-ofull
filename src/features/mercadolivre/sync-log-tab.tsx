import { CircleAlert, CircleCheck, Info, MinusCircle, ScrollText } from 'lucide-react'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSyncLogs } from './api'
import { syncKindNames, type SyncLog } from './types'

const icons = {
  success: { icon: CircleCheck, className: 'tint-success' },
  error: { icon: CircleAlert, className: 'tint-danger' },
  skipped: { icon: MinusCircle, className: 'bg-muted text-muted-foreground' },
  info: { icon: Info, className: 'tint-warning' },
}

/** Registro do que a integração fez (o que foi enviado, quando, sucesso/erro). */
export function SyncLogTab() {
  const logs = useSyncLogs(200)
  if (logs.isLoading) return <LoadingState rows={5} />
  if (logs.error) return <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
  if (!logs.data!.length)
    return <EmptyState icon={<ScrollText />} title="Nada registrado ainda" description="Importações, vendas e envios de estoque aparecem aqui." />
  return (
    <Card className="divide-y divide-border">
      {logs.data!.map((log) => (
        <LogRow key={log.id} log={log} />
      ))}
    </Card>
  )
}

function LogRow({ log }: { log: SyncLog }) {
  const { icon: Icon, className } = icons[log.status]
  const failures = Array.isArray(log.details?.failures) ? (log.details!.failures as { id?: string; error?: string }[]) : []
  return (
    <div className="flex gap-3 p-4">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', className)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm">
          <span className="font-semibold">{syncKindNames[log.kind] ?? log.kind}</span>
          {log.ml_item_id && <span className="text-muted-foreground"> · {log.ml_item_id}</span>}
        </p>
        <p className="text-sm">{log.message}</p>
        {failures.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Ver detalhes</summary>
            <ul className="mt-1 list-disc pl-4">
              {failures.map((f, i) => (
                <li key={i}>
                  {f.id}: {f.error}
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</p>
      </div>
    </div>
  )
}
