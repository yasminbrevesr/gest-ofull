import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Markdown } from '@/components/common/markdown'
import { Brand } from '@/components/layout/brand'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Card } from '@/components/ui/card'
import { privacyPolicy, termsOfUse } from './texts'

function LegalPage({ title, content }: { title: string; content: string }) {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link to="/" className="rounded-md">
          <Brand />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <Card className="p-6 sm:p-10">
          <h1 className="mb-4 text-3xl">{title}</h1>
          <Markdown className="text-sm sm:text-base">{content}</Markdown>
        </Card>
      </main>
    </div>
  )
}

export function TermsPage() {
  return <LegalPage title="Termos de Uso" content={termsOfUse} />
}

export function PrivacyPage() {
  return <LegalPage title="Política de Privacidade" content={privacyPolicy} />
}
