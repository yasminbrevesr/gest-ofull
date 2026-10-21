import { ExternalLink } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { formatDate } from '@/lib/format'
import type { AppSettings } from './api'

/** Aviso obrigatório: as tarifas são referência e mudam com frequência. */
export function ReferenceNote({ settings }: { settings: AppSettings }) {
  return (
    <Alert variant={settings.fees_reviewed_on ? 'info' : 'warning'}>
      {settings.fees_reviewed_on ? (
        <>Valores de referência, atualizados em {formatDate(settings.fees_reviewed_on)}. Confira sempre no Mercado Livre.</>
      ) : (
        <>Valores de referência, ainda não conferidos pela equipe. Confira sempre no Mercado Livre.</>
      )}{' '}
      <a href={settings.fees_source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
        Ver tarifas oficiais <ExternalLink className="size-3.5" />
      </a>
    </Alert>
  )
}
