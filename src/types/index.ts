export type UserPerfil = 'colaborador' | 'gestor' | 'rh' | 'admin'

export type TenantPlano = 'basico' | 'pro' | 'enterprise'
export type TenantStatus = 'ativo' | 'inativo' | 'suspenso'
export type ColaboradorStatus = 'ativo' | 'inativo'

export interface Tenant {
  id: string
  razao_social: string
  cnpj: string
  plano: TenantPlano
  status: TenantStatus
  created: string
  updated: string
}

export interface AppUser {
  id: string
  email: string
  name: string
  perfil: UserPerfil
  tenant_id: string
  avatar?: string
  created: string
  updated: string
}

export interface Colaborador {
  id: string
  user_id?: string
  tenant_id: string
  nome: string
  cpf: string
  cargo: string
  departamento: string
  data_admissao: string
  status: ColaboradorStatus
  foto_url?: string
  created: string
  updated: string
}

export const PROFILE_HOME_MAP: Record<UserPerfil, string> = {
  colaborador: '/portal',
  gestor: '/dashboard-equipe',
  rh: '/dashboard-rh',
  admin: '/admin',
}

export const PROFILE_LABELS: Record<UserPerfil, string> = {
  colaborador: 'Colaborador',
  gestor: 'Gestor',
  rh: 'Recursos Humanos',
  admin: 'Administrador',
}

export const PROFILE_BADGE_COLORS: Record<
  UserPerfil,
  { bg: string; text: string; border: string }
> = {
  colaborador: { bg: 'bg-[#E8EEF7]', text: 'text-[#1565C0]', border: 'border-[#1565C0]/30' },
  gestor: { bg: 'bg-[#F3E5F5]', text: 'text-[#6A1B9A]', border: 'border-[#6A1B9A]/30' },
  rh: { bg: 'bg-[#E0F2F1]', text: 'text-[#00695C]', border: 'border-[#00695C]/30' },
  admin: { bg: 'bg-[#FFEBEE]', text: 'text-[#C62828]', border: 'border-[#C62828]/30' },
}
