import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { PROFILE_LABELS, PROFILE_BADGE_COLORS } from '@/types'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  onToggleMobileMenu: () => void
  collapsed: boolean
}

const ROUTE_TITLES: Record<string, string> = {
  '/portal': 'Meu Portal',
  '/dashboard-equipe': 'Dashboard da Equipe',
  '/dashboard': 'Dashboard RH',
  '/dashboard-rh': 'Dashboard RH',
  '/pendencias-documentais': 'Gestão de Pessoas • Pendências Documentais',
  '/admin': 'Administração do Sistema',
  '/admin/tenant': 'Configurações do Tenant',
  '/admin/usuarios': 'Gerenciamento de Usuários',
  '/vagas': 'Gestão de Talentos • Vagas',
  '/candidatos': 'Gestão de Talentos • Candidatos',
  '/colaboradores': 'Gestão de Pessoas • Colaboradores',
  '/estrutura': 'Gestão de Pessoas • Estrutura Organizacional',
  '/ponto': 'Gestão do Tempo • Controle de Ponto',
  '/escalas': 'Gestão do Tempo • Escalas de Trabalho',
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, collapsed }) => {
  const { user, colaborador, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const currentTitle = ROUTE_TITLES[location.pathname] || 'Gente & Gestão Tesla'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Get first name
  const fullName = colaborador?.nome || user?.name || user?.email || 'Usuário'
  const firstName = fullName.split(' ')[0]

  // Initials
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return (name[0] || 'U').toUpperCase()
  }

  const perfil = user?.perfil || 'colaborador'
  const badgeStyle = PROFILE_BADGE_COLORS[perfil]

  return (
    <header
      className={`fixed top-0 right-0 z-20 flex h-16 items-center justify-between border-b border-[#E0E0E0] bg-white px-4 md:px-8 transition-all duration-300 ease-in-out ${
        collapsed ? 'md:left-[72px]' : 'md:left-[260px]'
      } left-0`}
    >
      {/* Left: Mobile hamburger & Dynamic page title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleMobileMenu}
          className="md:hidden h-9 w-9 text-[#212121] hover:bg-[#F5F5F5]"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg md:text-xl font-bold text-[#212121] tracking-tight">
            {currentTitle}
          </h1>
        </div>
      </div>

      {/* Right: Greeting, profile badge, and User Dropdown */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Profile badge (hidden on very small screens) */}
        <div className="hidden sm:flex items-center">
          <Badge
            variant="outline"
            className={`${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} font-medium text-xs px-2.5 py-0.5 rounded-full capitalize`}
          >
            {PROFILE_LABELS[perfil]}
          </Badge>
        </div>

        {/* Greeting (desktop only) */}
        <span className="hidden md:inline text-sm font-medium text-[#212121]">
          Olá, <strong className="font-semibold text-[#0D47A1]">{firstName}</strong>!
        </span>

        {/* Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full p-0 ring-offset-background transition-transform focus:outline-none focus:ring-2 focus:ring-[#1565C0] focus:ring-offset-2 hover:opacity-90"
              aria-label="Menu do usuário"
            >
              <Avatar className="h-10 w-10 border border-[#E0E0E0]">
                {colaborador?.foto_url && <AvatarImage src={colaborador.foto_url} alt={fullName} />}
                <AvatarFallback className="bg-[#E8EEF7] font-semibold text-[#0D47A1]">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold text-[#212121] truncate">{fullName}</p>
                <p className="text-xs text-[#757575] truncate">{user?.email}</p>
                <p className="text-xs font-medium text-[#0D47A1] mt-1 sm:hidden">
                  Perfil: {PROFILE_LABELS[perfil]}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-[#212121] focus:bg-[#E8EEF7] focus:text-[#0D47A1]"
              onClick={() => navigate('/portal')}
            >
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Meu perfil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-[#C62828] focus:bg-[#FFEBEE] focus:text-[#C62828]"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
