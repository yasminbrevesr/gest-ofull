/**
 * Motor da calculadora de lucro. Funções puras (sem acesso ao banco), para
 * poder testar. As tarifas vêm sempre da tabela fee_rules.
 */
import { roundMoney } from '@/lib/format'

export type ListingType = 'classico' | 'premium'
export type ShippingMethod = 'full' | 'coleta' | 'agencia' | 'flex' | 'proprio'
export type MarginStatus = 'healthy' | 'tight' | 'loss'

export interface FeeRule {
  id: string
  rule_type: 'commission' | 'fixed_fee'
  category_id: string | null
  listing_type: ListingType | null
  shipping_methods: ShippingMethod[] | null
  price_min: number | null
  price_max: number | null
  percent: number | null
  amount: number | null
  max_percent_of_price: number | null
  valid_from: string
  valid_to: string | null
  notes: string | null
}

export interface CalculatorInputs {
  salePrice: number | null
  productCost: number | null
  quantity: number | null
  listingType: ListingType
  categoryId: string | null
  /** % de comissão digitado pelo usuário (substitui o da tabela). */
  commissionOverride: number | null
  shippingMethod: ShippingMethod
  /** Custo de envio pago pelo vendedor, por unidade. */
  shippingCost: number | null
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  packagingCost: number | null
  /** % de imposto sobre o preço de venda. */
  taxRate: number | null
  /** Custo de anúncios (Ads) por venda. */
  adsCost: number | null
  otherCosts: number | null
}

export interface CalcContext {
  rules: FeeRule[]
  /** Margem (%) a partir da qual a venda é saudável. */
  healthyMargin: number
  /** Data de referência AAAA-MM-DD (tarifas vigentes nesse dia). */
  today?: string
}

export interface ProfitResult {
  salePrice: number
  quantity: number
  revenue: number
  commissionRate: number
  commissionFromTable: boolean
  commission: number
  fixedFeeUnit: number
  fixedFee: number
  /** true quando o custo fixo foi limitado a uma % do preço (ex.: metade). */
  fixedFeeCapped: boolean
  shipping: number
  tax: number
  productCost: number
  packaging: number
  ads: number
  other: number
  /** Tudo o que o Mercado Livre desconta (comissão + custo fixo + envio). */
  mlDeductions: number
  /** Valor que cai na conta do Mercado Pago. */
  received: number
  totalCosts: number
  netProfit: number
  netProfitUnit: number
  marginPct: number
  /** Lucro sobre o custo do produto. null quando o custo é zero. */
  roiPct: number | null
  status: MarginStatus
}

export type CalcOutcome = { ok: true; result: ProfitResult } | { ok: false; error: string }

export const emptyInputs = (taxRate = 0): CalculatorInputs => ({
  salePrice: null,
  productCost: null,
  quantity: 1,
  listingType: 'classico',
  categoryId: null,
  commissionOverride: null,
  shippingMethod: 'coleta',
  shippingCost: null,
  weightGrams: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  packagingCost: null,
  taxRate,
  adsCost: null,
  otherCosts: null,
})

/** Data de hoje em São Paulo, no formato AAAA-MM-DD. */
export function todayInBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function isRuleActive(rule: FeeRule, today: string): boolean {
  return rule.valid_from <= today && (rule.valid_to == null || rule.valid_to >= today)
}

/** Ordena para que a regra mais recente (e mais específica) venha primeiro. */
function byPriority(a: FeeRule, b: FeeRule) {
  const specificity = (r: FeeRule) => (r.category_id ? 2 : 0) + (r.listing_type ? 1 : 0)
  if (a.valid_from !== b.valid_from) return a.valid_from < b.valid_from ? 1 : -1
  return specificity(b) - specificity(a)
}

export function findCommissionRule(rules: FeeRule[], categoryId: string | null, listingType: ListingType, today: string): FeeRule | null {
  if (!categoryId) return null
  return (
    rules
      .filter((r) => r.rule_type === 'commission' && r.category_id === categoryId && r.listing_type === listingType && isRuleActive(r, today))
      .sort(byPriority)[0] ?? null
  )
}

interface FeeQuery {
  shippingMethod: ShippingMethod
  listingType: ListingType
  categoryId: string | null
}

