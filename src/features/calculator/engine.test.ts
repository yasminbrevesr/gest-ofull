import { describe, expect, it } from 'vitest'
import { calculateProfit, emptyInputs, promotionPrice, suggestPrice, type CalcContext, type CalculatorInputs, type FeeRule } from './engine'

const TODAY = '2026-10-21'
let seq = 0
const rule = (r: Partial<FeeRule>): FeeRule => ({
  id: `r${++seq}`,
  rule_type: 'commission',
  category_id: null,
  listing_type: null,
  shipping_methods: null,
  price_min: null,
  price_max: null,
  percent: null,
  amount: null,
  max_percent_of_price: null,
  valid_from: '2026-03-02',
  valid_to: null,
  notes: null,
  ...r,
})

// Espelha os dados iniciais da migration.
const rules: FeeRule[] = [
  rule({ category_id: 'cat', listing_type: 'classico', percent: 12 }),
  rule({ category_id: 'cat', listing_type: 'premium', percent: 17 }),
  rule({ rule_type: 'fixed_fee', shipping_methods: ['flex', 'proprio'], price_min: 0, price_max: 19, amount: 6.25, max_percent_of_price: 50 }),
  rule({ rule_type: 'fixed_fee', shipping_methods: ['flex', 'proprio'], price_min: 19, price_max: 49, amount: 6.65 }),
  rule({ rule_type: 'fixed_fee', shipping_methods: ['flex', 'proprio'], price_min: 49, price_max: 79, amount: 7.75 }),
]
const ctx: CalcContext = { rules, healthyMargin: 15, today: TODAY }
const inputs = (over: Partial<CalculatorInputs>): CalculatorInputs => ({ ...emptyInputs(0), categoryId: 'cat', ...over })

function calc(over: Partial<CalculatorInputs>, context = ctx) {
  const outcome = calculateProfit(inputs(over), context)
  if (!outcome.ok) throw new Error(outcome.error)
  return outcome.result
}

