import { Calculator, Home, UserRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Só aparece para administradores. */
  admin?: boolean
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/calculadora', label: 'Calculadora de lucro', icon: Calculator },
  { to: '/perfil', label: 'Meu perfil', icon: UserRound },
]