/** Regras de custo fixo que valem para a forma de envio/anúncio/categoria (todas as faixas de preço). */
export function applicableFixedFeeRules(rules: FeeRule[], query: FeeQuery, today: string): FeeRule[] {
  return rules
    .filter(
      (r) =>
        r.rule_type === 'fixed_fee' &&
        isRuleActive(r, today) &&
        (r.listing_type == null || r.listing_type === query.listingType) &&
        (r.category_id == null || r.category_id === query.categoryId) &&
        (r.shipping_methods == null || r.shipping_methods.includes(query.shippingMethod)),
    )
    .sort(byPriority)
}

const inRange = (rule: FeeRule, price: number) => (rule.price_min == null || price >= rule.price_min) && (rule.price_max == null || price < rule.price_max)

export function findFixedFeeRule(rules: FeeRule[], query: FeeQuery & { price: number }, today: string): FeeRule | null {
  return applicableFixedFeeRules(rules, query, today).find((r) => inRange(r, query.price)) ?? null
}

/** Valor do custo fixo por unidade, respeitando o limite em % do preço. */
export function fixedFeeValue(rule: FeeRule | null, price: number): { value: number; capped: boolean } {
  if (!rule || rule.amount == null) return { value: 0, capped: false }
  if (rule.max_percent_of_price != null) {
    const cap = (price * rule.max_percent_of_price) / 100
    if (cap < rule.amount) return { value: cap, capped: true }
  }
  return { value: rule.amount, capped: false }
}

const n = (value: number | null | undefined) => (value == null || Number.isNaN(value) ? 0 : value)

export function marginStatus(netProfit: number, marginPct: number, healthyMargin: number): MarginStatus {
  if (netProfit < 0) return 'loss'
  if (marginPct < healthyMargin) return 'tight'
  return 'healthy'
}

export function resolveCommissionRate(inputs: CalculatorInputs, ctx: CalcContext): { rate: number; fromTable: boolean } | null {
  if (inputs.commissionOverride != null) return { rate: inputs.commissionOverride, fromTable: false }
  const rule = findCommissionRule(ctx.rules, inputs.categoryId, inputs.listingType, ctx.today ?? todayInBrazil())
  return rule?.percent != null ? { rate: rule.percent, fromTable: true } : null
}

export function validateInputs(inputs: CalculatorInputs, { requirePrice = true } = {}): string | null {
  if (requirePrice && (inputs.salePrice == null || inputs.salePrice <= 0)) return 'Informe o preço de venda.'
  if (inputs.quantity == null || inputs.quantity < 1 || !Number.isInteger(inputs.quantity)) return 'A quantidade precisa ser um número inteiro a partir de 1.'
  if (inputs.commissionOverride != null && (inputs.commissionOverride < 0 || inputs.commissionOverride >= 100))
    return 'A comissão precisa estar entre 0% e 99%.'
  if (inputs.taxRate != null && (inputs.taxRate < 0 || inputs.taxRate >= 100)) return 'O imposto precisa estar entre 0% e 99%.'
  const money = [inputs.productCost, inputs.shippingCost, inputs.packagingCost, inputs.adsCost, inputs.otherCosts]
  if (money.some((v) => v != null && v < 0)) return 'Os custos não podem ser negativos.'
  if (!inputs.categoryId && inputs.commissionOverride == null) return 'Escolha a categoria ou informe a comissão.'
  return null
}