describe('calculateProfit', () => {
  it('soma todos os custos e calcula lucro, margem e ROI', () => {
    const r = calc({ salePrice: 100, productCost: 40, shippingMethod: 'coleta', shippingCost: 20, taxRate: 4, packagingCost: 2, adsCost: 3, otherCosts: 1 })
    expect(r.commission).toBe(12)
    expect(r.fixedFee).toBe(0)
    expect(r.tax).toBe(4)
    expect(r.totalCosts).toBe(82)
    expect(r.netProfit).toBe(18)
    expect(r.marginPct).toBeCloseTo(18)
    expect(r.roiPct).toBeCloseTo(45)
    expect(r.received).toBe(68)
    expect(r.status).toBe('healthy')
  })

  it('cobra custo fixo por faixa de preço no Flex e envio próprio', () => {
    expect(calc({ salePrice: 30, productCost: 10, shippingMethod: 'flex' }).fixedFee).toBe(6.65)
    expect(calc({ salePrice: 60, shippingMethod: 'proprio' }).fixedFee).toBe(7.75)
    expect(calc({ salePrice: 30, productCost: 10, shippingMethod: 'flex' }).netProfit).toBe(9.75)
  })

  it('limita o custo fixo a metade do preço abaixo de R$ 19', () => {
    const r = calc({ salePrice: 10, productCost: 5, shippingMethod: 'proprio' })
    expect(r.fixedFeeUnit).toBe(5)
    expect(r.fixedFeeCapped).toBe(true)
    expect(r.netProfit).toBe(-1.2)
    expect(r.status).toBe('loss')
  })

  it('não cobra custo fixo a partir de R$ 79 nem no Full/Coleta/Agência', () => {
    expect(calc({ salePrice: 79, shippingMethod: 'flex' }).fixedFee).toBe(0)
    expect(calc({ salePrice: 78.99, shippingMethod: 'flex' }).fixedFee).toBe(7.75)
    for (const method of ['full', 'coleta', 'agencia'] as const) expect(calc({ salePrice: 50, shippingMethod: method }).fixedFee).toBe(0)
  })

  it('multiplica pela quantidade', () => {
    const r = calc({ salePrice: 30, productCost: 10, shippingMethod: 'flex', quantity: 3 })
    expect(r.revenue).toBe(90)
    expect(r.fixedFee).toBe(19.95)
    expect(r.netProfit).toBe(29.25)
    expect(r.netProfitUnit).toBe(9.75)
  })

  it('usa Premium e comissão digitada pelo usuário', () => {
    expect(calc({ salePrice: 100, listingType: 'premium' }).commission).toBe(17)
    const manual = calc({ salePrice: 100, commissionOverride: 10.5, categoryId: null })
    expect(manual.commission).toBe(10.5)
    expect(manual.commissionFromTable).toBe(false)
  })

  it('classifica margem apertada', () => {
    expect(calc({ salePrice: 100, productCost: 80 }).status).toBe('tight') // 8% de margem
  })

  it('respeita a vigência: regra futura ou vencida não vale, a mais nova substitui', () => {
    const extra = [
      ...rules,
      rule({ category_id: 'cat', listing_type: 'classico', percent: 99, valid_from: '2027-01-01' }),
      rule({ category_id: 'cat', listing_type: 'classico', percent: 50, valid_from: '2025-01-01', valid_to: '2025-12-31' }),
      rule({ category_id: 'cat', listing_type: 'classico', percent: 13, valid_from: '2026-09-01' }),
    ]
    expect(calc({ salePrice: 100 }, { ...ctx, rules: extra }).commissionRate).toBe(13)
  })

  it('avisa quando falta comissão ou preço', () => {
    expect(calculateProfit(inputs({ salePrice: 100, categoryId: 'sem-regra' }), ctx)).toMatchObject({ ok: false })
    expect(calculateProfit(inputs({ salePrice: null }), ctx)).toEqual({ ok: false, error: 'Informe o preço de venda.' })
    expect(calculateProfit(inputs({ salePrice: 10, quantity: 0 }), ctx)).toMatchObject({ ok: false })
  })

  it('ROI vazio quando o custo do produto é zero', () => {
    expect(calc({ salePrice: 100 }).roiPct).toBeNull()
  })
})

describe('suggestPrice (modo reverso)', () => {
  function price(over: Partial<CalculatorInputs>, margin: number) {
    const outcome = suggestPrice(inputs(over), margin, ctx)
    if (!outcome.ok) throw new Error(outcome.error)
    return outcome
  }

  it('acha o preço sem custo fixo', () => {
    const r = price({ productCost: 40, shippingCost: 20, shippingMethod: 'coleta' }, 20)
    expect(r.price).toBe(88.24)
    expect(r.result.marginPct).toBeGreaterThanOrEqual(20)
    const below = calculateProfit(inputs({ productCost: 40, shippingCost: 20, salePrice: 88.23 }), ctx)
    expect(below.ok && below.result.marginPct < 20).toBe(true)
  })

  it('considera a faixa de custo fixo certa', () => {
    const r = price({ productCost: 10, shippingMethod: 'flex' }, 20)
    expect(r.price).toBe(24.49)
    expect(r.result.fixedFee).toBe(6.65)
    const below = calculateProfit(inputs({ productCost: 10, shippingMethod: 'flex', salePrice: 24.48 }), ctx)
    expect(below.ok && below.result.marginPct < 20).toBe(true)
  })

  it('aproveita o fim do custo fixo em R$ 79', () => {
    expect(price({ productCost: 50, shippingMethod: 'flex' }, 24).price).toBe(79)
    expect(price({ productCost: 50, shippingMethod: 'flex' }, 25).price).toBe(79.37)
  })

  it('compensa o arredondamento dos centavos', () => {
    // Sem a compensação, a comissão arredondada deixava a margem em 24,99%
    // e o preço pulava para R$ 79,00.
    const r = price({ productCost: 18, packagingCost: 1.5, adsCost: 2, taxRate: 4, listingType: 'premium', commissionOverride: 19, shippingMethod: 'flex' }, 25)
    expect(r.price).toBe(56.26)
    expect(r.result.marginPct).toBeGreaterThanOrEqual(25)
  })

  it('mantém a quantidade no resultado', () => {
    const r = price({ productCost: 40, quantity: 2 }, 10)
    expect(r.result.quantity).toBe(2)
  })

  it('avisa quando a margem é impossível', () => {
    expect(suggestPrice(inputs({ productCost: 10, taxRate: 50 }), 40, ctx)).toMatchObject({ ok: false })
  })
})

