import Papa from 'papaparse'
import { parseDecimal, toInputText } from '@/lib/format'
import type { Product } from './types'

/** Colunas da planilha (a mesma ordem é usada na exportação e no modelo). */
export const CSV_COLUMNS = [
  'sku',
  'nome',
  'sku_produto',
  'variacao',
  'custo',
  'preco_venda',
  'estoque',
  'estoque_minimo',
  'peso_g',
  'comprimento_cm',
  'largura_cm',
  'altura_cm',
  'observacoes',
] as const

type Column = (typeof CSV_COLUMNS)[number]

/** Nomes alternativos aceitos no cabeçalho. */
const aliases: Record<string, Column> = {
  sku: 'sku',
  codigo: 'sku',
  nome: 'nome',
  produto: 'nome',
  nome_do_produto: 'nome',
  sku_produto: 'sku_produto',
  sku_pai: 'sku_produto',
  variacao: 'variacao',
  custo: 'custo',
  preco_de_custo: 'custo',
  preco_venda: 'preco_venda',
  preco: 'preco_venda',
  preco_de_venda: 'preco_venda',
  estoque: 'estoque',
  estoque_atual: 'estoque',
  quantidade: 'estoque',
  estoque_minimo: 'estoque_minimo',
  minimo: 'estoque_minimo',
  peso_g: 'peso_g',
  peso: 'peso_g',
  comprimento_cm: 'comprimento_cm',
  comprimento: 'comprimento_cm',
  largura_cm: 'largura_cm',
  largura: 'largura_cm',
  altura_cm: 'altura_cm',
  altura: 'altura_cm',
  observacoes: 'observacoes',
  obs: 'observacoes',
}

export interface ImportRow {
  line: number
  sku: string
  name: string | null
  parent_sku: string | null
  variant_name: string | null
  cost: number | null
  sale_price: number | null
  stock: number | null
  min_stock: number | null
  weight_g: number | null
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  notes: string | null
}

export interface ImportIssue {
  line: number
  sku: string | null
  message: string
}

export interface ParsedImport {
  rows: ImportRow[]
  errors: ImportIssue[]
  unknownColumns: string[]
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\ufeff/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-.()]+/g, '_')
    .replace(/_+$/g, '')
}

const text = (value: string | undefined) => {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/** Lê o CSV (separado por ; ou ,) e valida linha a linha. */
export function parseProductsCsv(content: string): ParsedImport {
  const unknownColumns: string[] = []
  const result = Papa.parse<Record<string, string>>(content.replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => {
      const key = normalizeHeader(header)
      const column = aliases[key]
      if (!column && key) unknownColumns.push(header.trim())
      return column ?? `__ignorar_${key}`
    },
  })

  const rows: ImportRow[] = []
  const errors: ImportIssue[] = []
  const seen = new Set<string>()

  result.data.forEach((raw, index) => {
    const line = index + 2 // linha 1 = cabeçalho
    const sku = text(raw.sku)
    const issues: string[] = []

    const number = (column: Column, label: string, { integer = false } = {}) => {
      const value = text(raw[column])
      if (value == null) return null
      const parsed = parseDecimal(value)
      if (parsed == null || parsed < 0) {
        issues.push(`${label} inválido: "${value}"`)
        return null
      }
      if (integer && !Number.isInteger(parsed)) {
        issues.push(`${label} precisa ser um número inteiro: "${value}"`)
        return null
      }
      return parsed
    }

    const row: ImportRow = {
      line,
      sku: sku ?? '',
      name: text(raw.nome),
      parent_sku: text(raw.sku_produto),
      variant_name: text(raw.variacao),
      cost: number('custo', 'Custo'),
      sale_price: number('preco_venda', 'Preço de venda'),
      stock: number('estoque', 'Estoque', { integer: true }),
      min_stock: number('estoque_minimo', 'Estoque mínimo', { integer: true }),
      weight_g: number('peso_g', 'Peso', { integer: true }),
      length_cm: number('comprimento_cm', 'Comprimento'),
      width_cm: number('largura_cm', 'Largura'),
      height_cm: number('altura_cm', 'Altura'),
      notes: text(raw.observacoes),
    }

    if (!sku) issues.push('SKU vazio')
    else if (sku.length > 60) issues.push('SKU com mais de 60 caracteres')
    else if (seen.has(sku.toLowerCase())) issues.push(`SKU ${sku} repetido na planilha`)
    if (row.variant_name && !row.parent_sku) issues.push('Variação sem sku_produto (o SKU do produto principal)')
    if (row.parent_sku && sku && row.parent_sku.toLowerCase() === sku.toLowerCase()) issues.push('O SKU da variação precisa ser diferente do sku_produto')
    if (row.name && row.name.length > 200) issues.push('Nome com mais de 200 caracteres')

    if (sku) seen.add(sku.toLowerCase())
    if (issues.length) errors.push({ line, sku, message: issues.join('; ') })
    else rows.push(row)
  })

  return { rows, errors, unknownColumns }
}

const num = (value: number | null | undefined, decimals = 2) => toInputText(value, decimals)

function toCsv(lines: (string | number | null)[][]): string {
  // Ponto e vírgula + BOM: abre direto no Excel em português.
  return '\ufeff' + Papa.unparse({ fields: [...CSV_COLUMNS], data: lines }, { delimiter: ';', newline: '\r\n' })
}

/** Exporta no mesmo formato da importação (dá para editar e reimportar). */
export function productsToCsv(products: Product[]): string {
  const lines: (string | number | null)[][] = []
  for (const p of products) {
    const shared = [p.weight_g == null ? '' : String(p.weight_g), num(p.length_cm, 1), num(p.width_cm, 1), num(p.height_cm, 1), p.notes ?? '']
    if (p.has_variants && p.product_variants.length) {
      for (const v of p.product_variants) {
        lines.push([
          v.sku,
          p.name,
          p.sku,
          v.name,
          num(v.cost ?? p.cost),
          num(v.sale_price ?? p.sale_price),
          String(v.current_stock),
          String(v.min_stock),
          ...shared,
        ])
      }
    } else {
      lines.push([p.sku, p.name, '', '', num(p.cost), num(p.sale_price), String(p.current_stock), String(p.min_stock), ...shared])
    }
  }
  return toCsv(lines)
}

export function csvTemplate(): string {
  return toCsv([
    ['CANECA-BRANCA', 'Caneca branca 300ml', '', '', '12,50', '39,90', '20', '5', '400', '12', '9', '10', 'Fornecedor X'],
    ['CAM-AZUL-M', 'Camiseta básica', 'CAM-BASICA', 'Azul / M', '18', '59,90', '8', '2', '200', '', '', '', ''],
    ['CAM-AZUL-G', 'Camiseta básica', 'CAM-BASICA', 'Azul / G', '18', '59,90', '5', '2', '200', '', '', '', ''],
  ])
}
