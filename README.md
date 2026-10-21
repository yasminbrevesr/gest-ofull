# Gestão Decola Full

Plataforma web (SaaS) para quem quer **começar a vender no Mercado Livre**:
ensina o passo a passo, calcula o lucro real de cada venda, controla o estoque
e sincroniza o estoque com o Mercado Livre. _(nome provisório)_

- **Frontend:** React + TypeScript + Vite + Tailwind (componentes no estilo shadcn/ui), mobile first
- **Backend:** Supabase (Postgres com RLS, Auth, Storage, Edge Functions, pg_cron)
- A integração com o Mercado Livre roda **somente** nas Edge Functions.

## Módulos

| Módulo         | O que faz                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login e perfil | Cadastro com aceite de Termos/Privacidade (LGPD), recuperação de senha, Google opcional, cadastro inicial com 3 perguntas, tema escuro (padrão) ou claro salvo por usuário                                               |
| Painel         | Progresso da jornada, próxima etapa, atalhos, estoque baixo e resumo do Mercado Livre                                                                                                                                    |
| Como começar   | 9 etapas com checklist (conteúdo no banco, editável pelo admin) e glossário                                                                                                                                              |
| Calculadora    | Lucro, margem e ROI com tarifas do banco (com vigência), Clássico x Premium, modo reverso (preço para uma margem), promoção (preço cheio para receber/lucrar um valor com X% de desconto) e simulações salvas            |
| Estoque        | Produtos, variações, foto, movimentações (o saldo só muda por elas), alerta de estoque baixo, importação/exportação CSV                                                                                                  |
| Mercado Livre  | Conexão OAuth (PKCE + state), importação de anúncios, vínculo por SKU, vendas por webhook com baixa idempotente, envio de estoque manual ou automático, conferência de hora em hora, fila com reprocessamento e registro |
| Administração  | Jornada, glossário, tarifas (com vigência e data de conferência) e usuários (sem tokens)                                                                                                                                 |

## Estrutura

```
gest-ofull/
├── src/
│   ├── app.tsx                 Rotas
│   ├── index.css               Paleta oficial (tokens), fontes e tema escuro
│   ├── components/ui/          Peças visuais básicas (botão, campo, cartão…)
│   ├── components/common/      Estados de carregamento/vazio/erro, campos em R$…
│   ├── components/layout/      Menu, barra superior, proteção de rotas
│   ├── features/               Um módulo por pasta (auth, calculator, stock, mercadolivre, admin…)
│   ├── lib/                    Supabase, formatação brasileira, tipos
│   └── providers/              Sessão + perfil e tema claro/escuro
├── supabase/
│   ├── migrations/             SQL do banco, uma migration por etapa
│   ├── functions/              Edge Functions (Deno) + _shared (código comum e testes)
│   ├── tests/                  Testes do banco (RLS, regras de estoque, fila…)
│   └── config.toml             Configuração das funções
├── scripts/
│   ├── testar-banco.sh         Migrations + testes num Postgres local temporário
│   └── testar-funcoes.sh       Tipos e testes das Edge Functions (Deno)
└── docs/configuracao.md        Passo a passo para colocar no ar
```

### Edge Functions

| Função               | Quem chama              | O que faz                                                    |
| -------------------- | ----------------------- | ------------------------------------------------------------ |
| `ml-oauth-start`     | app                     | Gera o link de autorização (state + PKCE)                    |
| `ml-oauth-exchange`  | app                     | Troca o código por tokens (criptografados) e salva a conexão |
| `ml-disconnect`      | app                     | Revoga e apaga os tokens                                     |
| `ml-import-listings` | app                     | Importa anúncios (paginado) e sugere vínculos pelo SKU       |
| `ml-push-stock`      | app                     | "Enviar estoque agora"                                       |
| `ml-webhook`         | Mercado Livre           | Recebe notificações (orders_v2, items) e enfileira           |
| `ml-process-events`  | agendador (1 min) / app | Processa a fila: vendas, anúncios, envios                    |
| `ml-reconcile`       | agendador (1 h) / app   | Confere estoque do sistema x Mercado Livre                   |
| `ml-refresh-tokens`  | agendador (30 min)      | Renova os tokens antes de vencer                             |

## Visual

Tema escuro com gradiente e verde forte de destaque (ciano de apoio), títulos em Plus Jakarta Sans e textos em Inter. As cores ficam só em tokens no topo de `src/index.css` (`:root` = tema claro, `.dark` = tema escuro): para trocar a cor de destaque, altere `--primary`, `--primary-hover` e `--primary-text` nos dois temas. O menu lateral e o painel de apresentação do login são sempre escuros.

## Rodar no computador

Precisa do Node.js 22+ e de um projeto Supabase configurado (veja `docs/configuracao.md`).

```bash
cp .env.example .env.local   # preencha com a URL e a publishable key do Supabase
npm ci
npm run dev                  # http://localhost:5173
```

## Verificações

```bash
npm run lint && npm run typecheck && npm run format:check
npm test                     # cálculos, CSV, jornada, estoque (Vitest)
npm run build                # versão de produção em dist/
./scripts/testar-banco.sh    # migrations + RLS (precisa do PostgreSQL instalado)
./scripts/testar-funcoes.sh  # Edge Functions (precisa do Deno, ou usa npx deno)
```

## Segurança

- Nenhuma chave secreta no código: o navegador usa só a _publishable key_; segredos ficam nas Edge Functions.
- RLS em todas as tabelas (testado): cada usuário só acessa os próprios dados; visitante sem login não acessa nada.
- Tokens do Mercado Livre criptografados (AES-GCM) numa tabela sem acesso pelo app.
- O saldo de estoque só muda por movimentação registrada (o banco bloqueia edição direta).
- Papel de administrador só pelo SQL Editor do Supabase.
