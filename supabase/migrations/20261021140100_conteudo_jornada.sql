-- =============================================================================
-- Etapa 3: conteúdo inicial da jornada e do glossário
-- Textos editáveis pelo administrador (Administração → Jornada / Glossário).
-- Regras do Mercado Livre e da Receita mudam: revise periodicamente.
-- =============================================================================

insert into public.guide_steps (slug, position, title, summary, estimated_minutes, onboarding_flag, links, content) values
(
  'criar-conta', 10,
  'Crie sua conta de vendedor no Mercado Livre e no Mercado Pago',
  'Uma conta só serve para comprar e vender. Entenda se vale começar no CPF ou já no CNPJ.',
  20, 'has_ml_account',
  '[{"label": "Mercado Livre", "url": "https://www.mercadolivre.com.br/"}, {"label": "Central de Vendedores", "url": "https://vendedores.mercadolivre.com.br/"}, {"label": "Mercado Pago", "url": "https://www.mercadopago.com.br/"}]',
  $md$
A mesma conta do Mercado Livre serve para comprar e vender. O dinheiro das vendas cai no **Mercado Pago**, que é criado junto, com o mesmo login.

## Pessoa física (CPF) ou jurídica (CNPJ)?

| | Conta no CPF | Conta no CNPJ |
| --- | --- | --- |
| Para quem | Quem está testando, vendendo pouco ou desapegando | Quem quer vender com frequência |
| Nota fiscal | Não emite | Emite (exigida em várias situações, como no Full) |
| Impostos | Pode ter que declarar no Imposto de Renda | Paga pelo regime da empresa (ex.: DAS do MEI) |
| Credibilidade | Menor para compradores empresas | Maior |

> Dica: dá para começar no CPF para aprender e depois abrir um MEI. Como a reputação fica ligada à conta, pense nisso cedo — veja a próxima etapa.

## Passo a passo

1. Acesse o Mercado Livre e clique em **Crie a sua conta**.
2. Escolha conta pessoal (CPF) ou empresa (CNPJ) e preencha seus dados **reais** — nome e documento precisam bater com os do Mercado Pago.
3. Confirme o e-mail e o celular.
4. Ative a **verificação em duas etapas** nas configurações de segurança.
5. Abra o Mercado Pago com o mesmo login e complete o cadastro (documento com foto e selfie, se pedirem).
6. Cadastre o **endereço de onde os produtos vão sair** — ele é usado no cálculo do frete.
$md$
),
(
  'formalizacao', 20,
  'Formalização: quando vale abrir um MEI',
  'O MEI é o jeito mais simples e barato de ter CNPJ. Veja limites, custo e quando você precisa emitir nota fiscal.',
  25, 'has_cnpj',
  '[{"label": "Portal do Empreendedor (gov.br)", "url": "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor"}]',
  $md$
O **MEI (Microempreendedor Individual)** dá um CNPJ para quem fatura pouco, com imposto fixo por mês e quase nenhuma burocracia.

## Vale a pena quando…

- Você quer vender com frequência (não só desapegar);
- Quer usar o **Full** ou vender para empresas (que pedem nota fiscal);
- Quer contribuir para o INSS (aposentadoria, auxílio-doença, salário-maternidade).

## Regras principais (confira sempre no gov.br)

- **Faturamento máximo de R$ 81 mil por ano** (cerca de R$ 6.750 por mês). Há propostas no Congresso para aumentar esse limite — acompanhe.
- Pode ter **1 funcionário** e **não pode ser sócio** de outra empresa.
- Paga um valor **fixo por mês**, o **DAS**, mesmo sem vender. Atrasar gera multa.
- Entrega uma declaração anual simples (DASN-SIMEI) até 31 de maio.
- A atividade precisa estar na lista permitida para MEI (comércio varejista da maioria dos produtos está).

> Passou do limite? É preciso mudar para Microempresa (ME), geralmente no Simples Nacional. Converse com um contador antes.

## Nota fiscal

- O MEI **não é obrigado** a emitir nota para consumidor pessoa física, mas **é obrigado** quando vende para empresas.
- No Mercado Livre, a nota fiscal é exigida em algumas situações, como para **enviar produtos ao Full**.
- Para emitir nota de produto (NF-e) geralmente é preciso **certificado digital** — veja a próxima etapa. Alguns estados oferecem alternativas para MEI; consulte a Secretaria da Fazenda (SEFAZ) do seu estado.

## Passo a passo para abrir

1. Tenha uma conta **gov.br** nível prata ou ouro.
2. No Portal do Empreendedor, clique em **Quero ser MEI → Formalize-se**.
3. Escolha a atividade principal (ex.: comércio varejista do tipo de produto que você vende).
4. Pronto: o CNPJ sai na hora, de graça. **Desconfie de sites que cobram para abrir MEI.**
5. Atualize sua conta do Mercado Livre e do Mercado Pago com o CNPJ (ou crie uma conta de empresa).
6. Atualize o seu perfil aqui no app (regime MEI) para a calculadora usar o imposto certo.
$md$
),
(
  'certificado-digital', 30,
  'Certificado digital: o que é e quando você precisa',
  'É a "assinatura eletrônica" da empresa. Você vai precisar dele para emitir nota fiscal de produto.',
  15, null,
  '[{"label": "ITI — Certificação digital (gov.br)", "url": "https://www.gov.br/iti/pt-br"}]',
  $md$
O **certificado digital** é um arquivo ou dispositivo que comprova a identidade da sua empresa na internet. Com ele você assina e emite documentos com validade jurídica, como a **nota fiscal eletrônica (NF-e)**.

## Quando é necessário

- Para **emitir NF-e** (nota de produto) na maioria dos sistemas emissores;
- Para acessar alguns serviços da Receita e da SEFAZ.

Para vender no CPF ou como MEI que ainda não emite nota, você pode deixar para depois.

## Tipos

| | A1 | A3 |
| --- | --- | --- |
| Formato | Arquivo instalado no computador | Token USB ou cartão (precisa de leitora) |
| Validade | 1 ano | 1 a 3 anos |
| Uso em sistemas online | Mais fácil (pode ser enviado ao emissor de notas) | Precisa estar plugado no computador |
| Custo médio | R$ 150 a R$ 250 por ano | R$ 200 a R$ 450 + token/leitora |

Valores aproximados, variam por certificadora e promoção.

> Para quem está começando e vai usar um emissor de notas online, o **e-CNPJ A1** costuma ser o mais prático.

## Onde comprar

Em **autoridades certificadoras** credenciadas na ICP-Brasil (lista no site do ITI). A emissão exige validação da identidade — por vídeo ou presencial.

## Cuidados

- Guarde o arquivo e a senha em local seguro: quem tem os dois assina pela sua empresa.
- Anote a data de vencimento e renove antes, para não parar de emitir notas.
$md$
),
(
  'programa-decola', 40,
  'Programa Decola: um empurrão para quem está começando',
  'Programa do Mercado Livre para contas novas: reputação protegida no início e acesso a recursos de divulgação, mediante depósito de garantia.',
  15, null,
  '[{"label": "Central de Vendedores (procure por Decola)", "url": "https://vendedores.mercadolivre.com.br/"}]',
  $md$
> **Atenção:** as condições do Decola mudam com frequência. Antes de aderir, leia as regras atuais na página oficial do programa, dentro da sua conta do Mercado Livre.

## O que é

Programa do Mercado Livre para quem está **começando a vender**. A ideia é evitar que os primeiros deslizes derrubem sua reputação antes de você pegar o jeito.

## Benefícios mais comuns

- **Reputação inicial protegida**: sua conta já aparece com uma cor de reputação boa desde o início, e problemas nas primeiras vendas pesam menos;
- Acesso a recursos de divulgação, como **Mercado Livre Ads** (anúncios patrocinados) e **Clips** (vídeos curtos dos produtos).

## Requisitos (em geral)

- Conta nova, com **poucas vendas (de 0 a 9)** e reputação ainda não ativada;
- Pelo menos um anúncio ativo de produto **novo**;
- **Depósito de garantia de R$ 250 no Mercado Pago**, que fica reservado durante o programa.

## Como recuperar o depósito

- Ao final do programa, o valor é devolvido para sua conta do Mercado Pago;
- Vendas com problema por sua responsabilidade (**reclamações, cancelamentos ou atrasos no envio**) podem gerar **descontos** no valor devolvido — por isso, cumpra prazos e descreva bem os produtos;
- Depois do encerramento, o Mercado Livre pode levar alguns dias para analisar e liberar o dinheiro.

## Vale a pena?

Para quem vai vender com frequência e consegue cumprir os prazos de envio, geralmente sim: a reputação é o que mais pesa nas vendas no começo. Se você ainda não tem estoque nem rotina de envio, organize isso primeiro.
$md$
),
(
  'reputacao', 50,
  'Reputação e termômetro: o que faz você vender mais (ou menos)',
  'A cor da sua reputação aparece para todos os compradores. Entenda o que a faz subir e o que derruba.',
  10, null,
  '[{"label": "Central de Ajuda do Mercado Livre", "url": "https://www.mercadolivre.com.br/ajuda"}]',
  $md$
A **reputação** é a nota do vendedor, mostrada como um **termômetro de cores**: vermelho, laranja, amarelo, verde-claro e verde. Quanto mais verde, mais confiança o comprador tem — e mais visibilidade seus anúncios ganham.

## O que conta

O Mercado Livre olha as suas vendas de um período recente (normalmente os últimos 60 dias; com poucas vendas, um período maior):

1. **Reclamações** — compradores que abriram reclamação;
2. **Cancelamentos por sua causa** — ex.: vendeu sem ter estoque;
3. **Atrasos no envio** — despachar depois do prazo combinado;
4. **Mediações** — reclamações em que o Mercado Livre precisou intervir.

Porcentagens pequenas já fazem diferença: poucas vendas com problema derrubam a cor de quem está começando.

## O que derruba (e como evitar)

| Problema | Como evitar |
| --- | --- |
| Vender sem estoque | Mantenha o estoque atualizado (use o controle de estoque deste app e a sincronização) |
| Atrasar o envio | Ajuste o prazo de preparação do anúncio ao que você consegue cumprir |
| Produto diferente do anúncio | Fotos reais, descrição completa e ficha técnica preenchida |
| Demora para responder | Responda perguntas e mensagens no mesmo dia |

## MercadoLíder

Quem vende bastante com reputação verde vira **MercadoLíder** (Líder, Gold e Platinum), com selo e benefícios. É consequência de constância, não um objetivo para o primeiro mês.
$md$
),
(
  'primeiro-anuncio', 60,
  'Criando o primeiro anúncio',
  'Título, fotos, ficha técnica, descrição e variações: o que faz o seu anúncio ser encontrado e vender.',
  40, null,
  '[{"label": "Central de Vendedores", "url": "https://vendedores.mercadolivre.com.br/"}]',
  $md$
## Título

- Siga a fórmula: **produto + marca + modelo + característica principal** (ex.: "Garrafa Térmica Inox 500ml Stanley Azul").
- Use as **palavras que o comprador digita** na busca. Pesquise no próprio Mercado Livre como os concorrentes escrevem.
- O título tem **limite de caracteres** (em geral, 60): use cada palavra com cuidado.
- **Não use**: "promoção", "frete grátis", "envio imediato", símbolos ou tudo em maiúsculas — além de não ajudar, pode ser proibido.

## Fotos

- **Foto principal com fundo branco**, só o produto, sem textos, logos ou marcas d'água.
- Use **várias fotos** (de preferência 6 ou mais): ângulos diferentes, detalhes, medidas e o produto em uso.
- Boa resolução: **1200 × 1200 pixels ou mais** ativa o zoom.
- Fotos **reais** evitam devoluções por "produto diferente do anunciado".

## Ficha técnica

Preencha **todos** os campos possíveis (marca, modelo, material, medidas…). Eles são usados nos filtros da busca: campo vazio = anúncio que não aparece no filtro.

## Descrição

- Texto simples e organizado: o que é, para que serve, medidas, o que vem na caixa, garantia.
- Responda nela as dúvidas mais comuns.
- **Não coloque** telefone, e-mail, redes sociais ou links externos — é proibido.

## Variações

Vende o mesmo produto em cores ou tamanhos diferentes? Crie **um anúncio com variações**, cada uma com seu estoque e seu SKU. Junta as vendas num só anúncio e ajuda no ranqueamento.

> Use o mesmo **SKU** aqui do controle de estoque: é assim que o app liga o anúncio ao produto.

## Clássico ou Premium?

- **Clássico**: comissão menor; o comprador parcela com juros.
- **Premium**: comissão maior; o comprador parcela **sem juros** e o anúncio ganha mais exposição.

Use a **comparação Clássico x Premium** da calculadora antes de decidir.

## Catálogo

Alguns produtos têm uma **página de catálogo** em que vários vendedores competem pelo mesmo produto. Quem oferece a melhor combinação de preço, frete e reputação "ganha" o botão de compra. Vale a pena para produtos de marca, com código de barras; para produtos próprios ou artesanais, o anúncio comum é o caminho.
$md$
),
(
  'logistica', 70,
  'Logística: como seus produtos chegam ao comprador',
  'Envio próprio, Coleta, Agência, Flex e Full: prós e contras de cada um para quem está começando.',
  20, null,
  '[{"label": "Central de Vendedores", "url": "https://vendedores.mercadolivre.com.br/"}]',
  $md$
O **Mercado Envios** é a logística do Mercado Livre: você recebe a etiqueta pronta e o frete é calculado automaticamente. Ele tem várias modalidades.

| Modalidade | Como funciona | Prós | Contras |
| --- | --- | --- | --- |
| **Agência** | Você leva os pacotes a um ponto de entrega | Simples, ótimo para começar | Precisa ir até a agência todo dia que vender |
| **Coleta** | O Mercado Livre busca os pacotes no seu endereço | Não precisa sair de casa | Liberado conforme volume e região |
| **Flex** | Você (ou um motoboy) entrega no mesmo dia, na sua cidade | Entrega rápida, mais vendas locais | Você organiza a entrega |
| **Full** | Você envia o estoque para o centro de distribuição do Mercado Livre, que guarda, embala e entrega | Selo Full, entregas rápidas, mais exposição | Custo de armazenamento, exige nota fiscal e controle de estoque |
| **Envio próprio** | Você combina e paga o frete por fora (Correios, transportadora) | Flexível para produtos fora do padrão | Menos visibilidade; nem todas as categorias permitem |

## Para quem está começando

1. Comece com **Agência** (ou **Coleta**, se disponível).
2. Quando tiver rotina e vendas constantes, teste o **Flex** se sua cidade tiver cobertura.
3. Considere o **Full** quando tiver produtos que giram bem e organização de estoque — e calcule o custo de armazenamento na calculadora (campo "outros custos").

## Frete e custos

- Produtos **a partir de R$ 79** têm frete grátis para o comprador; parte do frete é paga por você, e o valor depende de peso, preço e reputação.
- **Abaixo de R$ 79**, o custo muda conforme a modalidade (custo fixo por unidade no Flex e no envio próprio; custo de envio por peso e preço no Full, Coleta e Agência).
- **Embale bem** e meça certo: peso e medidas errados geram cobranças extras.

> Na calculadora deste app, informe o custo de envio que aparece no seu anúncio para ver o lucro real.
$md$
),
(
  'precificacao', 80,
  'Precificação: calcule antes de publicar',
  'O preço precisa cobrir comissão, frete, impostos, embalagem e ainda deixar lucro. Use a calculadora antes de cada anúncio.',
  15, null,
  '[{"label": "Abrir a calculadora de lucro", "url": "/calculadora"}]',
  $md$
O erro mais comum de quem começa é olhar só "preço de venda menos preço de custo". No Mercado Livre, **uma parte grande do preço vai embora em tarifas**.

## O que sai de cada venda

1. **Comissão** (tarifa de venda): uma % do preço, conforme categoria e tipo de anúncio;
2. **Custo fixo** por unidade, em produtos abaixo de R$ 79 em algumas modalidades de envio;
3. **Frete** pago por você;
4. **Imposto** (para MEI, o DAS é fixo por mês; nas outras empresas, uma % da venda);
5. **Custo do produto** e **embalagem**;
6. **Anúncios (Ads)**, se você usar.

## Como usar a calculadora

1. Abra a **Calculadora de lucro**.
2. Preencha preço, custo, categoria, forma de envio e o frete que aparece no anúncio.
3. Veja o **lucro líquido**, a **margem** e o **ROI**. Verde é saudável; amarelo é apertado; vermelho é prejuízo.
4. Compare **Clássico x Premium**.
5. Não sabe o preço? Use **"Qual preço cobrar?"**: diga a margem que quer e a calculadora sugere o preço.
6. **Salve a simulação** e vincule ao produto do estoque.

> Regra prática: margem abaixo de 15% deixa pouco espaço para imprevistos (devoluções, promoções, aumento de tarifa).
$md$
),
(
  'pos-venda', 90,
  'Pós-venda: perguntas, mensagens e devoluções',
  'Responder rápido, enviar no prazo e resolver problemas com calma protege sua reputação e traz novas vendas.',
  15, null,
  '[{"label": "Central de Ajuda do Mercado Livre", "url": "https://www.mercadolivre.com.br/ajuda"}]',
  $md$
## Perguntas antes da compra

- Responda **o quanto antes** (de preferência em poucas horas): quem pergunta está decidindo a compra.
- Seja cordial e objetivo. Se a dúvida se repete, coloque a resposta na descrição.
- Não passe telefone, e-mail ou links: é proibido.

## Depois da venda

1. Confira o pedido e separe o produto **no mesmo dia**.
2. Imprima a etiqueta, embale bem e **despache dentro do prazo** (ele aparece na venda).
3. Use as **mensagens da venda** só para assuntos do pedido — elas ficam registradas.

## Cancelamentos

Evite ao máximo: cancelamento por sua causa (ex.: falta de estoque) **derruba a reputação**. Por isso mantenha o estoque sempre atualizado.

## Devoluções e reclamações

- Pelo **Código de Defesa do Consumidor**, compras pela internet podem ser desistidas em até **7 dias** após o recebimento. O Mercado Livre pode oferecer prazos de devolução maiores — confira as regras atuais.
- Quando chegar uma reclamação, responda rápido, com educação, e proponha uma solução (troca, devolução, reembolso).
- Se não houver acordo, o Mercado Livre faz a **mediação**. Guarde fotos do produto e da embalagem antes do envio: ajudam na sua defesa.
- Produto devolvido em bom estado? Dê **entrada no estoque** de novo.

## Avaliações

Compradores satisfeitos avaliam bem e voltam. Um bilhete de agradecimento na embalagem é barato e faz diferença.
$md$
);

