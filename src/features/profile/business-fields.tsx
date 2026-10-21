import { DecimalInput } from '@/components/common/decimal-input'
import { Field } from '@/components/common/field'
import { RadioCards } from '@/components/ui/radio-cards'
import type { PersonType, TaxRegime } from '@/lib/types'
import { personTypeOptions, suggestedTaxRate, taxRateHelp, taxRegimeOptions } from './profile-options'

export interface BusinessValues {
  person_type: PersonType | null
  tax_regime: TaxRegime | null
  default_tax_rate: number | null
}

/** Tipo de vendedor, regime tributário e alíquota padrão (usados pela calculadora). */
export function BusinessFields({ value, onChange }: { value: BusinessValues; onChange: (next: BusinessValues) => void }) {
  const showRegime = value.person_type !== 'pf'

  function update(patch: Partial<BusinessValues>) {
    const next = { ...value, ...patch }
    if (next.person_type === 'pf') next.tax_regime = null
    if (next.person_type === 'mei') next.tax_regime = 'mei'
    // Ao trocar tipo/regime, sugere a alíquota correspondente.
    if (('person_type' in patch || 'tax_regime' in patch) && !('default_tax_rate' in patch)) {
      next.default_tax_rate = suggestedTaxRate(next.person_type, next.tax_regime)
    }
    onChange(next)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p id="person-type-label" className="text-sm font-medium">
          Como você vende (ou vai vender)?
        </p>
        <RadioCards
          aria-labelledby="person-type-label"
          columns={3}
          value={value.person_type ?? undefined}
          onValueChange={(v) => update({ person_type: v })}
          options={personTypeOptions}
        />
      </div>

      {showRegime && (
        <div className="space-y-2">
          <p id="regime-label" className="text-sm font-medium">
            Regime tributário
          </p>
          <RadioCards
            aria-labelledby="regime-label"
            columns={3}
            value={value.tax_regime ?? undefined}
            onValueChange={(v) => update({ tax_regime: v })}
            options={taxRegimeOptions}
          />
        </div>
      )}

      <Field
        label="Imposto sobre cada venda"
        htmlFor="tax-rate"
        help={taxRateHelp}
        helpTerm="Alíquota de imposto"
        hint="Usado como padrão na calculadora de lucro. Você pode mudar em cada simulação."
        className="max-w-xs"
      >
        <DecimalInput id="tax-rate" suffix="%" value={value.default_tax_rate} onValueChange={(v) => update({ default_tax_rate: v })} />
      </Field>
    </div>
  )
}

export function validateBusiness(value: BusinessValues): string | null {
  if (value.default_tax_rate == null) return 'Informe a porcentagem de imposto (pode ser 0).'
  if (value.default_tax_rate < 0 || value.default_tax_rate > 100) return 'O imposto precisa estar entre 0% e 100%.'
  return null
}
