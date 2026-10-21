import { Search, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDate, formatDateTime } from '@/lib/format'
import { useAdminUsers, type AdminUser } from './api'

const personLabels: Record<string, string> = { pf: 'Pessoa física', mei: 'MEI', empresa: 'Empresa' }

export default function UsersAdminPage() {
  const users = useAdminUsers()
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (users.data ?? []).filter((u) => !q || `${u.full_name ?? ''} ${u.email} ${u.ml_nickname ?? ''}`.toLowerCase().includes(q))
  }, [users.data, query])

  const total = users.data?.length ?? 0
  const connected = users.data?.filter((u) => u.ml_status === 'active').length ?? 0
  const reconnect = users.data?.filter((u) => u.ml_status === 'reconnect_required').length ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {total} usuário(s) · {connected} com Mercado Livre conectado{reconnect ? ` · ${reconnect} precisando reconectar` : ''}. As chaves de acesso não
          aparecem aqui.
        </p>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            placeholder="Buscar nome, e-mail ou loja"
            aria-label="Buscar usuário"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {users.isLoading ? (
        <LoadingState rows={6} />
      ) : users.error ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum usuário encontrado" />
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((u) => (
            <UserRow key={u.user_id} user={u} />
          ))}
        </Card>
      )}
    </div>
  )
}

function UserRow({ user }: { user: AdminUser }) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[1.3fr_1fr_1.2fr] md:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {user.full_name || '(sem nome)'}
          {user.role === 'admin' && (
            <Badge variant="default">
              <ShieldCheck /> Admin
            </Badge>
          )}
          {!user.onboarding_completed_at && <Badge variant="muted">Cadastro inicial pendente</Badge>}
        </p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
      <div className="text-xs text-muted-foreground">
        <p>
          {user.person_type ? personLabels[user.person_type] : 'Tipo não informado'} · {user.products_count} produto(s)
        </p>
        <p>Cadastro: {formatDate(user.created_at)}</p>
        <p>Último acesso: {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : '—'}</p>
      </div>
      <div className="space-y-1 text-sm">
        {user.ml_status ? (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{user.ml_nickname}</span>
              <Badge variant={user.ml_status === 'active' ? 'success' : 'danger'}>{user.ml_status === 'active' ? 'Conectado' : 'Reconectar'}</Badge>
              <Badge variant="outline">{user.ml_sync_mode === 'automatic' ? 'Automático' : 'Manual'}</Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              {user.ml_listings_count} anúncio(s) · último envio: {user.ml_last_sync_at ? formatDateTime(user.ml_last_sync_at) : '—'}
              {user.ml_last_sync_status === 'error' && ' (erro)'}
              {user.ml_events_errors > 0 && ` · ${user.ml_events_errors} evento(s) com erro`}
            </p>
          </>
        ) : (
          <Badge variant="muted">Mercado Livre não conectado</Badge>
        )}
      </div>
    </div>
  )
}
