import type { ListingType, MarginStatus, ShippingMethod } from './engine'

export const listingTypeLabels: Record<ListingType, string> = { classico: 'Clássico', premium: 'Premium' }

export const listingTypeOptions: { value: ListingType; label: string; description: string }[] = [
  { value: 'classico', label: 'Clássico', description: 'Comissão menor' },
  { value: 'premium', label: 'Premium', description: 'Parcelado sem juros, mais exposição' },
]

export const shippingOptions: { value: ShippingMethod; label: string; description: string }[] = [
  { value: 'coleta', label: 'Coleta', description: 'O Mercado Livre busca os pacotes com você' },
  { value: 'agencia', label: 'Agência', description: 'Você leva os pacotes a um ponto de entrega' },
  { value: 'full', label: 'Full', description: 'O Mercado Livre guarda e envia por você' },
  { value: 'flex', label: 'Flex', description: 'Você entrega no mesmo dia na sua cidade' },
  { value: 'proprio', label: 'Envio próprio', description: 'Correios ou transportadora por sua conta' },
]

export const shippingLabels = Object.fromEntries(shippingOptions.map((o) => [o.value, o.label])) as Record<ShippingMethod, string>

export const statusLabels: Record<MarginStatus, string> = {
  healthy: 'Margem saudável',
  tight: 'Margem apertada',
  loss: 'Prejuízo',
}

export const help = {
  commission:
    'É a porcentagem que o Mercado Livre cobra sobre o preço de cada venda. Muda conforme a categoria do produto e o tipo de anúncio (Clássico ou Premium).',
  commissionOverride:
    'Ao criar ou editar o anúncio, o Mercado Livre mostra a tarifa exata da sua categoria. Se você já sabe o número, digite aqui: ele substitui o valor de referência.',
  fixedFee:
    'Valor cobrado por unidade vendida em produtos abaixo de R$ 79 enviados por Flex ou envio próprio. Muda conforme a faixa de preço.',
  shippingCost:
    'Quanto VOCÊ paga de frete em cada venda. Onde ver: ao criar ou editar o anúncio, na parte de envio, o Mercado Livre mostra o custo do frete para você. No Full, Coleta e Agência, depende do peso e do preço do produto. No envio próprio, é o que você paga aos Correios/transportadora. Se o comprador paga o frete, deixe 0.',
  tax: 'Porcentagem de imposto sobre o valor da venda. MEI paga um valor fixo por mês (DAS): use 0%. O padrão vem do seu perfil.',
  ads: 'Quanto você gasta com anúncios patrocinados (Mercado Livre Ads), dividido pelo número de vendas. Ex.: R$ 50 de Ads para 10 vendas = R$ 5 por venda.',
  other: 'Qualquer outro gasto por unidade: etiqueta, brinde, tarifa de armazenamento do Full, taxa de cartão etc.',
  margin: 'Quanto sobra de lucro para cada R$ 100 vendidos. Ex.: margem de 15% = R$ 15 de lucro a cada R$ 100 de venda.',
  roi: 'Retorno sobre o investimento: quanto o lucro representa sobre o que você pagou no produto. ROI de 50% = cada R$ 100 investido no produto volta com R$ 50 de lucro.',
  received: 'Valor que cai na sua conta do Mercado Pago depois que o Mercado Livre desconta comissão, custo fixo e frete. Os impostos e o custo do produto ainda saem daqui.',
  full: 'No Full você envia o estoque para o centro de distribuição do Mercado Livre, que guarda, embala e entrega. As vendas costumam ser mais rápidas, mas há custo de armazenamento.',
  weight: 'O peso e as medidas da caixa influenciam o custo do frete. Ficam guardados como referência para quando a calculadora buscar o frete direto do Mercado Livre.',
}
