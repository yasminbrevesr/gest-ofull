# Passo a passo de configuração

Guia para colocar o Gestão Decola Full no ar. Faça na ordem.

> Guarde senhas e chaves num cofre de senhas (Bitwarden, 1Password ou o do
> navegador). Nunca mande chaves secretas por e-mail ou chat.

---

## 1. Criar o projeto no Supabase

1. Acesse <https://supabase.com> e crie a conta (use o e-mail da empresa).
2. **New project**:
   - **Name:** `gestao-decola-full`
   - **Database Password:** clique em **Generate a password** e guarde no cofre.
   - **Region:** `South America (São Paulo)`.
3. Clique em **Create new project** e aguarde uns 2 minutos.

## 2. Rodar as migrations (criar as tabelas)

Os arquivos ficam em `supabase/migrations/`. Rode **todos, na ordem do nome**
(o número no começo é a data), **uma vez cada**.

1. No GitHub, abra o arquivo, clique em **Copy raw file**.
2. No Supabase: menu lateral → **SQL Editor** → **New query** → cole → **Run**.
   - Esperado: `Success. No rows returned`.
   - Se aparecer aviso de operação "destrutiva", pode confirmar (o aviso aparece
     por causa de trechos como `on delete cascade`).
   - Se der erro, **não rode de novo**: copie a mensagem e envie para o
     desenvolvedor.

> Alternativa para quem usa o terminal: `npx supabase link` e
> `npx supabase db push` aplicam todas as migrations pendentes.

## 3. Configurar o login (Authentication)

1. **Authentication → Sign In / Providers → Email**:
   - **Confirm email**: ligado (recomendado).
   - **Minimum password length**: `8`.
2. **Authentication → URL Configuration**:
   - **Site URL**: o endereço do app publicado (ex.: `https://gestao-decola-full.vercel.app`).
   - **Redirect URLs**: adicione o mesmo endereço com `/**` no final e também
     `http://localhost:5173/**` (para testes no computador).
3. (Opcional) **Authentication → Emails**: traduza os textos dos e-mails de
   confirmação e de troca de senha para português.

### Login com Google (opcional)

1. Siga o guia do Supabase "Login with Google" (é preciso criar um _OAuth client_
   no Google Cloud) e ative o provedor em **Authentication → Sign In / Providers → Google**.
2. No app, defina a variável `VITE_ENABLE_GOOGLE_LOGIN=true`. Sem ela, o botão
   "Continuar com Google" não aparece.

## 4. Pegar as chaves públicas do projeto

Botão **Connect** no topo do projeto (ou **Project Settings → API Keys**):

- **Project URL**, ex.: `https://abcd1234.supabase.co`
- **Publishable key**, começa com `sb_publishable_`

Elas vão no app (arquivo `.env.local` no computador, ou nas variáveis da
hospedagem). **Nunca** use a _Secret key_ (`sb_secret_...`) no app.

## 5. Publicar o app (Vercel)

1. Acesse <https://vercel.com>, entre com o GitHub e clique em **Add New → Project**.
2. Escolha o repositório `gest-ofull`. O Vercel detecta o Vite sozinho.
3. Em **Environment Variables**, adicione:

   | Name                            | Value                      |
   | ------------------------------- | -------------------------- |
   | `VITE_SUPABASE_URL`             | Project URL do passo 4     |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key do passo 4 |

4. Clique em **Deploy**. O arquivo `vercel.json` já cuida das rotas do app.
5. Volte ao passo 3 e coloque o endereço gerado em **Site URL**.

## 6. Conferir

1. Abra o app. Deve aparecer a tela **Que bom ver você** (login). Se aparecer o
   aviso "O app está sem a configuração do Supabase", revise as variáveis do
   passo 5 e publique de novo.
2. Clique em **Criar conta grátis**, preencha e aceite os termos. Confirme pelo
   link do e-mail.
3. Responda as 3 perguntas e os dados do negócio. Você deve cair no painel.
4. No Supabase, **Table Editor → profiles**: deve existir uma linha com seu nome
   e a data em `terms_accepted_at`.

## 7. Tornar um usuário administrador

O administrador edita os conteúdos da jornada, o glossário e as tarifas. No
**SQL Editor**, troque o e-mail e rode:

```sql
update public.profiles
set role = 'admin'
where user_id = (select id from auth.users where email = 'admin@suaempresa.com.br');
```

