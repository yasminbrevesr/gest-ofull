import { ArrowRight, Calculator, Package, Store, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/ui/card'
import { useProfile } from '@/providers/auth'
import { useMlConnection } from '../mercadolivre/api'
import { JourneyCard } from './journey-card'
import { LowStockCard } from './low-stock-card'
import { MlCard } from './ml-card'

function firstName(name: string | undefined) {
  return name?.trim().split(/\s+/)[0] ?? ''
}

interface Shortcut {
  to: string
  title: string
  description: string
  icon: LucideIcon
}

export default function DashboardPage() {
  const { data: profile } = useProfile()
  const { data: connection } = useMlConnection()
  const name = firstName(profile?.full_name)

  const shortcuts: Shortcut[] = [
    {
      to: '/calculadora',
      title: 'Calculadora de lucro',
      description: profile?.has_products ? 'Veja quanto sobra em cada venda.' : 'Avalie se vale a pena antes de comprar o produto.',
      icon: Calculator,
    },
    {
      to: '/estoque',
      title: 'Estoque',
      description: profile?.has_products ? 'Cadastre seus produtos e controle as quantidades.' : 'Quando tiver produtos, cadastre aqui.',
      icon: Package,
    },
    connection
      ? { to: '/mercado-livre', title: 'Mercado Livre', description: 'Anúncios, vínculos e sincronização.', icon: Store }
      : { to: '/mercado-livre', title: 'Conectar Mercado Livre', description: 'Importe anúncios e sincronize o estoque.', icon: Store },
  ]

  return (
    <>
      <PageHeader
        title={
          <>
            Olá{name ? `, ${name}` : ''}! Vamos <Highlight>decolar</Highlight>?
          </>
        }
        description="Aqui você acompanha sua jornada no Mercado Livre."
      />
      <div className="space-y-8">
        <JourneyCard />
        <section aria-labelledby="atalhos" className="space-y-3">
          <h2 id="atalhos" className="text-xl">
            Atalhos
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {shortcuts.map((s) => (
              <ShortcutCard key={s.to} {...s} />
            ))}
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-2">
          <MlCard />
          <LowStockCard />
        </div>
      </div>
    </>
  )
}

function ShortcutCard({ to, title, description, icon: Icon }: Shortcut) {
  return (
    <Link to={to} className="group rounded-xl">
      <Card className="flex h-full items-start gap-3 p-4 transition-colors duration-150 group-hover:border-primary/60">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/12 text-primary-text">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold">
            {title} <ArrowRight className="size-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
          </span>
          <span className="text-sm text-muted-foreground">{description}</span>
        </span>
      </Card>
    </Link>
  )
}
