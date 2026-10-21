import { BookOpen, Map as MapIcon, Percent, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Highlight, PageHeader } from '@/components/common/page-header'
import { cn } from '@/lib/utils'

const sections = [
  { to: '/admin/jornada', label: 'Jornada', icon: MapIcon },
  { to: '/admin/glossario', label: 'Glossário', icon: BookOpen },
  { to: '/admin/tarifas', label: 'Tarifas', icon: Percent },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users },
]

export default function AdminLayout() {
  return (
    <>
      <PageHeader
        title={
          <>
            <Highlight>Administração</Highlight>
          </>
        }
        description="Conteúdo da jornada e do glossário, tarifas da calculadora e usuários. As mudanças valem na hora, sem publicar o app de novo."
      />
      <nav aria-label="Seções da administração" className="mb-6 flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {sections.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground [&_svg]:size-4',
                isActive && 'bg-card font-semibold text-primary-text shadow-soft',
              )
            }
          >
            <Icon aria-hidden /> {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
