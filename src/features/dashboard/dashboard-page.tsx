import { ArrowRight, BookOpen, Calculator, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/ui/card'
import { useProfile } from '@/providers/auth'
import { JourneyCard } from './journey-card'

function firstName(name: string | undefined) {
  return name?.trim().split(/\s+/)[0] ?? ''
}

interface Shortcut {
  to: string
  title: string
  description: string
  icon: LucideIcon
}

const shortcuts: Shortcut[] = [
  { to: '/calculadora', title: 'Calculadora de lucro', description: 'Veja quanto sobra em cada venda.', icon: Calculator },
  { to: '/glossario', title: 'Glossário', description: 'Termos do Mercado Livre explicados.', icon: BookOpen },
]

export default function DashboardPage() {
  const { data: profile } = useProfile()
  const name = firstName(profile?.full_name)

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
      </div>
    </>
  )
}

function ShortcutCard({ to, title, description, icon: Icon }: Shortcut) {
  return (
    <Link to={to} className="group rounded-xl">
      <Card className="flex h-full items-start gap-3 p-4 transition-colors duration-150 group-hover:border-primary/60">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
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
