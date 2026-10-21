import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate, formatPercent, parseDecimal, roundMoney, toInputText } from './format'

describe('parseDecimal', () => {
  it.each([
    ['12,50', 12.5],
    ['1.234,56', 1234.56],
    ['1234.56', 1234.56],
    ['R$ 12,50', 12.5],
    ['15%', 15],
    ['1.234', 1234],
    ['1.234.567', 1234567],
    ['12.5', 12.5],
    ['0.5', 0.5],
    ['-3', -3],
    ['1,234.56', 1234.56],
    ['  7  ', 7],
  ])('%s => %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  })

  it.each(['', ' ', 'abc', '12,5,0', '-', ',', '1a'])('"%s" é inválido', (input) => {
    expect(parseDecimal(input)).toBeNull()
  })
})

describe('formatação brasileira', () => {
  it('moeda', () => {
    expect(formatCurrency(1234.5)).toBe('R$ 1.234,50')
    expect(formatCurrency(-10)).toBe('-R$ 10,00')
    expect(formatCurrency(null)).toBe('—')
  })

  it('percentual', () => {
    expect(formatPercent(12.345)).toBe('12,3%')
    expect(formatPercent(Infinity)).toBe('—')
  })

  it('data sem hora não muda de dia por fuso', () => {
    expect(formatDate('2026-03-02')).toBe('02/03/2026')
  })

  it('texto de campo', () => {
    expect(toInputText(1234.5)).toBe('1234,5')
    expect(toInputText(null)).toBe('')
  })

  it('arredonda centavos', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(roundMoney(1.005)).toBe(1.01)
  })
})
