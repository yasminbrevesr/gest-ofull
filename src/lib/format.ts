const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

/** R$ 1.234,56 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  // Intl usa espaço não separável entre "R$" e o número; trocamos por espaço comum.
  return currency.format(value).replace(/\u00a0/g, ' ')
}

/** 1.234,5 (até `maxDigits` casas decimais) */
export function formatNumber(value: number | null | undefined, maxDigits = 2, minDigits = 0): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits }).format(value)
}

/** 12,5% — recebe o valor já em pontos percentuais (12.5 => "12,5%"). */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return '—'
  return `${formatNumber(value, digits, 0)}%`
}

/** 21/10/2026. Datas sem hora (AAAA-MM-DD) são tratadas como data local. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return dateFmt.format(typeof value === 'string' ? new Date(value) : value)
}

/** 21/10/2026, 14:30 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return dateTimeFmt.format(typeof value === 'string' ? new Date(value) : value)
}

/**
 * Converte o texto digitado pelo usuário em número.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 12,50", "15%", "-3".
 * Retorna null para texto vazio ou inválido.
 */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (input == null) return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  let text = input.trim().replace(/R\$|%|\s/gi, '')
  if (text === '' || text === '-' || text === ',' || text === '.') return null

  const negative = text.startsWith('-')
  if (negative) text = text.slice(1)
  if (!/^[\d.,]+$/.test(text)) return null

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  let normalized: string
  if (lastComma >= 0 && lastDot >= 0) {
    // O separador que aparece por último é o decimal.
    normalized = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (lastComma >= 0) {
    if (text.indexOf(',') !== lastComma) return null
    normalized = text.replace(',', '.')
  } else if (lastDot >= 0) {
    const dots = text.split('.').length - 1
    const decimals = text.length - lastDot - 1
    // "1.234" e "1.234.567" são milhares no padrão brasileiro; "12.5" é decimal.
    normalized = dots > 1 || decimals === 3 ? text.replace(/\./g, '') : text
  } else {
    normalized = text
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return negative ? -value : value
}

/** Formata número para exibir dentro de um campo de texto (sem "R$"). */
export function toInputText(value: number | null | undefined, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals, useGrouping: false }).format(value)
}

/** Arredonda para centavos evitando erros de ponto flutuante (0,1 + 0,2). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
