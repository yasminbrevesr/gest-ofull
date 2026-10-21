import type { ReactNode } from 'react'
import { InfoTip } from '@/components/common/info-tip'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProfitResult } from './engine'
import { help, listingTypeLabels, shippingLabels } from './labels'
import { MarginBadge, statusSurface, statusText } from './margin-indicator'
import type { CalculatorInputs } from './engine'

function Row({
  label,
  value,
  help: helpText,
  strong,
  minus,
  className,
}: {
  label: ReactNode
  value: number
  help?: string
  strong?: boolean
  minus?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1.5 text-sm', strong && 'font-semibold', className)}>
      <span className="flex items-center gap-1 text-left">
        {label}
        {helpText && <InfoTip term={typeof label === 'string' ? label : 'este valor'}>{helpText}</InfoTip>}
      </span>
      <span className="tabular whitespace-nowrap">
        {minus && value > 0 ? '− ' : ''}
        {formatCurrency(value)}
      </span>
    </div>
  )
}

/** Resultado principal: lucro, margem, ROI e a conta detalhada. */
export function ResultCard({ result, inputs }: { result: ProfitResult; inputs: CalculatorInputs }) {
  const multiple = result.quantity > 1
  return (
    <Card className="overflow-hidden">
      <div className={cn('space-y-3 border-b p-5', statusSurface[result.status])}>
        <MarginBadge status={result.status} />
        <div>
          <p className="text-sm text-muted-foreground dark:text-foreground/80">
            {multiple ? `Lucro líquido (${result.quantity} unidades)` : 'Lucro líquido por venda'}
          </p>
          <p className={cn('tabular font-display text-4xl font-bold', statusText[result.status])} aria-live="polite">
            {formatCurrency(result.netProfit)}
          </p>
          {multiple && <p className="tabular text-sm">{formatCurrency(result.netProfitUnit)} por unidade</p>}
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-card/70 p-3">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              Margem <InfoTip term="Margem">{help.margin}</InfoTip>
            </dt>
            <dd className="tabular text-xl font-semibold">{formatPercent(result.marginPct)}</dd>
          </div>
          <div className="rounded-lg bg-card/70 p-3">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              ROI <InfoTip term="ROI">{help.roi}</InfoTip>
            </dt>
            <dd className="tabular text-xl font-semibold">{result.roiPct == null ? '—' : formatPercent(result.roiPct)}</dd>
          </div>
        </dl>
      </div>
      <CardContent className="divide-y divide-border pt-3">
        <div className="pb-2">
          <Row label={multiple ? 'Valor da venda' : 'Preço de venda'} value={result.revenue} />
          <Row
            label={`Comissão ${listingTypeLabels[inputs.listingType]} (${formatPercent(result.commissionRate, 2)})`}
            value={result.commission}
            help={result.commissionFromTable ? help.commission : 'Comissão informada por você.'}
            minus
          />
          <Row label="Custo fixo" value={result.fixedFee} help={help.fixedFee} minus />
          <Row label={`Envio (${shippingLabels[inputs.shippingMethod]})`} value={result.shipping} minus />
          {result.fixedFeeCapped && <p className="pb-1 text-xs text-muted-foreground">Custo fixo limitado à metade do preço (produto abaixo de R$ 19).</p>}
        </div>
        <div className="py-2">
          <Row label="Você recebe do Mercado Livre" value={result.received} help={help.received} strong />
        </div>
        <div className="py-2">
          <Row label={`Imposto (${formatPercent(inputs.taxRate ?? 0, 2)})`} value={result.tax} minus />
          <Row label="Custo do produto" value={result.productCost} minus />
          {result.packaging > 0 && <Row label="Embalagem" value={result.packaging} minus />}
          {result.ads > 0 && <Row label="Ads" value={result.ads} minus />}
          {result.other > 0 && <Row label="Outros custos" value={result.other} minus />}
        </div>
        <div className="pt-2">
          <Row label="Lucro líquido" value={result.netProfit} strong className="text-base" />
        </div>
      </CardContent>
    </Card>
  )
}
