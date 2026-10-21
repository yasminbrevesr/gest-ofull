import type { Product, ProductVariant, StockStatus } from './types'

/** Estoque baixo = no mínimo definido ou abaixo; sem estoque = zero ou negativo. */
export function itemStatus(current: number, min: number): StockStatus {
  if (current <= 0) return 'out'
  if (current <= min) return 'low'
  return 'ok'
}

/** Status do produto: com variações, vale a pior situação entre elas. */
export function productStatus(
  product: Pick<Product, 'has_variants' | 'current_stock' | 'min_stock'> & { product_variants: Pick<ProductVariant, 'current_stock' | 'min_stock'>[] },
): StockStatus {
  if (!product.has_variants || product.product_variants.length === 0) return itemStatus(product.current_stock, product.min_stock)
  const statuses = product.product_variants.map((v) => itemStatus(v.current_stock, v.min_stock))
  if (statuses.includes('out')) return 'out'
  if (statuses.includes('low')) return 'low'
  return 'ok'
}

/** Sugere um SKU a partir do nome: "Camiseta Azul M" → "CAMISETA-AZUL-M". */
export function suggestSku(name: string, maxLength = 30): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export type StockFilter = 'todos' | 'baixo' | 'sem-estoque' | 'arquivados'

export function filterProducts(products: Product[], query: string, filter: StockFilter): Product[] {
  const q = normalize(query.trim())
  return products.filter((p) => {
    if (filter === 'arquivados' ? !p.archived_at : p.archived_at) return false
    const status = productStatus(p)
    if (filter === 'baixo' && status === 'ok') return false
    if (filter === 'sem-estoque' && status !== 'out') return false
    if (!q) return true
    const haystack = [p.name, p.sku, ...p.product_variants.flatMap((v) => [v.name, v.sku])].join(' ')
    return normalize(haystack).includes(q)
  })
}

export interface StockSummary {
  products: number
  units: number
  lowItems: number
  /** Custo do estoque (custo × quantidade), só de itens com custo informado. */
  stockValue: number
}

export function summarizeStock(products: Product[]): StockSummary {
  const active = products.filter((p) => !p.archived_at)
  let lowItems = 0
  let stockValue = 0
  for (const p of active) {
    const items = p.has_variants ? p.product_variants : [p]
    for (const item of items) {
      if (itemStatus(item.current_stock, item.min_stock) !== 'ok') lowItems++
      const cost = 'product_id' in item ? (item.cost ?? p.cost) : p.cost
      if (cost != null && item.current_stock > 0) stockValue += cost * item.current_stock
    }
  }
  return {
    products: active.length,
    units: active.reduce((sum, p) => sum + Math.max(p.current_stock, 0), 0),
    lowItems,
    stockValue: Math.round(stockValue * 100) / 100,
  }
}
