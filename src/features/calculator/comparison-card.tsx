import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { calculateProfit, type CalcContext, type CalculatorInputs, type ListingType } from './engine'
import { listingTypeLabels } from './labels'
import { MarginBadge } from './margin-indicator'

/** Clássico x Premium lado a lado, com os mesmos custos. */
export function ComparisonCard({ inputs, ctx, onPick }: { inputs: CalculatorInputs; ctx: CalcContext; onPick: (type: ListingType) => void }) {
  const types: ListingType[] = ['classico', 'premium']
  const outcomes = types.map((type) => ({ type, outcome: calculateProfit({ ...inputs, listingType: type }, ctx) }))
  if (outcomes.some((o) => !o.outcome.ok)) return null
  const results = outcomes.map((o) => ({ type: o.type, result: o.outcome.ok ? o.outcome.result : null! }))
  const best = results[0].result.netProfit >= results[1].result.netProfit ? 'classico' : 'premium'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clássico x Premium</CardTitle>
        <CardDescription>
          O Premium cobra mais, mas o comprador parcela sem juros e o anúncio aparece mais. Às vezes vale a pena mesmo com lucro menor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {results.map(({ type, result }) => (
            <div
              key={type}
              className={cn('space-y-2 rounded-lg border p-3', inputs.listingType === type ? 'border-primary ring-1 ring-primary' : 'border-border')}
            >
              <div>
                <p className="font-semibold">{listingTypeLabels[type]}</p>
                {best === type && results[0].result.netProfit !== results[1].result.netProfit && <p className="text-xs text-muted-foreground">Maior lucro</p>}
              </div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Comissão</dt>
                  <dd className="tabular">{formatPercent(result.commissionRate, 2)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Lucro</dt>
                  <dd className="tabular font-semibold">{formatCurrency(result.netProfit)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Margem</dt>
                  <dd className="tabular">{formatPercent(result.marginPct)}</dd>
                </div>
              </dl>
              <MarginBadge status={result.status} className="text-xs" />
              {inputs.listingType !== type && (
                <Button variant="link" size="sm" className="text-xs" onClick={() => onPick(type)}>
                  Usar {listingTypeLabels[type]}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
