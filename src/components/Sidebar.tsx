import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  Briefcase,
  Users,
  UserCheck,
  Network,
  Clock,
  CalendarDays,
  Building2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Layers,
  FolderOpen,
  FileText,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { UserPerfil, PROFILE_HOME_MAP } from '@/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

interface MenuItem {
  title: string
  path: string
  icon: React.ElementType
}

interface PillarSection {
  title: string
  allowedProfiles: UserPerfil[]
  items: MenuItem[]
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}) => {
  const { user } = useAuth()
  const perfil = user?.perfil || 'colaborador'

  // Define the 3 pillars + Administration
  const sections: PillarSection[] = [
    {
      title: 'Principal',
      allowedProfiles: ['colaborador', 'gestor', 'rh', 'admin'],
      items: [
        {
          title:
            perfil === 'colaborador'
              ? 'Meu Portal'
              : perfil === 'gestor'
                ? 'Painel da Equipe'
                : perfil === 'rh'
                  ? 'Painel RH'
                  : 'Painel Geral',
          path: PROFILE_HOME_MAP[perfil],
          icon: LayoutDashboard,
        },
        {
          title: 'Docs Importantes',
          path: '/documentos-importantes',
          icon: ShieldCheck,
        },
      ],
    },
    {
      title: 'Gestão de Talentos',
      allowedProfiles: ['rh', 'admin'],
      items: [
        { title: 'Vagas', path: '/vagas', icon: Briefcase },
        { title: 'Candidatos', path: '/candidatos', icon: UserCheck },
      ],
    },
    {
      title: 'Gestão de Pessoas',
      allowedProfiles: ['gestor', 'rh', 'admin'],
      items: [
        ...(perfil === 'rh' || perfil === 'admin'
          ? [
              { title: 'Colaboradores', path: '/colaboradores', icon: Users },
              { title: 'Documentos', path: '/documentos', icon: FolderOpen },
              { title: 'Validação Atestados', path: '/atestados/validacao', icon: ShieldCheck },
            ]
          : []),
        { title: 'Atestados / Licenças', path: '/atestados', icon: FileText },
        { title: 'Estrutura', path: '/estrutura', icon: Network },
      ],
    },
    {
      title: 'Gestão do Tempo',
      allowedProfiles: ['colaborador', 'gestor', 'rh', 'admin'],
      items: [
        { title: 'Ponto', path: '/ponto', icon: Clock },
        { title: 'Escalas', path: '/escalas', icon: CalendarDays },
      ],
    },
    {
      title: 'Administração',
      allowedProfiles: ['admin'],
      items: [
        { title: 'Tenant', path: '/admin/tenant', icon: Building2 },
        { title: 'Usuários', path: '/admin/usuarios', icon: ShieldCheck },
      ],
    },
  ]

  // Filter sections visible to current user's profile
  const visibleSections = sections.filter((sec) => sec.allowedProfiles.includes(perfil))

  const content = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-[#E0E0E0] select-none">
      {/* Brand & Logo Header */}
      <div>
        <div className="flex h-16 items-center justify-between px-4 border-b border-[#E0E0E0]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0D47A1] text-white font-bold shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-[15px] font-bold tracking-tight text-[#212121] leading-tight">
                  Gente & Gestão
                </span>
                <span className="text-[11px] font-semibold text-[#0D47A1] uppercase tracking-wider">
                  Tesla RH
                </span>
              </div>
            )}
          </div>

          {/* Desktop collapse button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="hidden lg:flex h-8 w-8 text-[#757575] hover:text-[#212121] hover:bg-[#E8EEF7]"
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation Sections */}
        <div className="py-4 px-2 space-y-6 overflow-y-auto max-h-[calc(100vh-130px)]">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#757575] mb-2">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const IconComponent = item.icon

                const linkElement = (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => mobileOpen && onMobileClose()}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors ${
                        isActive
                          ? 'bg-[#E8EEF7] text-[#0D47A1] font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r before:bg-[#0D47A1]'
                          : 'text-[#212121] hover:bg-[#F5F5F5] hover:text-[#0D47A1]'
                      } ${collapsed ? 'justify-center px-2' : ''}`
                    }
                  >
                    <IconComponent className="h-5 w-5 shrink-0" />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </NavLink>
                )

                if (collapsed) {
                  return (
                    <Tooltip key={item.path} delayDuration={100}>
                      <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="bg-[#212121] text-white text-xs font-medium"
                      >
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return linkElement
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer info in sidebar */}
      {!collapsed && (
        <div className="p-4 border-t border-[#E0E0E0] bg-[#FAFAFA] text-center">
          <p className="text-[11px] text-[#757575] leading-snug">Plataforma SaaS Multi-tenant</p>
          <p className="text-[10px] font-medium text-[#0D47A1]">Tesla RH v1.0.0</p>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <aside
        className={`hidden md:block fixed left-0 top-0 bottom-0 z-30 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        {content}
      </aside>

      {/* Mobile Drawer with Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`md:hidden fixed left-0 top-0 bottom-0 z-50 w-[260px] transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </aside>
    </>
  )
}
