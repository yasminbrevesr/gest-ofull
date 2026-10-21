import { ArrowRight, CircleCheck, Tag } from 'lucide-react'
import { DecimalInput } from '@/components/common/decimal-input'
import { Field } from '@/components/common/field'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioCards } from '@/components/ui/radio-cards'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { PromoOutcome, PromoTargetKind } from './engine'
import { MarginBadge } from './margin-indicator'

export const promoTargetOptions: { value: PromoTargetKind; label: string; description: string }[] = [
  { value: 'received', label: 'Receber na conta', description: 'Depois da comissão, custo fixo e frete' },
  { value: 'profit', label: 'Lucro no bolso', description: 'Depois também de custos e impostos' },
  { value: 'promo_price', label: 'Preço final', description: 'O que o comprador paga com desconto' },
]

const targetLabels: Record<PromoTargetKind, string> = {
  received: 'Você recebe do Mercado Livre',
  profit: 'Seu lucro líquido',
  promo_price: 'O comprador paga',
}

export interface PromoTarget {
  kind: PromoTargetKind
  value: number | null
  discount: number | null
}

/** Campos da promoção: o que garantir, quanto e qual desconto. */
export function PromotionTargetCard({ value, onChange }: { value: PromoTarget; onChange: (next: PromoTarget) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sua promoção</CardTitle>
        <CardDescription>
          Diga quanto você quer garantir em cada venda e o desconto que vai dar. Calculamos o preço cheio do anúncio para que, com o desconto, você chegue nesse
          valor — já com as tarifas do preço com desconto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p id="promo-kind" className="text-sm font-medium">
            O que você quer garantir?
          </p>
          <RadioCards
            aria-labelledby="promo-kind"
            columns={3}
            value={value.kind}
            onValueChange={(kind) => onChange({ ...value, kind })}
            options={promoTargetOptions}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={value.kind === 'promo_price' ? 'Preço com desconto' : value.kind === 'profit' ? 'Lucro desejado' : 'Quero receber'}
            htmlFor="promo-value"
            hint="Por unidade vendida."
          >
            <DecimalInput id="promo-value" prefix="R$" placeholder="50,00" value={value.value} onValueChange={(v) => onChange({ ...value, value: v })} />
          </Field>
          <Field label="Desconto da promoção" htmlFor="promo-discount" hint="O que aparece riscado no anúncio.">
            <DecimalInput id="promo-discount" suffix="%" value={value.discount} onValueChange={(v) => onChange({ ...value, discount: v })} />
          </Field>
        </div>
      </CardContent>
    </Card>
  )
}

/** Resultado: preço cheio ("de"), preço com desconto ("por") e o que sobra. */
export function PromotionResult({
  outcome,
  kind,
  target,
  onOpenInCalculator,
}: {
  outcome: Extract<PromoOutcome, { ok: true }>
  kind: PromoTargetKind
  target: number
  onOpenInCalculator: () => void
}) {
  const { result, fullPriceResult } = outcome
  const achieved = kind === 'received' ? result.received : kind === 'profit' ? result.netProfit : result.salePrice
  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-primary/30 bg-primary-soft p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary-text">
          <Tag className="size-4" aria-hidden /> Coloque no anúncio
        </p>
        <div>
          <p className="text-sm text-muted-foreground dark:text-foreground/80">Preço cheio (o “de”)</p>
          <p className="tabular font-serif text-4xl font-semibold" aria-live="polite">
            {formatCurrency(outcome.listPrice)}
          </p>
        </div>
        <p className="text-sm">
          Com <strong>{formatPercent(outcome.discountPct, 2)}</strong> de desconto, o comprador paga{' '}
          <strong className="tabular">{formatCurrency(outcome.promoPrice)}</strong>.
        </p>
      </div>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden />
          <p>
            {targetLabels[kind]}: <strong className="tabular">{formatCurrency(achieved)}</strong>
            {achieved > target + 0.005 && (
              <span className="text-muted-foreground"> (alvo {formatCurrency(target)}; a diferença vem do arredondamento dos centavos)</span>
            )}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {kind !== 'received' && (
            <div>
              <dt className="text-xs text-muted-foreground">Recebe do Mercado Livre</dt>
              <dd className="tabular font-semibold">{formatCurrency(result.received)}</dd>
            </div>
          )}
          {kind !== 'profit' && (
            <div>
              <dt className="text-xs text-muted-foreground">Lucro líquido</dt>
              <dd className="tabular font-semibold">{formatCurrency(result.netProfit)}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Margem</dt>
            <dd className="tabular font-semibold">{formatPercent(result.marginPct)}</dd>
          </div>
        </dl>
        <MarginBadge status={result.status} />
        <p className="text-xs text-muted-foreground">
          Sem a promoção (vendendo a {formatCurrency(outcome.listPrice)}), você receberia {formatCurrency(fullPriceResult.received)} e lucraria{' '}
          {formatCurrency(fullPriceResult.netProfit)} por unidade.
        </p>
        <Button variant="outline" className="w-full" onClick={onOpenInCalculator}>
          Ver a conta com desconto <ArrowRight />
        </Button>
      </CardContent>
    </Card>
  )
}

export function FairDiscountNote() {
  return (
    <Alert variant="warning" title="Desconto precisa ser de verdade">
      O preço cheio deve ser o que você realmente pratica. Subir o preço só para anunciar um desconto em seguida pode ser considerado propaganda enganosa
      (Código de Defesa do Consumidor), e o Mercado Livre pode recusar a promoção. Use o cálculo para planejar o preço do anúncio antes de entrar em promoções.
    </Alert>
  )
}

/** Resumo fixo no rodapé do celular: preço cheio e preço com desconto. */
export function PromoMobileSummary({ listPrice, promoPrice, discountPct }: { listPrice: number; promoPrice: number; discountPct: number }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Preço cheio no anúncio</p>
          <p className="tabular font-serif text-xl font-semibold">{formatCurrency(listPrice)}</p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          −{formatPercent(discountPct, 2)} → comprador paga
          <span className="tabular block text-sm font-semibold text-foreground">{formatCurrency(promoPrice)}</span>
        </p>
      </div>
    </div>
  )
}
