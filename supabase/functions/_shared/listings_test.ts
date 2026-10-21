import { assertEquals } from 'jsr:@std/assert@1'
import { extractSellerSku, isFullItem, listingRows, variationLabel, type MlItem } from './listings.ts'

const NOW = '2026-10-21T12:00:00.000Z'

Deno.test('SKU vem do atributo SELLER_SKU ou do seller_custom_field', () => {
  assertEquals(extractSellerSku({ attributes: [{ id: 'SELLER_SKU', value_name: ' CANECA-01 ' }] }), 'CANECA-01')
  assertEquals(extractSellerSku({ attributes: [], seller_custom_field: 'ANTIGO' }), 'ANTIGO')
  assertEquals(extractSellerSku({ attributes: [{ id: 'BRAND', value_name: 'X' }], seller_custom_field: '  ' }), null)
})

Deno.test('rótulo da variação junta os atributos', () => {
  assertEquals(
    variationLabel({
      id: 1,
      attribute_combinations: [
        { id: 'COLOR', name: 'Cor', value_name: 'Azul' },
        { id: 'SIZE', name: 'Tamanho', value_name: 'M' },
      ],
    }),
    'Cor: Azul · Tamanho: M',
  )
  assertEquals(variationLabel({ id: 1 }), null)
})

Deno.test('anúncio sem variação gera uma linha', () => {
  const item: MlItem = {
    id: 'MLB1',
    title: 'Caneca',
    price: 39.9,
    available_quantity: 7,
    status: 'active',
    listing_type_id: 'gold_special',
    attributes: [{ id: 'SELLER_SKU', value_name: 'CANECA-01' }],
    shipping: { logistic_type: 'cross_docking' },
  }
  const [row] = listingRows(item, 'u1', NOW)
  assertEquals(row.ml_variation_id, 0)
  assertEquals(row.seller_sku, 'CANECA-01')
  assertEquals(row.ml_available_quantity, 7)
  assertEquals(row.is_full, false)
})

Deno.test('anúncio com variações gera uma linha por variação e marca o Full', () => {
  const item: MlItem = {
    id: 'MLB2',
    title: 'Camiseta',
    price: 59.9,
    shipping: { logistic_type: 'fulfillment' },
    variations: [
      {
        id: 11,
        available_quantity: 3,
        attribute_combinations: [{ id: 'COLOR', name: 'Cor', value_name: 'Azul' }],
        attributes: [{ id: 'SELLER_SKU', value_name: 'CAM-AZ' }],
      },
      { id: 12, available_quantity: 0, price: 64.9, seller_custom_field: 'CAM-RS' },
    ],
  }
  const rows = listingRows(item, 'u1', NOW)
  assertEquals(
    rows.map((r) => [r.ml_variation_id, r.seller_sku, r.price, r.is_full]),
    [
      [11, 'CAM-AZ', 59.9, true],
      [12, 'CAM-RS', 64.9, true],
    ],
  )
  assertEquals(isFullItem(item), true)
})
