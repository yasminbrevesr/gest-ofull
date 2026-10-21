# Gestão Decola Full

Plataforma web para quem quer **começar a vender no Mercado Livre**: ensina o
passo a passo, calcula o lucro real de cada venda, controla o estoque e
sincroniza o estoque com o Mercado Livre. *(nome provisório)*

- **Frontend:** React + TypeScript + Vite + Tailwind (componentes no estilo shadcn/ui)
- **Backend:** Supabase (Postgres com RLS, Auth, Storage e Edge Functions)
- A integração com o Mercado Livre roda **somente** nas Edge Functions.

## Estrutura

```
gest-ofull/
├── src/
│   ├── app.tsx                 Rotas
│   ├── main.tsx                Ponto de entrada
│   ├── index.css               Paleta oficial (tokens de cor), fontes e tema escuro
│   ├── components/ui/          Peças visuais básicas (botão, campo, cartão…)
│   ├── components/common/      Estados de carregamento/vazio/erro, campos numéricos…
│   ├── components/layout/      Menu, barra superior, proteção de rotas
│   ├── features/               Uma pasta por módulo (auth, perfil, painel…)
│   ├── lib/                    Supabase, formatação brasileira, tipos
│   └── providers/              Login (sessão + perfil) e tema claro/escuro
├── supabase/
│   ├── migrations/             SQL do banco (tabelas, RLS, funções)
│   ├── functions/              Edge Functions
│   └── tests/                  Testes do banco (RLS e regras)
├── scripts/testar-banco.sh     Roda as migrations + testes num Postgres local
└── docs/configuracao.md        Passo a passo para colocar no ar
```

## Rodar no computador

Precisa do Node.js 22 ou mais novo e de um projeto Supabase já configurado
(veja `docs/configuracao.md`).

```bash
cp .env.example .env.local   # e preencha com a URL e a publishable key do Supabase
npm ci
npm run dev                  # abre em http://localhost:5173
```

## Verificações

```bash
npm run lint        # padrões de código
npm run typecheck   # tipos TypeScript
npm test            # testes automáticos (cálculos, formatação…)
npm run build       # gera a versão de produção em dist/
./scripts/testar-banco.sh   # migrations + RLS num Postgres local (precisa do PostgreSQL instalado)
```

## Segurança

- Nenhuma chave secreta no código. O navegador usa só a *publishable key*.
- RLS ativo em todas as tabelas: cada usuário só acessa os próprios dados.
- O papel de administrador só pode ser dado pelo SQL Editor do Supabase.