Saia e entre de novo no app para o menu **Administração** aparecer.

## 8. Conferir as tarifas da calculadora

A calculadora usa as tabelas `categories` (categorias e comissões) e
`fee_rules` (comissões e custo fixo por faixa de preço, com vigência). Os
valores que vêm na migration são **referências aproximadas**: confira na página
oficial de custos do Mercado Livre antes de abrir para o público.

1. **Table Editor → fee_rules**: confira os percentuais de comissão (Clássico e
   Premium) de cada categoria e as faixas de custo fixo.
   - Tarifa nova: em vez de editar a antiga, preencha `valid_to` na antiga
     (último dia) e crie outra linha com o novo valor e `valid_from` (primeiro dia).
     Assim o histórico fica guardado.
2. **Table Editor → app_settings**: preencha
   - `fees_reviewed_on` com a data da conferência (aparece na calculadora como
     "Valores de referência, atualizados em DD/MM/AAAA");
   - `fees_source_url` com o link da página oficial de tarifas;
   - `margin_healthy_pct`: margem a partir da qual a venda fica "saudável" (padrão 15%).

> Depois que a área administrativa estiver pronta, isso também pode ser feito
> pelo próprio app, em **Administração → Tarifas**.

## 9. Revisar o conteúdo da jornada e do glossário

As 9 etapas de "Como começar a vender" (tabela `guide_steps`) e os termos do
glossário (`glossary_terms`) vêm com um texto inicial. Regras do Mercado Livre
(Decola, tarifas, prazos) e da Receita (limite do MEI) mudam: revise os textos e
os links de cada etapa antes de abrir para o público. O conteúdo é em markdown
(`## título`, `**negrito**`, listas com `-`, tabelas e `> destaque`).

> Pela área administrativa do app (Administração → Jornada / Glossário) dá para
> editar com pré-visualização, sem mexer no banco.

## 10. Integração com o Mercado Livre

### 10.1 Criar o aplicativo no Mercado Livre

1. Entre em <https://developers.mercadolivre.com.br> com a conta do Mercado Livre
   **da empresa** (dona do app) e abra **Minhas aplicações → Criar aplicação**.
2. Preencha nome, nome curto, descrição e logo (ex.: "Gestão Decola Full").
3. **URI de redirect**: o endereço do app publicado + `/mercado-livre/conectado`,
   exatamente assim (ex.: `https://gestao-decola-full.vercel.app/mercado-livre/conectado`).
   Precisa ser `https://`.
4. Ative o **PKCE**, se a opção aparecer (recomendado).
5. **Escopos/permissões**: leitura, escrita e **acesso offline** (`offline_access`;
   sem ele não vem o token de renovação).
6. **Tópicos de notificação**: `orders_v2` (vendas) e `items` (anúncios).
7. **URL de retorno de notificações**:
   `https://<ID-DO-PROJETO>.supabase.co/functions/v1/ml-webhook`.
8. Salve e copie o **App ID** (client_id) e a **Secret Key** (client_secret).
   A Secret Key é secreta: guarde só no cofre de senhas.

### 10.2 Cadastrar os segredos das Edge Functions

No Supabase: **Edge Functions → Secrets → Add new secret**. Cadastre:

