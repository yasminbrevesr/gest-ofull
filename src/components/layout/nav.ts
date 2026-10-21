import { BookOpen, Calculator, Home, Map as MapIcon, UserRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Só aparece para administradores. */
  admin?: boolean
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/jornada', label: 'Como começar', icon: MapIcon },
  { to: '/calculadora', label: 'Calculadora de lucro', icon: Calculator },
  { to: '/glossario', label: 'Glossário', icon: BookOpen },
  { to: '/perfil', label: 'Meu perfil', icon: UserRound },
]
