import { Calculator, History, RotateCcw, Save, Tag, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DecimalInput } from '@/components/common/decimal-input'
import { Field } from '@/components/common/field'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useProfile } from '@/providers/auth'
import { useFeeData, useSimulation, type FeeData, type Simulation } from './api'
import { CalculatorForm } from './calculator-form'
import { ComparisonCard } from './comparison-card'
import { calculateProfit, emptyInputs, promotionPrice, suggestPrice, type CalcContext, type CalculatorInputs, type ListingType } from './engine'
import { listingTypeLabels } from './labels'
import { MarginBadge } from './margin-indicator'
import { ReferenceNote } from './reference-note'
import { ResultCard } from './result-card'
import { SaveSimulationDialog } from './save-simulation-dialog'
import { ProductPicker, type CalculatorPrefill } from './product-link'
import { FairDiscountNote, PromoMobileSummary, PromotionResult, PromotionTargetCard, type PromoTarget } from './promotion-panel'

export default function CalculatorPage() {
  const [params] = useSearchParams()
  const simulationId = params.get('simulacao')
  const feeData = useFeeData()
  const profile = useProfile()
  const simulation = useSimulation(simulationId)

  return (
    <>
      <PageHeader
        title={
          <>
            Calculadora de <Highlight>lucro</Highlight>
          </>
        }
        description="Descubra quanto sobra de verdade em cada venda, depois de tarifas, frete, impostos e custos."
        actions={
          <Button asChild variant="outline">
            <Link to="/calculadora/simulacoes">
              <History /> Minhas simulações
            </Link>
          </Button>
        }
      />
      {feeData.isLoading || profile.isLoading || simulation.isLoading ? (
        <LoadingState rows={5} />
      ) : feeData.error ? (
        <ErrorState error={feeData.error} onRetry={() => feeData.refetch()} />
      ) : simulation.error ? (
        <ErrorState error={simulation.error} title="Não foi possível abrir a simulação" />
      ) : (
        <CalculatorWorkspace
          key={simulation.data?.id ?? 'nova'}
          feeData={feeData.data!}
          defaultTax={profile.data?.default_tax_rate ?? 0}
          simulation={simulation.data ?? null}
          prefill={readPrefill(params)}
        />
      )}
    </>
  )
}

/** Dados vindos do estoque (?produto=…&custo=…&preco=…). */
function readPrefill(params: URLSearchParams): CalculatorPrefill | null {
  const productId = params.get('produto')
  if (!productId) return null
  const num = (key: string) => {
    const v = params.get(key)
    return v == null || v === '' ? null : Number(v)
  }
  return { productId, name: params.get('nome'), productCost: num('custo'), salePrice: num('preco'), weightGrams: num('peso') }
}

type CalcMode = 'forward' | 'reverse' | 'promo'

interface WorkspaceProps {
  feeData: FeeData
  defaultTax: number
  simulation: Simulation | null
  prefill: CalculatorPrefill | null
}

