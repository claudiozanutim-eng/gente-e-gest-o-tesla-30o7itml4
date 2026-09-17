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
  Gift,
  FileWarning,
  BarChart3,
  Award,
  CheckCircle2,
  Megaphone,
  UserCog,
  Building,
  Palmtree,
  CalendarCheck,
  Mail,
  DollarSign,
  HeartHandshake,
  Bot,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePermission } from '@/hooks/usePermission'
import { UserPerfil, PROFILE_HOME_MAP, PermissaoMenuKey } from '@/types'
import { Button } from '@/components/ui/button'
import { TESLA_LOGO_URL } from '@/lib/logoAsset'
import { NIKO_ROBOT_AVATAR_URL } from '@/lib/nikoAsset'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ROTA_PARA_CHAVE_MAP } from '@/services/permissaoUsuarioService'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

interface MenuItem {
  title: string
  path: string
  icon?: React.ElementType
  customIcon?: React.ReactNode
  permissionKey?: PermissaoMenuKey
  color?: string
}

/**
 * Mapeamento centralizado de cores harmônicas e de alta legibilidade para cada rota/item do menu lateral.
 * Cores cuidadosamente selecionadas sobre o fundo claro (#FFFFFF / #F5F5F5) e harmônicas com o azul Tesla (#0D47A1).
 */
export const MENU_ITEM_COLORS: Record<string, string> = {
  // Principal & Portais
  '/portal': '#1976D2', // Azul Tesla Vibrante (Portal Colaborador)
  '/portal-gestor': '#0284C7', // Sky / Cyan Escuro (Portal do Gestor)
  '/dashboard': '#0D47A1', // Azul Marinho Institucional (Painel RH)
  '/admin': '#475569', // Ardósia / Slate Executivo (Painel Geral / Admin)
  '/documentos-importantes': '#059669', // Esmeralda Seguro (Docs Importantes)
  '/demonstrativo': '#2563EB', // Azul Royal (Demonstrativo Financeiro)
  '/beneficios': '#EA580C', // Laranja Vivo (Benefícios)
  '/ferias': '#0D9488', // Teal / Verde Tropical (Férias)
  '/avaliacoes': '#D97706', // Âmbar Dourado (Minhas Avaliações)

  // Gestão de Talentos
  '/vagas': '#4F46E5', // Índigo Moderno (Vagas)
  '/candidatos': '#0891B2', // Ciano Profundo (Candidatos)
  '/minha-equipe': '#7C3AED', // Violeta / Roxo (Minha Equipe)
  '/estrutura': '#4338CA', // Índigo Escuro (Estrutura Organizacional)

  // Gestão de Pessoas
  '/colaboradores': '#1D4ED8', // Azul Safira (Colaboradores)
  '/folha/gestao': '#16A34A', // Verde Folha / Financeiro (Gestão da Folha)
  '/comunicados/gestao': '#9333EA', // Púrpura Comunicativa (Comunicados)
  '/alteracoes/pendentes': '#D97706', // Âmbar / Atenção (Alterações Pendentes)
  '/avaliacoes/admin': '#B45309', // Ocre / Âmbar Escuro (Avaliações Admin)
  '/pesquisa-clima': '#E11D48', // Rosa Magenta Humano (Pesquisa de Clima)
  '/pendencias-documentais': '#DC2626', // Vermelho Alerta (Pendências Docs)
  '/documentos': '#0284C7', // Azul Céu / Pastas (Documentos)
  '/beneficios/gestao': '#C2410C', // Laranja Escuro (Gestão Benefícios)
  '/atestados/validacao': '#0D9488', // Teal Médico (Validação Atestados)
  '/ferias/aprovacoes': '#059669', // Verde Sucesso (Aprovações de Férias)
  '/ferias/coletivo': '#0F766E', // Verde Floresta (Férias Coletivas)
  '/relatorios': '#6366F1', // Índigo / Análise de Dados (Relatórios)
  '/atestados': '#0284C7', // Azul Atestados / Licenças

  // Gestão do Tempo
  '/ponto': '#0284C7', // Azul Claro (Meu Ponto)
  '/banco-horas': '#4F46E5', // Índigo Equilibrado (Banco de Horas)
  '/banco-horas/fechamento': '#4338CA', // Índigo Calendário (Fechamento Banco Horas)
  '/ponto/gestao': '#16A34A', // Verde Validação (Gestão de Ponto)
  '/escalas': '#7C3AED', // Violeta Turnos (Escalas)

  // Administração
  '/financeiro': '#15803D', // Verde Cifrão Financeiro (Dashboard Financeiro)
  '/admin/configuracoes': '#475569', // Ardósia Empresa (Configurações da Empresa)
  '/admin/email': '#2563EB', // Azul Mensageria (Configurações de E-mail)
  '/admin/usuarios': '#9333EA', // Roxo Permissões (Usuários e Permissões)
  '/admin/logs': '#B45309', // Âmbar Auditoria (Logs de Auditoria)
  '/admin/tenant': '#334155', // Slate Escuro Corporativo (Gestão de Tenant SaaS)
}

