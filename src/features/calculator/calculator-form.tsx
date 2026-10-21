import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { DecimalInput } from '@/components/common/decimal-input'
import { Field } from '@/components/common/field'
import { InfoTip } from '@/components/common/info-tip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/input'
import { RadioCards } from '@/components/ui/radio-cards'
import { formatPercent } from '@/lib/format'
import type { Category } from './api'
import { findCommissionRule, todayInBrazil, type CalculatorInputs, type FeeRule } from './engine'
import { help, listingTypeOptions, shippingOptions } from './labels'

interface CalculatorFormProps {
  value: CalculatorInputs
  onChange: (next: CalculatorInputs) => void
  categories: Category[]
  rules: FeeRule[]
  /** No modo reverso o preço é o que queremos descobrir. */
  mode: 'forward' | 'reverse'
}

export function CalculatorForm({ value, onChange, categories, rules, mode }: CalculatorFormProps) {
  const set = <K extends keyof CalculatorInputs>(key: K, v: CalculatorInputs[K]) => onChange({ ...value, [key]: v })
  const [showDimensions, setShowDimensions] = useState(Boolean(value.weightGrams || value.lengthCm))
  const tableRule = findCommissionRule(rules, value.categoryId, value.listingType, todayInBrazil())

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Produto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {mode === 'forward' && (
            <Field label="Preço de venda" htmlFor="sale-price">
              <DecimalInput id="sale-price" prefix="R$" value={value.salePrice} onValueChange={(v) => set('salePrice', v)} placeholder="0,00" />
            </Field>
          )}
          <Field label="Custo do produto" htmlFor="product-cost" hint="Quanto você paga por unidade.">
            <DecimalInput id="product-cost" prefix="R$" value={value.productCost} onValueChange={(v) => set('productCost', v)} placeholder="0,00" />
          </Field>
          <Field label="Quantidade" htmlFor="quantity" hint="Unidades na venda.">
            <DecimalInput id="quantity" decimals={0} value={value.quantity} onValueChange={(v) => set('quantity', v)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anúncio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <p id="listing-type-label" className="text-sm font-medium">
                Tipo de anúncio
              </p>
              <InfoTip term="Clássico x Premium">
                No Clássico a comissão é menor e o comprador parcela com juros. No Premium a comissão é maior, o comprador parcela sem juros e o anúncio
                ganha mais exposição.
              </InfoTip>
            </div>
            <RadioCards aria-labelledby="listing-type-label" value={value.listingType} onValueChange={(v) => set('listingType', v)} options={listingTypeOptions} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria" htmlFor="category" help={help.commission} helpTerm="Comissão" hint={tableRule ? `Comissão de referência: ${formatPercent(tableRule.percent, 2)}` : undefined}>
              <NativeSelect id="category" value={value.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value || null)}>
                <option value="">Escolha a categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Comissão exata" htmlFor="commission-override" optional help={help.commissionOverride} helpTerm="Comissão exata" hint="Deixe vazio para usar a referência.">
              <DecimalInput id="commission-override" suffix="%" value={value.commissionOverride} onValueChange={(v) => set('commissionOverride', v)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Envio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <p id="shipping-label" className="text-sm font-medium">
                Forma de envio
              </p>
              <InfoTip term="Full">{help.full}</InfoTip>
            </div>
            <RadioCards
              aria-labelledby="shipping-label"
              columns={3}
              value={value.shippingMethod}
              onValueChange={(v) => set('shippingMethod', v)}
              options={shippingOptions}
            />
          </div>
          <Field label="Custo de envio pago por você" htmlFor="shipping-cost" help={help.shippingCost} helpTerm="Custo de envio" hint="Por unidade. Confira no anúncio do Mercado Livre." className="sm:max-w-xs">
            <DecimalInput id="shipping-cost" prefix="R$" value={value.shippingCost} onValueChange={(v) => set('shippingCost', v)} placeholder="0,00" />
          </Field>

          <button
            type="button"
            onClick={() => setShowDimensions((s) => !s)}
            className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-primary-text"
            aria-expanded={showDimensions}
            aria-controls="dimensions"
          >
            <ChevronDown className={`size-4 transition-transform duration-150 ${showDimensions ? 'rotate-180' : ''}`} />
            Peso e medidas da embalagem (opcional)
          </button>
          {showDimensions && (
            <div id="dimensions" className="space-y-2">
              <p className="text-xs text-muted-foreground">{help.weight}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Peso" htmlFor="weight">
                  <DecimalInput id="weight" suffix="g" decimals={0} value={value.weightGrams} onValueChange={(v) => set('weightGrams', v)} />
                </Field>
                <Field label="Comprimento" htmlFor="length">
                  <DecimalInput id="length" suffix="cm" decimals={1} value={value.lengthCm} onValueChange={(v) => set('lengthCm', v)} />
                </Field>
                <Field label="Largura" htmlFor="width">
                  <DecimalInput id="width" suffix="cm" decimals={1} value={value.widthCm} onValueChange={(v) => set('widthCm', v)} />
                </Field>
                <Field label="Altura" htmlFor="height">
                  <DecimalInput id="height" suffix="cm" decimals={1} value={value.heightCm} onValueChange={(v) => set('heightCm', v)} />
                </Field>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outros custos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Embalagem" htmlFor="packaging" hint="Caixa, envelope, fita… por unidade.">
            <DecimalInput id="packaging" prefix="R$" value={value.packagingCost} onValueChange={(v) => set('packagingCost', v)} placeholder="0,00" />
          </Field>
          <Field label="Imposto" htmlFor="tax" help={help.tax} helpTerm="Imposto">
            <DecimalInput id="tax" suffix="%" value={value.taxRate} onValueChange={(v) => set('taxRate', v)} />
          </Field>
          <Field label="Ads por venda" htmlFor="ads" help={help.ads} helpTerm="Custo de Ads por venda">
            <DecimalInput id="ads" prefix="R$" value={value.adsCost} onValueChange={(v) => set('adsCost', v)} placeholder="0,00" />
          </Field>
          <Field label="Outros custos" htmlFor="other" help={help.other} helpTerm="Outros custos">
            <DecimalInput id="other" prefix="R$" value={value.otherCosts} onValueChange={(v) => set('otherCosts', v)} placeholder="0,00" />
          </Field>
        </CardContent>
      </Card>
    </div>
  )
}
