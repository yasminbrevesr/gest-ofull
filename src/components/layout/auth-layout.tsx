import { ArrowRight, Calculator, Map as MapIcon, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Brand, BrandMark, RvGlyph } from './brand'
import { ThemeToggle } from './theme-toggle'

const flow = [
  { icon: MapIcon, title: 'Jornada', text: 'Passo a passo' },
  { icon: Calculator, title: 'Lucro', text: 'Preço certo', highlight: true },
  { icon: Store, title: 'Mercado Livre', text: 'Estoque em dia' },
]

/** Lado esquerdo (computador): apresentação da plataforma sobre fundo escuro com gradiente. */
function Hero() {
  return (
    <section className="dark relative hidden flex-col justify-between overflow-hidden bg-background px-10 py-10 text-foreground lg:flex xl:px-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_520px_at_0%_0%,rgb(255_196_0/0.20),transparent_60%),radial-gradient(600px_480px_at_100%_100%,rgb(255_159_28/0.10),transparent_60%),linear-gradient(160deg,#141106,#050505)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_70%)]"
      />

      <RvGlyph className="pointer-events-none absolute -right-28 -bottom-28 size-[36rem] text-primary/[0.07]" strokeWidth={34} />

      <Link to="/entrar" className="relative w-fit rounded-md">
        <Brand />
      </Link>

      <div className="relative max-w-2xl space-y-8">
        <div className="space-y-5">
          <p className="text-xs font-bold tracking-[0.28em] text-primary-text">SEU COMEÇO NO MERCADO LIVRE</p>
          <h2 className="text-5xl leading-[1.05] font-extrabold xl:text-6xl">
            Do primeiro anúncio
            <span className="text-gradient block">ao lucro de verdade.</span>
          </h2>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            Aprenda o caminho, calcule o preço certo de cada venda e mantenha o estoque do Mercado Livre sempre atualizado.
          </p>
        </div>

        <ol className="flex items-stretch gap-2" aria-label="Como a plataforma ajuda">
          {flow.map((step, index) => (
            <li key={step.title} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'flex flex-1 flex-col gap-2 rounded-xl border p-4 backdrop-blur',
                  step.highlight ? 'border-primary/50 bg-primary/12 shadow-glow' : 'border-border bg-card/70',
                )}
              >
                <step.icon className={cn('size-5', step.highlight ? 'text-primary-text' : 'text-muted-foreground')} aria-hidden />
                <span className="text-sm font-semibold">{step.title}</span>
                <span className="text-xs text-muted-foreground">{step.text}</span>
              </div>
              {index < flow.length - 1 && <ArrowRight className="size-4 shrink-0 text-primary-text" aria-hidden />}
            </li>
          ))}
        </ol>
      </div>

      <p className="relative text-xs text-muted-foreground">Gestão Decola Full · jornada, lucro e estoque em um só lugar</p>
    </section>
  )
}

/** Moldura das telas públicas (entrar, cadastro, senha): apresentação + formulário. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Hero />
      <div className="flex min-h-dvh flex-col lg:border-l lg:border-border">
        <header className="flex items-center justify-between px-4 py-4 sm:px-8">
          <Link to="/entrar" className="rounded-md lg:invisible">
            <Brand />
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-12 sm:items-center sm:pt-0">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-3">
              <BrandMark className="size-12 rounded-xl" />
              <h1 className="text-3xl sm:text-4xl">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {children}
            {footer && <div className="border-t border-border pt-5 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  )
}
