import { LogOut, Menu, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useAuth, useProfile } from '@/providers/auth'
import { Brand } from './brand'
import { navItems } from './nav'
import { ThemeToggle } from './theme-toggle'

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { data: profile } = useProfile()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'
  const itemClass = 'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors duration-150 [&_svg]:size-5'
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1">
      {navItems
        .filter((item) => !item.admin || isAdmin)
        .map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) => cn(itemClass, isActive ? 'bg-muted text-foreground' : 'text-foreground/85 hover:bg-muted/60 hover:text-foreground')}
          >
            <item.icon strokeWidth={1.75} aria-hidden />
            {item.label}
          </NavLink>
        ))}
      <button
        type="button"
        className={cn(itemClass, 'text-coral-text hover:bg-coral/10')}
        onClick={async () => {
          onNavigate?.()
          await signOut()
          navigate('/entrar', { replace: true })
        }}
      >
        <LogOut strokeWidth={1.75} aria-hidden />
        Sair
      </button>
    </nav>
  )
}

/** Seção atual (mostrada na barra superior, ao lado da marca). */
function useCurrentSection() {
  const { pathname } = useLocation()
  return navItems.find((item) => item.to !== '/' && (pathname === item.to || pathname.startsWith(`${item.to}/`)))
}

function UserMenu() {
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const navigate = useNavigate()
  const name = profile?.full_name || user?.email || ''
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu da conta" className="rounded-full">
          <span className="flex size-8 items-center justify-center rounded-full bg-linear-to-br from-primary to-amber text-xs font-bold text-on-accent">
            {initials}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-semibold text-foreground">{profile?.full_name || 'Minha conta'}</span>
          <span className="block truncate">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/perfil')}>
          <UserRound /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await signOut()
            navigate('/entrar', { replace: true })
          }}
        >
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Estrutura das telas logadas: barra superior inteira + menu lateral (computador) ou gaveta (celular). */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const section = useCurrentSection()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background px-4 sm:px-8">
        <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
          <Menu />
        </Button>
        <Link to="/" className="rounded-md" aria-label="Início">
          <Brand className="max-sm:[&>span:last-child]:hidden" />
        </Link>
        <span aria-hidden className="mx-3 hidden h-6 w-px bg-border sm:block" />
        <nav aria-label="Atalhos" className="hidden items-center gap-6 text-sm sm:flex">
          <Link to="/" className={cn('transition-colors hover:text-foreground', section ? 'text-muted-foreground' : 'font-medium text-foreground')}>
            Início
          </Link>
          {section && (
            <Link to={section.to} className="font-medium text-foreground">
              {section.label}
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent aria-describedby={undefined} className="gap-6 border-border bg-background px-3 py-5">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand className="px-2 pr-10" />
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-r border-border px-3 py-6 lg:block">
          <NavLinks />
        </aside>
        <main id="conteudo" className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