function CalculatorWorkspace({ feeData, defaultTax, simulation, prefill }: WorkspaceProps) {
  const [, setParams] = useSearchParams()
  const [mode, setMode] = useState<CalcMode>('forward')
  const [inputs, setInputs] = useState<CalculatorInputs>(() => {
    if (simulation) return { ...emptyInputs(defaultTax), ...simulation.inputs }
    const base = emptyInputs(defaultTax)
    if (prefill) return { ...base, productCost: prefill.productCost, salePrice: prefill.salePrice, weightGrams: prefill.weightGrams }
    return base
  })
  const [targetMargin, setTargetMargin] = useState<number | null>(20)
  const [promo, setPromo] = useState<PromoTarget>({ kind: 'received', value: null, discount: 10 })
  const [saveOpen, setSaveOpen] = useState(false)

  const ctx: CalcContext = useMemo(() => ({ rules: feeData.rules, healthyMargin: feeData.settings.margin_healthy_pct }), [feeData])
  const forward = useMemo(() => calculateProfit(inputs, ctx), [inputs, ctx])
  const reverse = useMemo(() => (targetMargin == null ? null : suggestPrice(inputs, targetMargin, ctx)), [inputs, targetMargin, ctx])
  const promotion = useMemo(() => promotionPrice(inputs, { kind: promo.kind, value: promo.value }, promo.discount, ctx), [inputs, promo, ctx])
  const current = mode === 'forward' ? forward : reverse && reverse.ok ? { ok: true as const, result: reverse.result } : null

  function applySuggestedPrice(price: number, listingType: ListingType) {
    setInputs({ ...inputs, salePrice: price, listingType })
    setMode('forward')
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <ReferenceNote settings={feeData.settings} />
      {simulation && (
        <Alert variant="tip" title={`Simulação: ${simulation.name}`}>
          Você está editando uma simulação salva.{' '}
          <Link to="/calculadora" className="font-semibold underline underline-offset-2">
            Começar uma nova
          </Link>
        </Alert>
      )}
      {prefill && !simulation && (
        <Alert variant="tip">Calculando para o produto {prefill.name ? `“${prefill.name}”` : 'do estoque'}: custo e preço já preenchidos.</Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={mode} onValueChange={(v) => setMode(v as CalcMode)}>
          <TabsList>
            <TabsTrigger value="forward">
              <Calculator /> Quanto vou lucrar?
            </TabsTrigger>
            <TabsTrigger value="reverse">
              <Target /> Qual preço cobrar?
            </TabsTrigger>
            <TabsTrigger value="promo">
              <Tag /> Promoção
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" onClick={() => setInputs(emptyInputs(defaultTax))}>
          <RotateCcw /> Limpar
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {mode === 'reverse' && (
            <Card>
              <CardHeader>
                <CardTitle>Margem que você quer ter</CardTitle>
                <CardDescription>Calculamos o menor preço de venda que deixa essa margem de lucro, já com todas as tarifas.</CardDescription>
              </CardHeader>
              <CardContent>
                <Field
                  label="Margem desejada"
                  htmlFor="target-margin"
                  hint={`Abaixo de ${formatPercent(ctx.healthyMargin, 0)} a margem é considerada apertada.`}
                  className="max-w-xs"
                >
                  <DecimalInput id="target-margin" suffix="%" value={targetMargin} onValueChange={setTargetMargin} />
                </Field>
              </CardContent>
            </Card>
          )}
          {mode === 'promo' && <PromotionTargetCard value={promo} onChange={setPromo} />}
          <CalculatorForm value={inputs} onChange={setInputs} categories={feeData.categories} rules={feeData.rules} mode={mode} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {mode === 'reverse' && reverse?.ok && <SuggestedPrices inputs={inputs} targetMargin={targetMargin!} ctx={ctx} onApply={applySuggestedPrice} />}
          {mode === 'promo' ? (
            promotion.ok ? (
              <>
                <PromotionResult
                  outcome={promotion}
                  kind={promo.kind}
                  target={promo.value ?? 0}
                  onOpenInCalculator={() => {
                    setInputs({ ...inputs, salePrice: promotion.promoPrice, quantity: 1 })
                    setMode('forward')
                  }}
                />
                <FairDiscountNote />
                <ResultCard result={promotion.result} inputs={{ ...inputs, salePrice: promotion.promoPrice, quantity: 1 }} />
              </>
            ) : (
              <EmptyState icon={<Tag />} title="Preencha para ver o preço da promoção" description={promotion.error} />
            )
          ) : current?.ok ? (
            <>
              <ResultCard result={current.result} inputs={mode === 'reverse' && reverse?.ok ? { ...inputs, salePrice: reverse.price } : inputs} />
              {mode === 'forward' && <ComparisonCard inputs={inputs} ctx={ctx} onPick={(type) => setInputs({ ...inputs, listingType: type })} />}
              {mode === 'forward' && (
                <Button className="w-full" onClick={() => setSaveOpen(true)}>
                  <Save /> Salvar simulação
                </Button>
              )}
            </>
          ) : (
            <EmptyState
              icon={<Calculator />}
              title={mode === 'forward' ? 'Preencha para ver o lucro' : 'Preencha para ver o preço'}
              description={
                (mode === 'forward' ? (!forward.ok ? forward.error : null) : reverse && !reverse.ok ? reverse.error : 'Informe a margem desejada.') ?? undefined
              }
            />
          )}
        </aside>
      </div>

      {mode === 'promo' && promotion.ok && (
        <PromoMobileSummary listPrice={promotion.listPrice} promoPrice={promotion.promoPrice} discountPct={promotion.discountPct} />
      )}

      {mode === 'forward' && forward.ok && (
        <MobileSummary netProfit={forward.result.netProfit} marginPct={forward.result.marginPct} status={forward.result.status} />
      )}

      {saveOpen && forward.ok && (
        <SaveSimulationDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          inputs={inputs}
          result={forward.result}
          existingId={simulation?.id}
          initialName={simulation?.name ?? prefill?.name}
          initialProductId={simulation?.product_id ?? prefill?.productId}
          onSaved={(id) => setParams({ simulacao: id })}
          productPicker={(value, onChange) => <ProductPicker value={value} onChange={onChange} />}
        />
      )}
    </div>
  )
}

function SuggestedPrices({
  inputs,
  targetMargin,
  ctx,
  onApply,
}: {
  inputs: CalculatorInputs
  targetMargin: number
  ctx: CalcContext
  onApply: (price: number, type: ListingType) => void
}) {
  const types: ListingType[] = ['classico', 'premium']
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preço sugerido</CardTitle>
        <CardDescription>Para ter {formatPercent(targetMargin)} de margem:</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {types.map((type) => {
          const outcome = suggestPrice({ ...inputs, listingType: type }, targetMargin, ctx)
          return (
            <div
              key={type}
              className={cn('space-y-2 rounded-lg border p-3', inputs.listingType === type ? 'border-primary ring-1 ring-primary' : 'border-border')}
            >
              <p className="text-sm font-semibold">{listingTypeLabels[type]}</p>
              {outcome.ok ? (
                <>
                  <p className="tabular font-display text-2xl font-semibold">{formatCurrency(outcome.price)}</p>
                  <Button size="sm" variant="soft" className="w-full" onClick={() => onApply(outcome.price, type)}>
                    Usar este preço
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{outcome.error}</p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

/** Resumo fixo no rodapé do celular, para ver o lucro enquanto preenche. */
function MobileSummary({ netProfit, marginPct, status }: { netProfit: number; marginPct: number; status: 'healthy' | 'tight' | 'loss' }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Lucro líquido · margem {formatPercent(marginPct)}</p>
          <p className="tabular font-display text-xl font-semibold">{formatCurrency(netProfit)}</p>
        </div>
        <MarginBadge status={status} className="text-xs" />
      </div>
    </div>
  )
}
