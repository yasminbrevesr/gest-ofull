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

1. Siga o guia do Supabase "Login with Google" (é preciso criar um *OAuth client*
   no Google Cloud) e ative o provedor em **Authentication → Sign In / Providers → Google**.
2. No app, defina a variável `VITE_ENABLE_GOOGLE_LOGIN=true`. Sem ela, o botão
   "Continuar com Google" não aparece.

## 4. Pegar as chaves públicas do projeto

Botão **Connect** no topo do projeto (ou **Project Settings → API Keys**):

- **Project URL**, ex.: `https://abcd1234.supabase.co`
- **Publishable key**, começa com `sb_publishable_`

Elas vão no app (arquivo `.env.local` no computador, ou nas variáveis da
hospedagem). **Nunca** use a *Secret key* (`sb_secret_...`) no app.

## 5. Publicar o app (Vercel)

1. Acesse <https://vercel.com>, entre com o GitHub e clique em **Add New → Project**.
2. Escolha o repositório `gest-ofull`. O Vercel detecta o Vite sozinho.
3. Em **Environment Variables**, adicione:

   | Name                            | Value |
   | ------------------------------- | ----- |
   | `VITE_SUPABASE_URL`             | Project URL do passo 4 |
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

## 9. Antes de abrir para o público

- Preencha os campos entre colchetes nos **Termos de Uso** e na **Política de
  Privacidade** (`src/features/legal/texts.ts`) e revise com assessoria jurídica.
