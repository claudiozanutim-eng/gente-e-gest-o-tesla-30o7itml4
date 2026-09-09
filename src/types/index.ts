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
  nome_completo?: string
  cpf: string
  rg?: string
  titulo_eleitor?: string
  cnh?: string
  reservista?: string
  data_nascimento?: string
  estado_civil?: string
  endereco?: string
  telefone?: string
  email?: string
  pix?: string
  dados_bancarios?: string
  nome_pai?: string
  nome_mae?: string
  raca_cor?: string
  sexo?: string
  deficiencia?: string
  cargo: string
  departamento: string
  data_admissao: string
  jornada?: string
  local_trabalho?: string
  status: ColaboradorStatus
  foto_url?: string
  created: string
  updated: string
}

export interface Dependente {
  id: string
  colaborador_id: string
  tenant_id: string
  nome: string
  parentesco: string
  data_nascimento?: string
  created?: string
  updated?: string
}

export interface ContatoEmergencia {
  id: string
  colaborador_id: string
  tenant_id: string
  nome: string
  telefone: string
  parentesco: string
  created?: string
  updated?: string
}

export type SolicitacaoStatus = 'pendente' | 'aprovada' | 'rejeitada'

export interface SolicitacaoAlteracao {
  id: string
  colaborador_id: string
  tenant_id: string
  campo: string
  valor_antigo?: string
  valor_novo: string
  status: SolicitacaoStatus
  data_solicitacao?: string
  data_resposta?: string
  motivo_resposta?: string
  created?: string
  updated?: string
}

export interface LogAuditoria {
  id: string
  tenant_id: string
  user_id: string
  acao: string
  entidade: string
  entidade_id: string
  dados_json?: Record<string, unknown> | null
  data_hora?: string
  created?: string
  updated?: string
  expand?: {
    user_id?: AppUser
  }
}

export type ComunicadoCategoria = 'RH' | 'Empresa' | 'Qualidade' | 'Segurança' | 'Benefícios'
export type ComunicadoSegmentacaoTipo = 'todos' | 'setor' | 'funcao' | 'gestores'

export interface Comunicado {
  id: string
  tenant_id: string
  categoria: ComunicadoCategoria
  titulo: string
  conteudo: string
  segmentacao_tipo: ComunicadoSegmentacaoTipo
  segmentacao_valor?: string
  data_publicacao?: string
  created: string
  updated: string
}

export interface CategoriaConfig {
  label: ComunicadoCategoria
  color: string // Hex spec
  bgColor: string // Tailwind bg tint
  textColor: string // Tailwind text
  borderColor: string // Tailwind border
  badgeBg: string
}

export const COMUNICADO_CATEGORIAS: Record<ComunicadoCategoria, CategoriaConfig> = {
  RH: {
    label: 'RH',
    color: '#1E88E5',
    bgColor: 'bg-blue-50',
    textColor: 'text-[#1E88E5]',
    borderColor: 'border-[#1E88E5]',
    badgeBg: 'bg-[#1E88E5]',
  },
  Empresa: {
    label: 'Empresa',
    color: '#546E7A',
    bgColor: 'bg-slate-50',
    textColor: 'text-[#546E7A]',
    borderColor: 'border-[#546E7A]',
    badgeBg: 'bg-[#546E7A]',
  },
  Qualidade: {
    label: 'Qualidade',
    color: '#43A047',
    bgColor: 'bg-emerald-50',
    textColor: 'text-[#43A047]',
    borderColor: 'border-[#43A047]',
    badgeBg: 'bg-[#43A047]',
  },
  Segurança: {
    label: 'Segurança',
    color: '#FB8C00',
    bgColor: 'bg-amber-50',
    textColor: 'text-[#FB8C00]',
    borderColor: 'border-[#FB8C00]',
    badgeBg: 'bg-[#FB8C00]',
  },
  Benefícios: {
    label: 'Benefícios',
    color: '#8E24AA',
    bgColor: 'bg-purple-50',
    textColor: 'text-[#8E24AA]',
    borderColor: 'border-[#8E24AA]',
    badgeBg: 'bg-[#8E24AA]',
  },
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