/**
 * Cores discretas para os marcadores/títulos das seções/pilares
 */
const SECTION_COLORS: Record<string, string> = {
  Principal: '#0D47A1',
  'Gestão de Talentos': '#4F46E5',
  'Gestão de Pessoas': '#0D9488',
  'Gestão do Tempo': '#0284C7',
  Administração: '#475569',
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
  const {
    perfil: userPerfil,
    podeAprovarFeriasEquipe,
    podeSolicitarFerias,
    podeGerenciarFolha,
    podeConfigurarAvaliacoes,
    podeGerenciarTenant,
    podeGerenciarUsuarios,
    podeVerLogsAuditoria,
    isColaborador,
    isGestor,
    isRHOrAbove,
    isAdminRHOrAbove,
    isAdminGeral,
    podeAcessarItem,
    userFlags,
  } = usePermission()
  const perfil = userPerfil || user?.perfil || 'colaborador'

  /**
   * Helper para checar se um item de menu deve ser exibido,
   * respeitando as flags de liberação (exceções individuais: liberado / bloqueado).
   */
  const deveExibirItem = (item: MenuItem, defaultVisible: boolean): boolean => {
    const permKey = item.permissionKey || ROTA_PARA_CHAVE_MAP[item.path]
    if (!permKey) return defaultVisible

    const flag = userFlags?.[permKey] || 'padrao'
    if (flag === 'bloqueado') return false
    if (flag === 'liberado') return true
    return defaultVisible
  }

  // Define the 3 pillars + Administration
  const sections: PillarSection[] = [
    {
      title: 'Principal',
      allowedProfiles: ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin'],
      items: [
        {
          title:
            perfil === 'colaborador'
              ? 'Meu Portal'
              : perfil === 'gestor'
                ? 'Portal do Gestor'
                : perfil === 'rh' || perfil === 'admin_rh'
                  ? 'Painel RH'
                  : 'Painel Geral',
          path: PROFILE_HOME_MAP[perfil],
          icon: LayoutDashboard,
        },
        ...(deveExibirItem(
          { title: 'Portal do Gestor', path: '/portal-gestor', icon: LayoutDashboard },
          isGestor || isRHOrAbove,
        )
          ? [
              {
                title: 'Portal do Gestor',
                path: '/portal-gestor',
                icon: LayoutDashboard,
              },
            ]
          : []),
        ...(deveExibirItem(
          { title: 'Docs Importantes', path: '/documentos-importantes', icon: ShieldCheck },
          true,
        )
          ? [
              {
                title: 'Docs Importantes',
                path: '/documentos-importantes',
                icon: ShieldCheck,
              },
            ]
          : []),
        ...(deveExibirItem({ title: 'Demonstrativo', path: '/demonstrativo', icon: FileText }, true)
          ? [
              {
                title: 'Demonstrativo',
                path: '/demonstrativo',
                icon: FileText,
              },
            ]
          : []),
        ...(deveExibirItem({ title: 'Benefícios', path: '/beneficios', icon: Gift }, true)
          ? [
              {
                title: 'Benefícios',
                path: '/beneficios',
                icon: Gift,
              },
            ]
          : []),
        ...(deveExibirItem(
          { title: 'Férias', path: '/ferias', icon: Palmtree },
          podeSolicitarFerias,
        )
          ? [
              {
                title: 'Férias',
                path: '/ferias',
                icon: Palmtree,
              },
            ]
          : []),
        // Entrada "Minhas Avaliações" para colaboradores
        ...(deveExibirItem(
          { title: 'Minhas Avaliações', path: '/avaliacoes', icon: Award },
          isColaborador,
        )
          ? [
              {
                title: 'Minhas Avaliações',
                path: '/avaliacoes',
                icon: Award,
              },
            ]
          : []),
      ],
    },
    {
      title: 'Gestão de Talentos',
      allowedProfiles: ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin'],
      items: [
        ...(deveExibirItem({ title: 'Vagas', path: '/vagas', icon: Briefcase }, isRHOrAbove)
          ? [{ title: 'Vagas', path: '/vagas', icon: Briefcase }]
          : []),
        ...(deveExibirItem(
          { title: 'Candidatos', path: '/candidatos', icon: UserCheck },
          isRHOrAbove,
        )
          ? [{ title: 'Candidatos', path: '/candidatos', icon: UserCheck }]
          : []),
        ...(deveExibirItem(
          { title: 'Portal do Gestor', path: '/portal-gestor', icon: LayoutDashboard },
          isGestor || isRHOrAbove,
        )
          ? [{ title: 'Portal do Gestor', path: '/portal-gestor', icon: LayoutDashboard }]
          : []),
        ...(deveExibirItem(
          { title: 'Minha Equipe', path: '/minha-equipe', icon: Users },
          isGestor || isRHOrAbove,
        )
          ? [{ title: 'Minha Equipe', path: '/minha-equipe', icon: Users }]
          : []),
        ...(deveExibirItem(
          { title: 'Estrutura', path: '/estrutura', icon: Network },
          isRHOrAbove || isGestor,
        )
          ? [{ title: 'Estrutura', path: '/estrutura', icon: Network }]
          : []),
      ],
    },
    {
      title: 'Gestão de Pessoas',
      allowedProfiles: ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin'],
      items: [
        ...(deveExibirItem(
          {
            title: 'NIKO RH — Assistente Virtual',
            path: '/niko-rh',
            icon: Bot,
            permissionKey: 'niko_rh',
          },
          true,
        )
          ? [
              {
                title: 'NIKO RH — Assistente',
                path: '/niko-rh',
                permissionKey: 'niko_rh' as PermissaoMenuKey,
                customIcon: (
                  <img
                    src={NIKO_ROBOT_AVATAR_URL}
                    alt="NIKO RH"
                    loading="lazy"
                    className="h-5 w-5 shrink-0 object-contain drop-shadow-xs"
                  />
                ),
              },
            ]
          : []),
        ...(deveExibirItem(
          { title: 'Colaboradores', path: '/colaboradores', icon: Users },
          isRHOrAbove,
        )
          ? [{ title: 'Colaboradores', path: '/colaboradores', icon: Users }]
          : []),
        ...(deveExibirItem(
          { title: 'Gestão da Folha', path: '/folha/gestao', icon: Briefcase },
          isAdminRHOrAbove,
        )
          ? [{ title: 'Gestão da Folha', path: '/folha/gestao', icon: Briefcase }]
          : []),
        ...(deveExibirItem(
          { title: 'Comunicados', path: '/comunicados/gestao', icon: Megaphone },
          isRHOrAbove,
        )
          ? [{ title: 'Comunicados', path: '/comunicados/gestao', icon: Megaphone }]
          : []),
        ...(deveExibirItem(
          { title: 'Alterações Pendentes', path: '/alteracoes/pendentes', icon: UserCog },
          isRHOrAbove,
        )
          ? [{ title: 'Alterações Pendentes', path: '/alteracoes/pendentes', icon: UserCog }]
          : []),
        ...(deveExibirItem(
          { title: 'Avaliações Admin', path: '/avaliacoes/admin', icon: Award },
          isAdminRHOrAbove,
        )
          ? [{ title: 'Avaliações Admin', path: '/avaliacoes/admin', icon: Award }]
          : []),
        ...(deveExibirItem(
          { title: 'Pesquisa de Clima', path: '/pesquisa-clima', icon: HeartHandshake },
          isRHOrAbove,
        )
          ? [{ title: 'Pesquisa de Clima', path: '/pesquisa-clima', icon: HeartHandshake }]
          : []),
        ...(deveExibirItem(
          { title: 'Pendências Docs', path: '/pendencias-documentais', icon: FileWarning },
          isRHOrAbove,
        )
          ? [{ title: 'Pendências Docs', path: '/pendencias-documentais', icon: FileWarning }]
          : []),
        ...(deveExibirItem(
          { title: 'Documentos', path: '/documentos', icon: FolderOpen },
          isRHOrAbove,
        )
          ? [{ title: 'Documentos', path: '/documentos', icon: FolderOpen }]
          : []),
        ...(deveExibirItem(
          { title: 'Gestão Benefícios', path: '/beneficios/gestao', icon: Gift },
          isRHOrAbove,
        )
          ? [{ title: 'Gestão Benefícios', path: '/beneficios/gestao', icon: Gift }]
          : []),
        ...(deveExibirItem(
          { title: 'Validação Atestados', path: '/atestados/validacao', icon: ShieldCheck },
          isRHOrAbove,
        )
          ? [{ title: 'Validação Atestados', path: '/atestados/validacao', icon: ShieldCheck }]
          : []),
        ...(deveExibirItem(
          { title: 'Aprovações de Férias', path: '/ferias/aprovacoes', icon: CalendarCheck },
          isGestor || isRHOrAbove,
        )
          ? [{ title: 'Aprovações de Férias', path: '/ferias/aprovacoes', icon: CalendarCheck }]
          : []),
        ...(deveExibirItem({ title: 'Férias (Solicitação)', path: '/ferias', icon: Palmtree }, true)
          ? [{ title: 'Férias', path: '/ferias', icon: Palmtree }]
          : []),
        ...(deveExibirItem(
          { title: 'Férias Coletivas', path: '/ferias/coletivo', icon: Palmtree },
          isRHOrAbove,
        )
          ? [{ title: 'Férias Coletivas', path: '/ferias/coletivo', icon: Palmtree }]
          : []),
        ...(deveExibirItem(
          { title: 'Relatórios', path: '/relatorios', icon: BarChart3 },
          isRHOrAbove,
        )
          ? [{ title: 'Relatórios', path: '/relatorios', icon: BarChart3 }]
          : []),
        ...(deveExibirItem(
          { title: 'Atestados / Licenças', path: '/atestados', icon: FileText },
          true,
        )
          ? [{ title: 'Atestados / Licenças', path: '/atestados', icon: FileText }]
          : []),
      ],
    },
    {
      title: 'Gestão do Tempo',
      allowedProfiles: ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin'],
      items: [
        ...(deveExibirItem({ title: 'Meu Ponto', path: '/ponto', icon: Clock }, true)
          ? [{ title: 'Meu Ponto', path: '/ponto', icon: Clock }]
          : []),
        ...(deveExibirItem({ title: 'Banco de Horas', path: '/banco-horas', icon: Clock }, true)
          ? [{ title: 'Banco de Horas', path: '/banco-horas', icon: Clock }]
          : []),
        ...(deveExibirItem(
          {
            title: 'Fechamento Banco Horas',
            path: '/banco-horas/fechamento',
            icon: CalendarDays,
          },
          isRHOrAbove,
        )
          ? [
              {
                title: 'Fechamento Banco Horas',
                path: '/banco-horas/fechamento',
                icon: CalendarDays,
              },
            ]
          : []),
        ...(deveExibirItem(
          { title: 'Gestão de Ponto', path: '/ponto/gestao', icon: CheckCircle2 },
          isRHOrAbove || isGestor,
        )
          ? [{ title: 'Gestão de Ponto', path: '/ponto/gestao', icon: CheckCircle2 }]
          : []),
        ...(deveExibirItem(
          { title: 'Escalas', path: '/escalas', icon: CalendarDays },
          isAdminRHOrAbove,
        )
          ? [{ title: 'Escalas', path: '/escalas', icon: CalendarDays }]
          : []),
      ],
    },
    {
      title: 'Administração',
      allowedProfiles: ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin'],
      items: [
        ...(deveExibirItem(
          { title: 'Dashboard Financeiro', path: '/financeiro', icon: DollarSign },
          isAdminRHOrAbove,
        )
          ? [{ title: 'Dashboard Financeiro', path: '/financeiro', icon: DollarSign }]
          : []),
        ...(deveExibirItem(
          { title: 'Configurações da Empresa', path: '/admin/configuracoes', icon: Building },
          isAdminGeral,
        )
          ? [{ title: 'Configurações da Empresa', path: '/admin/configuracoes', icon: Building }]
          : []),
        ...(deveExibirItem(
          { title: 'Configurações de E-mail', path: '/admin/email', icon: Mail },
          isAdminGeral,
        )
          ? [{ title: 'Configurações de E-mail', path: '/admin/email', icon: Mail }]
          : []),
        // Usuários e Permissões: visível para Admin e Administrador de RH (ou se flag liberada)
        ...(deveExibirItem(
          { title: 'Usuários e Permissões', path: '/admin/usuarios', icon: Users },
          isAdminRHOrAbove,
        )
          ? [{ title: 'Usuários e Permissões', path: '/admin/usuarios', icon: Users }]
          : []),
        ...(deveExibirItem(
          { title: 'Logs de Auditoria', path: '/admin/logs', icon: ShieldCheck },
          isAdminRHOrAbove,
        )
          ? [{ title: 'Logs de Auditoria', path: '/admin/logs', icon: ShieldCheck }]
          : []),
        ...(deveExibirItem(
          { title: 'Gestão de Tenant (SaaS)', path: '/admin/tenant', icon: Building2 },
          podeGerenciarTenant,
        )
          ? [{ title: 'Gestão de Tenant (SaaS)', path: '/admin/tenant', icon: Building2 }]
          : []),
      ],
    },
  ]

  // Filter sections visible to current user's profile and hide sections with no visible items
  const visibleSections = sections
    .filter((sec) => sec.allowedProfiles.includes(perfil))
    .filter((sec) => sec.items.length > 0)

  const content = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-[#E0E0E0] select-none">
      {/* Brand & Logo Header */}
      <div>
        <div className="flex h-16 items-center justify-between px-3 border-b border-[#E0E0E0]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative shrink-0 flex items-center justify-center">
              <img
                src={TESLA_LOGO_URL}
                alt="Logotipo Tesla Mecatrônica"
                className="h-10 w-10 rounded-full object-cover shadow-sm border border-[#0D47A1]/20 bg-[#06152b]"
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-[14px] font-bold tracking-tight text-[#212121] leading-tight truncate">
                  Tesla Mecatrônica
                </span>
                <span className="text-[10.5px] font-semibold text-[#0D47A1] uppercase tracking-wider">
                  Gente e Gestão
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
          {visibleSections.map((section) => {
            const sectionColor = SECTION_COLORS[section.title] || '#757575'
            return (
              <div key={section.title} className="space-y-1">
                {!collapsed ? (
                  <div className="flex items-center gap-1.5 px-3 mb-2">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: sectionColor }}
                      aria-hidden="true"
                    />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#616161]">
                      {section.title}
                    </p>
                  </div>
                ) : (
                  <div className="flex justify-center py-1">
                    <span
                      className="inline-block h-1 w-4 rounded-full opacity-40"
                      style={{ backgroundColor: sectionColor }}
                      aria-hidden="true"
                    />
                  </div>
                )}
                {section.items.map((item) => {
                  const IconComponent = item.icon
                  const itemColor = item.color || MENU_ITEM_COLORS[item.path] || '#0D47A1'

                  const renderIcon = (isActive: boolean) => {
                    if (item.customIcon) {
                      return item.customIcon
                    }
                    if (!IconComponent) return null

                    // Quando ativo: utiliza azul institucional escuro #0D47A1 com peso destacado
                    // Quando inativo: exibe sua cor própria e harmônica
                    const currentColor = isActive ? '#0D47A1' : itemColor

                    return (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center transition-transform duration-150 group-hover:scale-110"
                        style={{ color: currentColor }}
                      >
                        <IconComponent
                          className="h-5 w-5 shrink-0"
                          strokeWidth={isActive ? 2.3 : 2}
                        />
                      </span>
                    )
                  }

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
                      {({ isActive }) => (
                        <>
                          {renderIcon(isActive)}
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </>
                      )}
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
            )
          })}
        </div>
      </div>

      {/* Footer info in sidebar */}
      {!collapsed && (
        <div className="p-4 border-t border-[#E0E0E0] bg-[#FAFAFA] text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <img
              src={TESLA_LOGO_URL}
              alt="Logo"
              className="h-3.5 w-3.5 rounded-full object-cover opacity-80"
            />
            <p className="text-[11px] text-[#757575] leading-snug font-medium">Tesla Mecatrônica</p>
          </div>
          <p className="text-[10px] font-medium text-[#0D47A1]" title="Versão do Sistema">
            Tesla RH v0.0.42
          </p>
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
