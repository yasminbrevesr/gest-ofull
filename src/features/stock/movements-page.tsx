import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Card, CardContent } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/input'
import { useMovements } from './api'
import { MovementList } from './movement-list'
import { movementLabels, originLabels, type MovementOrigin, type MovementType } from './types'

export default function MovementsPage() {
  const movements = useMovements({ limit: 500 })
  const [type, setType] = useState<MovementType | ''>('')
  const [origin, setOrigin] = useState<MovementOrigin | ''>('')

  const filtered = useMemo(
    () => (movements.data ?? []).filter((m) => (!type || m.movement_type === type) && (!origin || m.origin === origin)),
    [movements.data, type, origin],
  )

  return (
    <>
      <Link to="/estoque" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline">
        <ArrowLeft className="size-4" /> Estoque
      </Link>
      <PageHeader title="Histórico de movimentações" description="As 500 movimentações mais recentes de todos os produtos." />
      <div className="mb-4 flex flex-wrap gap-3">
        <NativeSelect aria-label="Tipo" className="w-44" value={type} onChange={(e) => setType(e.target.value as MovementType | '')}>
          <option value="">Todos os tipos</option>
          {Object.entries(movementLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Origem" className="w-48" value={origin} onChange={(e) => setOrigin(e.target.value as MovementOrigin | '')}>
          <option value="">Todas as origens</option>
          {Object.entries(originLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {movements.isLoading ? (
        <LoadingState rows={6} />
      ) : movements.error ? (
        <ErrorState error={movements.error} onRetry={() => movements.refetch()} />
      ) : (
        <Card>
          <CardContent className="pt-3">
            <MovementList movements={filtered} showProduct />
          </CardContent>
        </Card>
      )}
    </>
  )
}