export function calculateProfit(inputs: CalculatorInputs, ctx: CalcContext): CalcOutcome {
  const invalid = validateInputs(inputs)
  if (invalid) return { ok: false, error: invalid }
  const commission = resolveCommissionRate(inputs, ctx)
  if (!commission) return { ok: false, error: 'Não há comissão cadastrada para esta categoria e tipo de anúncio. Informe a comissão manualmente.' }

  const today = ctx.today ?? todayInBrazil()
  const price = inputs.salePrice!
  const qty = inputs.quantity!
  const feeRule = findFixedFeeRule(
    ctx.rules,
    { price, shippingMethod: inputs.shippingMethod, listingType: inputs.listingType, categoryId: inputs.categoryId },
    today,
  )
  const fee = fixedFeeValue(feeRule, price)

  const revenue = roundMoney(price * qty)
  const commissionValue = roundMoney(((price * commission.rate) / 100) * qty)
  const fixedFeeUnit = roundMoney(fee.value)
  const fixedFee = roundMoney(fixedFeeUnit * qty)
  const shipping = roundMoney(n(inputs.shippingCost) * qty)
  const tax = roundMoney(((price * n(inputs.taxRate)) / 100) * qty)
  const productCost = roundMoney(n(inputs.productCost) * qty)
  const packaging = roundMoney(n(inputs.packagingCost) * qty)
  const ads = roundMoney(n(inputs.adsCost) * qty)
  const other = roundMoney(n(inputs.otherCosts) * qty)

  const mlDeductions = roundMoney(commissionValue + fixedFee + shipping)
  const totalCosts = roundMoney(mlDeductions + tax + productCost + packaging + ads + other)
  const netProfit = roundMoney(revenue - totalCosts)
  const marginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0
  const roiPct = productCost > 0 ? (netProfit / productCost) * 100 : null

  return {
    ok: true,
    result: {
      salePrice: price,
      quantity: qty,
      revenue,
      commissionRate: commission.rate,
      commissionFromTable: commission.fromTable,
      commission: commissionValue,
      fixedFeeUnit,
      fixedFee,
      fixedFeeCapped: fee.capped,
      shipping,
      tax,
      productCost,
      packaging,
      ads,
      other,
      mlDeductions,
      received: roundMoney(revenue - mlDeductions),
      totalCosts,
      netProfit,
      netProfitUnit: roundMoney(netProfit / qty),
      marginPct,
      roiPct,
      status: marginStatus(netProfit, marginPct, ctx.healthyMargin),
    },
  }
}

export type PriceOutcome = { ok: true; price: number; result: ProfitResult } | { ok: false; error: string }

/**
 * Alvo linear por unidade: a·P − custoFixo(P) − b ≥ value.
 * (margem, valor recebido do Mercado Livre e lucro líquido cabem nesse formato)
 */
interface LinearTarget {
  a: number
  b: number
  value: number
}

/**
 * Menor preço (por unidade) que atinge o alvo. O custo fixo muda por faixa de
 * preço, então testamos a solução de cada faixa e os limites das faixas, e
 * conferimos tudo com calculateProfit (`meets`).
 */
function solveMinPrice(inputs: CalculatorInputs, ctx: CalcContext, { a, b, value }: LinearTarget, meets: (r: ProfitResult) => boolean): number | null {
  const today = ctx.today ?? todayInBrazil()
  const candidates = new Set<number>()
  const add = (p: number) => {
    if (!Number.isFinite(p) || p <= 0) return
    const cents = Math.ceil(p * 100 - 1e-6)
    // Alguns centavos acima também, porque o arredondamento de cada parcela
    // (comissão, imposto…) pode deixar o resultado um fio abaixo do alvo.
    for (let extra = 0; extra <= 3; extra++) candidates.add((cents + extra) / 100)
  }
  add((value + b) / a) // faixa sem custo fixo
  const feeRules = applicableFixedFeeRules(
    ctx.rules,
    { shippingMethod: inputs.shippingMethod, listingType: inputs.listingType, categoryId: inputs.categoryId },
    today,
  )
  for (const rule of feeRules) {
    if (rule.amount != null) add((value + b + rule.amount) / a)
    if (rule.max_percent_of_price != null && a - rule.max_percent_of_price / 100 > 0) add((value + b) / (a - rule.max_percent_of_price / 100))
    if (rule.price_min != null) add(rule.price_min)
    if (rule.price_max != null) add(rule.price_max)
  }
  add(0.01)

  for (const price of [...candidates].sort((x, y) => x - y)) {
    const outcome = calculateProfit({ ...inputs, salePrice: price, quantity: 1 }, ctx)
    if (outcome.ok && meets(outcome.result)) return price
  }
  return null
}

/** Custos por unidade que não dependem do preço. */
const fixedUnitCosts = (inputs: CalculatorInputs) =>
  n(inputs.productCost) + n(inputs.shippingCost) + n(inputs.packagingCost) + n(inputs.adsCost) + n(inputs.otherCosts)

const NO_COMMISSION = 'Não há comissão cadastrada para esta categoria e tipo de anúncio. Informe a comissão manualmente.'

