import { describe, expect, it } from 'vitest'
import { csvTemplate, parseProductsCsv, productsToCsv } from './csv'
import type { Product } from './types'

describe('parseProductsCsv', () => {
  it('lê planilha do Excel brasileiro (; e vírgula decimal)', () => {
    const csv = '\ufeffSKU;Nome;Custo;Preço de venda;Estoque;Estoque mínimo\nCANECA;Caneca branca;12,50;1.039,90;20;5\n'
    const { rows, errors } = parseProductsCsv(csv)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      expect.objectContaining({ line: 2, sku: 'CANECA', name: 'Caneca branca', cost: 12.5, sale_price: 1039.9, stock: 20, min_stock: 5, parent_sku: null }),
    ])
  })

  it('aceita vírgula como separador e colunas com outros nomes', () => {
    const { rows } = parseProductsCsv('codigo,produto,preco,quantidade\nV1,Vela,"29,90",3\n')
    expect(rows[0]).toMatchObject({ sku: 'V1', name: 'Vela', sale_price: 29.9, stock: 3 })
  })

  it('campos vazios ficam nulos (mantém o valor atual)', () => {
    const { rows } = parseProductsCsv('sku;nome;custo;estoque\nX;;;\n')
    expect(rows[0]).toMatchObject({ sku: 'X', name: null, cost: null, stock: null })
  })

  it('aponta erros por linha sem descartar as boas', () => {
    const csv = [
      'sku;nome;sku_produto;variacao;custo;estoque',
      'A;Produto A;;;abc;1',
      ';Sem SKU;;;;',
      'B;Prod B;;;;2,5',
      'C;Prod C;;Azul;;',
      'D;Prod D;;;;1',
      'd;Repetido;;;;',
      'E;Var;E;Azul;;',
    ].join('\n')
    const { rows, errors } = parseProductsCsv(csv)
    expect(rows.map((r) => r.sku)).toEqual(['D'])
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 7, 8])
    expect(errors[0].message).toContain('Custo inválido')
    expect(errors[2].message).toContain('inteiro')
    expect(errors[4].message).toContain('repetido')
  })

  it('lista colunas desconhecidas', () => {
    expect(parseProductsCsv('sku;cor\nA;azul').unknownColumns).toEqual(['cor'])
  })

  it('o modelo de planilha é válido', () => {
    const { rows, errors } = parseProductsCsv(csvTemplate())
    expect(errors).toEqual([])
    expect(rows).toHaveLength(3)
    expect(rows[1]).toMatchObject({ parent_sku: 'CAM-BASICA', variant_name: 'Azul / M' })
  })
})

describe('productsToCsv', () => {
  const base: Product = {
    id: '1',
    name: 'Camiseta; básica',
    sku: 'CAM',
    photo_path: null,
    cost: 18,
    sale_price: 59.9,
    current_stock: 5,
    min_stock: 2,
    weight_g: 200,
    length_cm: null,
    width_cm: null,
    height_cm: null,
    notes: null,
    has_variants: true,
    archived_at: null,
    created_at: '',
    updated_at: '',
    product_variants: [
      {
        id: 'v',
        product_id: '1',
        name: 'Azul / M',
        attributes: {},
        sku: 'CAM-AZ-M',
        cost: null,
        sale_price: 64.9,
        current_stock: 5,
        min_stock: 1,
        created_at: '',
        updated_at: '',
      },
    ],
  }

  it('exporta e reimporta sem perder dados', () => {
    const csv = productsToCsv([base, { ...base, id: '2', sku: 'VELA', name: 'Vela', has_variants: false, product_variants: [], current_stock: 3 }])
    expect(csv.startsWith('\ufeffsku;nome;')).toBe(true)
    const { rows, errors } = parseProductsCsv(csv)
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({
      sku: 'CAM-AZ-M',
      name: 'Camiseta; básica',
      parent_sku: 'CAM',
      variant_name: 'Azul / M',
      cost: 18,
      sale_price: 64.9,
      stock: 5,
    })
    expect(rows[1]).toMatchObject({ sku: 'VELA', parent_sku: null, stock: 3, weight_g: 200 })
  })
})
