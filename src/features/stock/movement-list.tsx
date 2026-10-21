import { History } from 'lucide-react'
import { EmptyState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { movementLabels, originLabels, type StockMovement } from './types'

/** Tabela do histórico de movimentações. */
export function MovementList({ movements, showProduct = false }: { movements: StockMovement[]; showProduct?: boolean }) {
  if (movements.length === 0) {
    return <EmptyState icon={<History />} title="Nenhuma movimentação ainda" description="Entradas, saídas, vendas e ajustes aparecem aqui." />
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          {showProduct && <TableHead>Produto</TableHead>}
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Qtd.</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
          <TableHead>Motivo</TableHead>
          <TableHead>Origem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(m.created_at)}</TableCell>
            {showProduct && (
              <TableCell>
                <span className="font-medium">{m.products?.name ?? '—'}</span>
                {m.product_variants && <span className="block text-xs text-muted-foreground">{m.product_variants.name}</span>}
              </TableCell>
            )}
            <TableCell>
              {movementLabels[m.movement_type]}
              {!showProduct && m.product_variants && <span className="block text-xs text-muted-foreground">{m.product_variants.name}</span>}
            </TableCell>
            <TableCell className={cn('tabular text-right font-semibold whitespace-nowrap', m.quantity > 0 ? 'text-primary-text' : 'text-foreground')}>
              {m.quantity > 0 ? `+${m.quantity}` : `−${Math.abs(m.quantity)}`}
            </TableCell>
            <TableCell className="tabular text-right">{m.balance_after}</TableCell>
            <TableCell className="max-w-56 text-muted-foreground">
              {m.reason ?? '—'}
              {m.external_ref && <span className="block text-xs">Ref.: {m.external_ref}</span>}
            </TableCell>
            <TableCell>
              <Badge variant={m.origin === 'mercado_livre' ? 'warning' : m.origin === 'importacao' ? 'rose' : 'muted'}>{originLabels[m.origin]}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