| Key                       | Value                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ML_CLIENT_ID`            | App ID do passo 10.1                                                                                                                                                                           |
| `ML_CLIENT_SECRET`        | Secret Key do passo 10.1                                                                                                                                                                       |
| `ML_REDIRECT_URI`         | a mesma URI de redirect do passo 10.1, idêntica                                                                                                                                                |
| `ML_TOKEN_ENCRYPTION_KEY` | uma senha aleatória **com 40 caracteres ou mais** (gere no cofre de senhas). Ela criptografa os tokens do Mercado Livre no banco. **Não troque depois**: se trocar, todos precisam reconectar. |
| `CRON_SECRET`             | outra senha aleatória com 40+ caracteres (usada pelos agendamentos)                                                                                                                            |

Opcional: `ML_USE_PKCE` = `false` só se o seu app do Mercado Livre não tiver PKCE
ativado (a conexão falha com "O Mercado Livre não aceitou a autorização").

### 10.3 Publicar as Edge Functions

Precisa do Node.js instalado. No terminal, dentro da pasta do projeto:

```bash
npx supabase login                                  # abre o navegador para autorizar
npx supabase link --project-ref <ID-DO-PROJETO>     # o ID está na URL do projeto
npx supabase functions deploy                        # publica todas as funções
```

O arquivo `supabase/config.toml` já desliga a checagem automática de JWT: cada
função confere o acesso no próprio código.

### 10.4 Ligar os agendamentos

No **SQL Editor**, rode uma vez (troque os valores):

```sql
select vault.create_secret('https://<ID-DO-PROJETO>.supabase.co', 'project_url');
select vault.create_secret('<o mesmo valor do CRON_SECRET do passo 10.2>', 'cron_secret');
```

Conferir: `select jobname, schedule from cron.job;` deve listar `ml-refresh-tokens`
(renova os acessos a cada 30 minutos) e os demais agendamentos.

### 10.5 Testar

1. No app, menu **Mercado Livre → Conectar minha conta do Mercado Livre**.
2. Autorize no site do Mercado Livre. Você volta para o app com a mensagem
   "Conta … conectada!" e os anúncios são importados.
3. Na aba **Anúncios**, os que têm o mesmo SKU de um produto do estoque aparecem
   como **Sugerido**: confira e clique em **Confirmar**.
4. Problemas? Veja **Edge Functions → Logs** no Supabase (os logs não mostram
   tokens) e a aba **Registro** no app.

### 10.6 Como a sincronização funciona

- **Vendas** (sempre ligadas): o Mercado Livre avisa o app (`ml-webhook`), que
  responde na hora e coloca o aviso na fila (`ml_events`). O pedido é buscado
  na API e, se estiver pago, o estoque do produto vinculado recebe uma
  movimentação "Venda" com o número do pedido. A mesma venda **nunca** baixa
  duas vezes (chave pedido + anúncio em `ml_order_items`). Pedido cancelado
  devolve as unidades. Vendas no **Full** não mexem no estoque daqui.
- **Envio de estoque** (sistema → Mercado Livre): no modo **manual** (padrão),
  só pelo botão **Enviar estoque agora**. No modo **automático**, cada
  movimentação de um produto vinculado entra na fila e é enviada em até 1
  minuto. Anúncios no Full nunca são alterados.
- **Falhas**: erros temporários (Mercado Livre fora do ar, limite de
  requisições) são tentados de novo com espera crescente (1, 2, 4… até 60
  minutos, 8 tentativas). Depois disso o evento fica com **Erro** e pode ser
  reprocessado na aba **Sincronização**.
- **Conferência** (a cada hora): compara o estoque daqui com o dos anúncios e
  lista as diferenças para você escolher qual número vale.

Agendamentos (confira em `select jobname, schedule from cron.job;`):

| Nome                                            | Quando        | O que faz                                    |
| ----------------------------------------------- | ------------- | -------------------------------------------- |
| `ml-process-events`                             | a cada minuto | processa a fila de vendas, anúncios e envios |
| `ml-refresh-tokens`                             | a cada 30 min | renova o acesso ao Mercado Livre             |
| `ml-reconcile`                                  | a cada hora   | confere estoque do sistema x Mercado Livre   |
| `ml-events-cleanup` / `ml-oauth-states-cleanup` | diariamente   | limpeza de registros antigos                 |

> Sobre o modelo de estoque do Mercado Livre: o envio usa
> `PUT /items/{id}` (com todas as variações do anúncio, para nenhuma ser
> apagada). Contas com **estoque por depósito (multiorigem)** não aceitam esse
> envio: o app detecta que a quantidade não mudou e mostra o erro no
> registro. Nesses casos, atualize o estoque pelo próprio Mercado Livre.

### 10.7 Testar a sincronização

1. Vincule um anúncio de teste a um produto do estoque.
2. Na aba **Sincronização**, clique em **Enviar estoque agora** e confira no
   Mercado Livre se a quantidade do anúncio mudou.
3. Faça uma venda de teste (ou peça para alguém comprar) e veja, em até 1
   minuto, a movimentação "Venda" no histórico do produto e a linha no
   **Registro**.
4. Se nada chegar: confira a URL de notificações do passo 10.1 e
   **Edge Functions → ml-webhook → Logs** no Supabase.

## 11. Antes de abrir para o público

- Preencha os campos entre colchetes nos **Termos de Uso** e na **Política de
  Privacidade** (`src/features/legal/texts.ts`) e revise com assessoria jurídica.
