import { ArrowRight, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { useLowStockItems } from '../stock/api'
import { StockStatusBadge } from '../stock/stock-badges'
import { itemStatus } from '../stock/stock-logic'

/** Itens no estoque mínimo ou abaixo. */
export function LowStockCard() {
  const items = useLowStockItems()

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Estoque baixo</CardTitle>
        {Boolean(items.data?.length) && (
          <Button asChild variant="link" size="sm">
            <Link to="/estoque?filtro=baixo">
              Ver todos <ArrowRight />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : items.error ? (
          <ErrorState error={items.error} onRetry={() => items.refetch()} />
        ) : items.data!.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <PackageCheck className="size-5 text-primary-text" /> Nenhum item abaixo do mínimo.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.data!.slice(0, 6).map((item) => (
              <li key={item.variant_id ?? item.product_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link to={`/estoque/${item.product_id}`} className="min-w-0 hover:text-primary-text">
                  <span className="block truncate font-medium">{item.product_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.variant_name ? `${item.variant_name} · ` : ''}SKU {item.sku}
                  </span>
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular">
                    {item.current_stock} <span className="text-xs text-muted-foreground">/ mín. {item.min_stock}</span>
                  </span>
                  <StockStatusBadge status={itemStatus(item.current_stock, item.min_stock)} className="max-sm:hidden" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