insert into public.glossary_terms (slug, term, short_definition) values
  ('anuncio-classico', 'Anúncio Clássico', 'Tipo de anúncio com comissão menor. O comprador pode parcelar, mas com juros.'),
  ('anuncio-premium', 'Anúncio Premium', 'Tipo de anúncio com comissão maior. O comprador parcela sem juros e o anúncio ganha mais exposição.'),
  ('catalogo', 'Catálogo', 'Página única de um produto em que vários vendedores competem. Quem oferece a melhor combinação de preço, frete e reputação fica com o botão de compra.'),
  ('comissao', 'Comissão (tarifa de venda)', 'Porcentagem do preço que o Mercado Livre cobra em cada venda. Depende da categoria e do tipo de anúncio.'),
  ('custo-fixo', 'Custo fixo', 'Valor cobrado por unidade vendida em produtos abaixo de R$ 79 em algumas formas de envio (Flex e envio próprio).'),
  ('custo-de-envio', 'Custo de envio', 'Parte do frete paga pelo vendedor. Depende do peso, das medidas, do preço do produto e da reputação.'),
  ('mercado-envios', 'Mercado Envios', 'Logística do Mercado Livre: etiqueta pronta, frete calculado automaticamente e rastreio para o comprador.'),
  ('full', 'Full', 'Modalidade em que o Mercado Livre guarda seu estoque no centro de distribuição dele e cuida da embalagem e da entrega. O estoque do Full é controlado pelo Mercado Livre.'),
  ('flex', 'Flex', 'Modalidade em que você mesmo (ou um entregador) leva o pedido ao comprador no mesmo dia, na sua cidade.'),
  ('coleta', 'Coleta', 'Modalidade em que o Mercado Livre busca os pacotes no seu endereço.'),
  ('agencia', 'Agência', 'Modalidade em que você leva os pacotes até um ponto de entrega do Mercado Livre.'),
  ('envio-proprio', 'Envio próprio', 'Você combina e paga o frete por fora (Correios, transportadora), sem a etiqueta do Mercado Envios.'),
  ('reputacao', 'Reputação', 'Nota do vendedor, mostrada como um termômetro de cores. Cai com reclamações, cancelamentos por sua causa e atrasos no envio.'),
  ('mercadolider', 'MercadoLíder', 'Selo para vendedores com muitas vendas e reputação verde. Tem os níveis Líder, Gold e Platinum.'),
  ('decola', 'Programa Decola', 'Programa do Mercado Livre para contas novas, com reputação inicial protegida e acesso a recursos de divulgação, mediante depósito de garantia.'),
  ('mercado-livre-ads', 'Mercado Livre Ads', 'Anúncios patrocinados: você paga para seus produtos aparecerem em destaque na busca.'),
  ('clips', 'Clips', 'Vídeos curtos mostrando os produtos, exibidos para os compradores dentro do Mercado Livre.'),
  ('sku', 'SKU', 'Código interno que você cria para identificar cada produto ou variação (ex.: CAMISETA-AZUL-M). É ele que liga o anúncio do Mercado Livre ao seu estoque.'),
  ('ficha-tecnica', 'Ficha técnica', 'Campos de características do anúncio (marca, modelo, material, medidas…). São usados nos filtros da busca.'),
  ('variacao', 'Variação', 'Versões do mesmo produto num só anúncio (cores, tamanhos), cada uma com seu estoque e SKU.'),
  ('mei', 'MEI', 'Microempreendedor Individual: CNPJ para quem fatura até o limite anual, com imposto fixo mensal (DAS).'),
  ('das', 'DAS', 'Guia de pagamento mensal do MEI e do Simples Nacional. No MEI, o valor é fixo e inclui INSS e impostos.'),
  ('simples-nacional', 'Simples Nacional', 'Regime de impostos para pequenas empresas, com uma alíquota única sobre o faturamento que aumenta conforme a empresa cresce.'),
  ('nf-e', 'NF-e', 'Nota fiscal eletrônica de produto. Exigida em várias situações, como vendas para empresas e envio de estoque ao Full.'),
  ('certificado-digital', 'Certificado digital', 'Identidade eletrônica da empresa, usada para assinar e emitir notas fiscais. Tipos A1 (arquivo) e A3 (token ou cartão).'),
  ('margem', 'Margem', 'Quanto sobra de lucro para cada R$ 100 vendidos. Margem de 15% = R$ 15 de lucro a cada R$ 100.'),
  ('roi', 'ROI', 'Retorno sobre o investimento: quanto o lucro representa sobre o que você pagou no produto.'),
  ('estoque-minimo', 'Estoque mínimo', 'Quantidade em que você quer ser avisado para repor o produto antes que acabe.'),
  ('mediacao', 'Mediação', 'Quando comprador e vendedor não se entendem numa reclamação e o Mercado Livre intervém para decidir.');