describe('promotionPrice (promoção)', () => {
  function promo(over: Partial<CalculatorInputs>, kind: 'received' | 'profit' | 'promo_price', value: number, discount: number) {
    const outcome = promotionPrice(inputs(over), { kind, value }, discount, ctx)
    if (!outcome.ok) throw new Error(outcome.error)
    return outcome
  }

  it('quero receber R$ 50 com 20% de desconto', () => {
    const r = promo({ shippingMethod: 'coleta' }, 'received', 50, 20)
    expect(r.promoPrice).toBe(56.82)
    expect(r.listPrice).toBe(71.03)
    expect(r.result.received).toBeGreaterThanOrEqual(50)
    expect(r.result.received).toBeLessThan(50.02)
    expect(r.fullPriceResult.salePrice).toBe(71.03)
  })

  it('considera o custo fixo da faixa do preço com desconto', () => {
    const r = promo({ shippingMethod: 'flex' }, 'received', 30, 10)
    expect(r.promoPrice).toBe(41.65)
    expect(r.result.fixedFee).toBe(6.65)
    expect(r.result.received).toBe(30)
  })

  it('aproveita o fim do custo fixo em R$ 79', () => {
    expect(promo({ shippingMethod: 'flex' }, 'received', 62, 10).promoPrice).toBe(79)
  })

  it('alvo de lucro líquido desconta custos e imposto', () => {
    // Lucro de R$ 10 exige R$ 35,72; o preço cheio arredondado para cima (42,03)
    // com 15% de desconto dá R$ 35,73 — nunca abaixo do necessário.
    const r = promo({ productCost: 20, taxRate: 4, shippingMethod: 'coleta' }, 'profit', 10, 15)
    expect(r.listPrice).toBe(42.03)
    expect(r.promoPrice).toBe(35.73)
    expect(r.result.netProfit).toBeGreaterThanOrEqual(10)
    expect(r.result.netProfit).toBeLessThan(10.02)
  })

  it('alvo de preço final só calcula o preço cheio', () => {
    const r = promo({}, 'promo_price', 50, 30)
    expect(r.listPrice).toBe(71.43)
    expect(r.promoPrice).toBe(50)
  })

  it('o preço cheio com o desconto nunca fica abaixo do preço calculado', () => {
    for (const discount of [5, 7, 12.5, 33, 45, 60]) {
      const r = promo({ shippingMethod: 'coleta' }, 'received', 47.3, discount)
      expect(Math.round(r.listPrice * (1 - discount / 100) * 100) / 100).toBeGreaterThanOrEqual(r.promoPrice)
      expect(r.result.received).toBeGreaterThanOrEqual(47.3)
    }
  })

  it('avisa quando faltam dados ou o alvo é impossível', () => {
    expect(promotionPrice(inputs({}), { kind: 'received', value: 50 }, null, ctx)).toMatchObject({ ok: false })
    expect(promotionPrice(inputs({}), { kind: 'received', value: 50 }, 100, ctx)).toMatchObject({ ok: false })
    expect(promotionPrice(inputs({}), { kind: 'received', value: null }, 10, ctx)).toMatchObject({ ok: false })
    expect(promotionPrice(inputs({ taxRate: 90 }), { kind: 'profit', value: 10 }, 10, ctx)).toMatchObject({ ok: false })
  })
})