/** Modo reverso: menor preço de venda que atinge a margem desejada (%). */
export function suggestPrice(inputs: CalculatorInputs, targetMargin: number, ctx: CalcContext): PriceOutcome {
  const invalid = validateInputs(inputs, { requirePrice: false })
  if (invalid) return { ok: false, error: invalid }
  if (targetMargin < 0 || targetMargin >= 100) return { ok: false, error: 'A margem desejada precisa estar entre 0% e 99%.' }
  const commission = resolveCommissionRate(inputs, ctx)
  if (!commission) return { ok: false, error: NO_COMMISSION }

  const a = 1 - commission.rate / 100 - n(inputs.taxRate) / 100 - targetMargin / 100
  if (a <= 0) {
    return { ok: false, error: 'Com essa comissão e esse imposto, não existe preço que alcance essa margem. Tente uma margem menor.' }
  }
  const price = solveMinPrice(inputs, ctx, { a, b: fixedUnitCosts(inputs), value: 0 }, (r) => r.marginPct >= targetMargin - 1e-9)
  if (price == null) return { ok: false, error: 'Não foi possível encontrar um preço para essa margem.' }
  const full = calculateProfit({ ...inputs, salePrice: price }, ctx)
  return full.ok ? { ok: true, price, result: full.result } : full
}

/**
 * Alvo da promoção:
 * - received: valor que cai na conta (depois de comissão, custo fixo e frete);
 * - profit: lucro líquido (depois também de impostos e custos);
 * - promo_price: o preço final que o comprador paga.
 */
export type PromoTargetKind = 'received' | 'profit' | 'promo_price'

export type PromoOutcome =
  | {
      ok: true
      /** Preço cheio do anúncio ("de"). */
      listPrice: number
      /** Preço com desconto ("por"), o que o comprador paga. */
      promoPrice: number
      discountPct: number
      /** Resultado de uma venda com desconto. */
      result: ProfitResult
      /** Resultado de uma venda pelo preço cheio, sem desconto. */
      fullPriceResult: ProfitResult
    }
  | { ok: false; error: string }

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

/**
 * Promoção: quanto colocar de preço cheio para, com `discountPct`% de
 * desconto, chegar ao alvo (por unidade).
 */
export function promotionPrice(
  inputs: CalculatorInputs,
  target: { kind: PromoTargetKind; value: number | null },
  discountPct: number | null,
  ctx: CalcContext,
): PromoOutcome {
  const unit = { ...inputs, quantity: 1 }
  const invalid = validateInputs(unit, { requirePrice: false })
  if (invalid) return { ok: false, error: invalid }
  if (discountPct == null || discountPct <= 0 || discountPct >= 100) return { ok: false, error: 'Informe o desconto da promoção (entre 1% e 99%).' }
  if (target.value == null || target.value < 0 || (target.kind !== 'profit' && target.value === 0)) {
    return { ok: false, error: 'Informe o valor que você quer alcançar.' }
  }
  const commission = resolveCommissionRate(unit, ctx)
  if (!commission) return { ok: false, error: NO_COMMISSION }
  const c = commission.rate / 100
  const value = target.value

  let promoPrice: number | null
  if (target.kind === 'promo_price') {
    promoPrice = cents(value)
  } else if (target.kind === 'received') {
    promoPrice = solveMinPrice(unit, ctx, { a: 1 - c, b: n(unit.shippingCost), value }, (r) => r.received >= value - 1e-9)
  } else {
    const a = 1 - c - n(unit.taxRate) / 100
    if (a <= 0) return { ok: false, error: 'Com essa comissão e esse imposto, não existe preço que alcance esse lucro.' }
    promoPrice = solveMinPrice(unit, ctx, { a, b: fixedUnitCosts(unit), value }, (r) => r.netProfit >= value - 1e-9)
  }
  if (promoPrice == null) return { ok: false, error: 'Não foi possível encontrar um preço para esse valor.' }

  // Preço cheio arredondado para cima: com o desconto (antes de qualquer
  // arredondamento), o comprador paga pelo menos o preço calculado.
  const factor = 1 - discountPct / 100
  let listPrice = Math.ceil((promoPrice / factor) * 100 - 1e-6) / 100
  while (listPrice * factor < promoPrice - 1e-9) listPrice = cents(listPrice + 0.01)
  const finalPrice = cents(listPrice * factor)

  const promo = calculateProfit({ ...unit, salePrice: finalPrice }, ctx)
  const full = calculateProfit({ ...unit, salePrice: listPrice }, ctx)
  if (!promo.ok) return promo
  if (!full.ok) return full
  return { ok: true, listPrice, promoPrice: finalPrice, discountPct, result: promo.result, fullPriceResult: full.result }
}
