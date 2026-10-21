import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Página não encontrada"
      description="O endereço pode ter mudado ou estar digitado errado."
      action={
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      }
      className="mt-10"
    />
  )
}
