export type MovementType = 'entrada' | 'saida' | 'ajuste' | 'venda'
export type MovementOrigin = 'manual' | 'mercado_livre' | 'importacao'

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  attributes: Record<string, string>
  sku: string
  cost: number | null
  sale_price: number | null
  current_stock: number
  min_stock: number
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  photo_path: string | null
  cost: number | null
  sale_price: number | null
  current_stock: number
  min_stock: number
  weight_g: number | null
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  notes: string | null
  has_variants: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
  product_variants: ProductVariant[]
}

export interface StockMovement {
  id: string
  product_id: string
  variant_id: string | null
  movement_type: MovementType
  quantity: number
  balance_after: number
  reason: string | null
  origin: MovementOrigin
  external_ref: string | null
  created_at: string
  products?: { name: string; sku: string } | null
  product_variants?: { name: string; sku: string } | null
}

export interface StockItem {
  product_id: string
  variant_id: string | null
  product_name: string
  variant_name: string | null
  sku: string
  current_stock: number
  min_stock: number
  cost: number | null
  sale_price: number | null
  photo_path: string | null
  archived_at: string | null
  is_low: boolean
}

export type StockStatus = 'out' | 'low' | 'ok'

export const movementLabels: Record<MovementType, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
  venda: 'Venda',
}

export const originLabels: Record<MovementOrigin, string> = {
  manual: 'Manual',
  mercado_livre: 'Mercado Livre',
  importacao: 'Importação',
}
