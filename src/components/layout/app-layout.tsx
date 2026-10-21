import { LogOut, Menu, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
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
import { Brand, BrandMark } from './brand'
import { navItems } from './nav'
import { ThemeToggle } from './theme-toggle'

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { data: profile } = useProfile()
  const isAdmin = profile?.role === 'admin'
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
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 [&_svg]:size-[18px]',
                isActive
                  ? 'bg-linear-to-r from-primary/20 to-primary/5 font-semibold text-primary-text ring-1 ring-primary/30 ring-inset'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <item.icon strokeWidth={1.75} aria-hidden />
            {item.label}
          </NavLink>
        ))}
    </nav>
  )
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

/** Estrutura das telas logadas: menu lateral (computador) ou gaveta (celular) + barra superior. */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>

      {/* O menu lateral é sempre escuro, também no tema claro. */}
      <aside className="dark sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-sidebar bg-[radial-gradient(420px_320px_at_0%_0%,rgb(255_196_0/0.10),transparent_70%)] px-4 py-5 text-foreground lg:flex">
        <Link to="/" className="rounded-md px-1">
          <Brand />
        </Link>
        <NavLinks />
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent aria-describedby={undefined} className="dark gap-6 border-border bg-sidebar px-4 py-5 text-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand className="pr-8" />
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-background/75 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
          <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="Início">
            <BrandMark className="size-8" />
            <span className="font-display font-bold max-sm:sr-only">Gestão Decola Full</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
