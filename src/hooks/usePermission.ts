import { useAuth } from '@/context/AuthContext'
import { UserPerfil } from '@/types'

/**
 * Hierarquia dos 5 perfis de acesso:
 * Admin Geral (4) > Administrador de RH (3) > RH Operacional (2) > Gestor (1) > Colaborador (0)
 */
export const HIERARQUIA_PERFIL: Record<UserPerfil, number> = {
  colaborador: 0,
  gestor: 1,
  rh: 2,
  admin_rh: 3,
  admin: 4,
}

/**
 * Mapeamento granular de permissões por perfil no sistema Gente e Gestão Tesla.
 */
export interface PermissoesUsuario {
  // Edição Direta de Perfil de Colaboradores (RH, Admin RH e Admin Geral)
  podeEditarPerfilColaborador: boolean
  podeEditarCpfColaborador: boolean
  podeEditarAdmissaoStatusColaborador: boolean

  // Configurações do Tenant (Apenas Admin Geral)
  podeGerenciarTenant: boolean

  // Gestão de Usuários e Permissões (Apenas Admin Geral)
  podeGerenciarUsuarios: boolean

  // Logs de Auditoria (Admin RH e Admin Geral)
  podeVerLogsAuditoria: boolean

  // Folha de Pagamento - Lançamentos periódicos e pontuais (Admin RH e Admin Geral)
  podeGerenciarFolha: boolean

  // Escalas de Trabalho (Admin RH e Admin Geral)
  podeGerenciarEscalas: boolean

  // Ciclos de Avaliação e Competências (Admin RH e Admin Geral)
  podeConfigurarAvaliacoes: boolean

  // Assistente CLT (Admin RH e Admin Geral)
  podeAcessarAssistenteClt: boolean

  // Módulos Operacionais de RH (RH, Admin RH e Admin Geral)
  podeAcessarDashboardRH: boolean
  podeGerenciarColaboradores: boolean
  podePublicarComunicados: boolean
  podeValidarAtestados: boolean
  podeAprovarAlteracoesCadastrais: boolean
  podeGerenciarDocumentosCorporativos: boolean
  podeGerenciarBeneficios: boolean
  podeGerarRelatorios: boolean
  podeExportarRelatorios: boolean

  // Módulo de Gestão de Equipe (Gestor, RH, Admin RH e Admin Geral)
  podeAcessarGestaoPonto: boolean
  podeAprovarFeriasEquipe: boolean
  podeVerEquipe: boolean
  podeAvaliarEquipe: boolean

  // Portal Pessoal do Colaborador (Todos os 5 perfis)
  podeBaterPonto: boolean
  podeVerHolerite: boolean
  podeSolicitarFerias: boolean
  podeEnviarAtestado: boolean
  podeVerMeusDocumentos: boolean
  podeVerMeusBeneficios: boolean
  podeVerMinhasAvaliacoes: boolean
}

/**
 * Hook `usePermission` para validação declarativa e granular de permissões por perfil.
 */
export function usePermission() {
  const { user } = useAuth()
  const perfil: UserPerfil = user?.perfil || 'colaborador'
  const nivel = HIERARQUIA_PERFIL[perfil] ?? 0

  const hasPerfil = (perfilEsperado: UserPerfil): boolean => perfil === perfilEsperado

  const hasAnyPerfil = (perfisPermitidos: UserPerfil[]): boolean =>
    perfisPermitidos.includes(perfil)

  const hasMinPerfil = (perfilMinimo: UserPerfil): boolean => {
    const nivelMinimo = HIERARQUIA_PERFIL[perfilMinimo] ?? 0
    return nivel >= nivelMinimo
  }

  // Permissões granulares de acordo com a especificação do Prompt 17 e Prompt 18
  const permissoes: PermissoesUsuario = {
    // Edição Direta de Perfil do Colaborador (Prompt 18)
    podeEditarPerfilColaborador: perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeEditarCpfColaborador: perfil === 'admin',
    podeEditarAdmissaoStatusColaborador: perfil === 'admin_rh' || perfil === 'admin',

    // 1. Apenas Administrador Geral ('admin')
    podeGerenciarTenant: perfil === 'admin',
    podeGerenciarUsuarios: perfil === 'admin',

    // 2. Administrador de RH ('admin_rh') e Admin Geral ('admin')
    podeVerLogsAuditoria: perfil === 'admin_rh' || perfil === 'admin',
    podeGerenciarFolha: perfil === 'admin_rh' || perfil === 'admin',
    podeGerenciarEscalas: perfil === 'admin_rh' || perfil === 'admin',
    podeConfigurarAvaliacoes: perfil === 'admin_rh' || perfil === 'admin',
    podeAcessarAssistenteClt: perfil === 'admin_rh' || perfil === 'admin',

    // 3. RH Operacional ('rh'), Admin RH ('admin_rh') e Admin Geral ('admin')
    podeAcessarDashboardRH: perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeGerenciarColaboradores: perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podePublicarComunicados: perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeValidarAtestados: perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeAprovarAlteracoesCadastrais: perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeGerenciarDocumentosCorporativos:
      perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeGerenciarBeneficios: perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeGerarRelatorios: perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeExportarRelatorios: perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',

    // 4. Gestor ('gestor'), RH Operacional ('rh'), Admin RH ('admin_rh') e Admin Geral ('admin')
    podeAcessarGestaoPonto:
      perfil === 'gestor' || perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeAprovarFeriasEquipe:
      perfil === 'gestor' || perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeVerEquipe:
      perfil === 'gestor' || perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    podeAvaliarEquipe:
      perfil === 'gestor' || perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',

    // 5. Todos os 5 perfis
    podeBaterPonto: true,
    podeVerHolerite: true,
    podeSolicitarFerias: true,
    podeEnviarAtestado: true,
    podeVerMeusDocumentos: true,
    podeVerMeusBeneficios: true,
    podeVerMinhasAvaliacoes: true,
  }

  return {
    perfil,
    nivel,
    hasPerfil,
    hasAnyPerfil,
    hasMinPerfil,
    permissoes,
    // Permissões desempacotadas diretamente para acesso simplificado
    ...permissoes,
    // Atalhos semânticos comuns
    isAdminGeral: perfil === 'admin',
    isAdminRH: perfil === 'admin_rh',
    isRH: perfil === 'rh',
    isGestor: perfil === 'gestor',
    isColaborador: perfil === 'colaborador',
    // RH ou superior (RH, Admin RH ou Admin Geral)
    isRHOrAbove: perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin',
    // Admin RH ou superior (Admin RH ou Admin Geral)
    isAdminRHOrAbove: perfil === 'admin_rh' || perfil === 'admin',
    // Gestor ou superior
    isGestorOrAbove: perfil !== 'colaborador',
  }
}
