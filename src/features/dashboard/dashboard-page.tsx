import { UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProfile } from '@/providers/auth'

function firstName(name: string | undefined) {
  return name?.trim().split(/\s+/)[0] ?? ''
}

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
      <Card>
        <CardHeader>
          <CardTitle>Seu perfil</CardTitle>
          <CardDescription>Confira seus dados e o imposto usado nos cálculos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/perfil">
              <UserRound /> Ver meu perfil
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
