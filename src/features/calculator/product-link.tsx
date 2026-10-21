import { Field } from '@/components/common/field'
import { NativeSelect } from '@/components/ui/input'
import { useProducts } from '../stock/api'

/** Vínculo da calculadora com o estoque (preenchido a partir de um produto). */
export interface CalculatorPrefill {
  productId: string
  name: string | null
  productCost: number | null
  salePrice: number | null
  weightGrams: number | null
}

/** Escolha do produto do estoque ao salvar uma simulação. */
export function ProductPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const products = useProducts()
  const active = (products.data ?? []).filter((p) => !p.archived_at || p.id === value)
  return (
    <Field label="Produto do estoque" htmlFor="simulation-product" optional hint="A simulação aparece na página do produto.">
      <NativeSelect id="simulation-product" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} disabled={products.isLoading}>
        <option value="">{products.isLoading ? 'Carregando…' : 'Nenhum'}</option>
        {active.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.sku})
          </option>
        ))}
      </NativeSelect>
    </Field>
  )
}
