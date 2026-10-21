import { describe, expect, it } from 'vitest'
import { filterProducts, itemStatus, productStatus, suggestSku, summarizeStock } from './stock-logic'
import type { Product, ProductVariant } from './types'

const variant = (over: Partial<ProductVariant>): ProductVariant => ({
  id: 'v',
  product_id: 'p',
  name: 'Azul',
  attributes: {},
  sku: 'V',
  cost: null,
  sale_price: null,
  current_stock: 5,
  min_stock: 1,
  created_at: '',
  updated_at: '',
  ...over,
})

const product = (over: Partial<Product>): Product => ({
  id: 'p',
  name: 'Caneca',
  sku: 'CANECA',
  photo_path: null,
  cost: 10,
  sale_price: 30,
  current_stock: 5,
  min_stock: 2,
  weight_g: null,
  length_cm: null,
  width_cm: null,
  height_cm: null,
  notes: null,
  has_variants: false,
  archived_at: null,
  created_at: '',
  updated_at: '',
  product_variants: [],
  ...over,
})

describe('status do estoque', () => {
  it('classifica cada item', () => {
    expect(itemStatus(0, 0)).toBe('out')
    expect(itemStatus(2, 2)).toBe('low')
    expect(itemStatus(3, 2)).toBe('ok')
  })

  it('produto com variações assume a pior situação', () => {
    const p = product({ has_variants: true, product_variants: [variant({ current_stock: 9 }), variant({ current_stock: 1, min_stock: 2 })] })
    expect(productStatus(p)).toBe('low')
  })
})

describe('suggestSku', () => {
  it('gera SKU sem acentos e espaços', () => {
    expect(suggestSku('Camiseta Básica Azul (M)')).toBe('CAMISETA-BASICA-AZUL-M')
    expect(suggestSku('  Vela aromática 200g  ')).toBe('VELA-AROMATICA-200G')
    expect(suggestSku('Kit organizador de gavetas multiuso')).toBe('KIT-ORGANIZADOR-DE-GAVETAS-MUL')
  })
})

describe('filtros e resumo', () => {
  const list = [
    product({ id: '1', name: 'Caneca', sku: 'CANECA', current_stock: 1, min_stock: 2 }),
    product({
      id: '2',
      name: 'Camiseta',
      sku: 'CAM',
      has_variants: true,
      current_stock: 8,
      product_variants: [variant({ sku: 'CAM-AZ', name: 'Azul', current_stock: 8, cost: 20 })],
    }),
    product({ id: '3', name: 'Vela antiga', sku: 'VELA', archived_at: '2026-10-01' }),
    product({ id: '4', name: 'Sabonete', sku: 'SAB', current_stock: 0 }),
  ]

  it('busca por nome, SKU e variação, sem acento', () => {
    expect(filterProducts(list, 'cam-az', 'todos').map((p) => p.id)).toEqual(['2'])
    expect(filterProducts(list, 'CANECA', 'todos').map((p) => p.id)).toEqual(['1'])
  })

  it('filtra por situação', () => {
    expect(filterProducts(list, '', 'baixo').map((p) => p.id)).toEqual(['1', '4'])
    expect(filterProducts(list, '', 'sem-estoque').map((p) => p.id)).toEqual(['4'])
    expect(filterProducts(list, '', 'arquivados').map((p) => p.id)).toEqual(['3'])
    expect(filterProducts(list, '', 'todos')).toHaveLength(3)
  })

  it('resume o estoque ativo', () => {
    expect(summarizeStock(list)).toEqual({ products: 3, units: 9, lowItems: 2, stockValue: 10 + 160 })
  })
})
