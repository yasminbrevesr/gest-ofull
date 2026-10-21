/** Vínculo da calculadora com o estoque (preenchido a partir de um produto). */
export interface CalculatorPrefill {
  productId: string
  name: string | null
  productCost: number | null
  salePrice: number | null
  weightGrams: number | null
}

/** Seleção do produto do estoque ao salvar uma simulação (disponível com o módulo de estoque). */
export function ProductPicker(_props: { value: string | null; onChange: (id: string | null) => void }) {
  return null
}
