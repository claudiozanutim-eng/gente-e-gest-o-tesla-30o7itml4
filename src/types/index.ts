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
  rh: '/dashboard',
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

export interface CategoriaDocumento {
  id: string
  tenant_id: string
  nome: string
  created?: string
  updated?: string
}

export interface Documento {
  id: string
  tenant_id: string
  categoria_id: string
  colaborador_id?: string
  nome: string
  versao?: string
  arquivo?: string
  arquivo_url?: string
  data_publicacao?: string
  obrigatorio: boolean
  created?: string
  updated?: string
  expand?: {
    categoria_id?: CategoriaDocumento
    colaborador_id?: Colaborador
  }
}

export interface CienciaDocumento {
  id: string
  tenant_id: string
  documento_id: string
  colaborador_id: string
  versao_ciente?: string
  data_hora: string
  ip_origem?: string
  created?: string
  updated?: string
  expand?: {
    documento_id?: Documento
    colaborador_id?: Colaborador
  }
}

export type AtestadoStatus = 'recebido' | 'em_analise' | 'validado' | 'necessita_correcao'

export interface Atestado {
  id: string
  collectionId: string
  collectionName: string
  tenant_id: string
  colaborador_id: string
  data_inicio: string
  qtd_dias: number
  anexo?: string
  anexo_url?: string
  status: AtestadoStatus
  comentario_rh?: string
  data_envio?: string
  data_resposta?: string
  created: string
  updated: string
  expand?: {
    colaborador_id?: Colaborador
    tenant_id?: Tenant
  }
}

export interface AtestadoStatusConfig {
  label: string
  color: string // Hex spec
  description: string
  bgLight: string
  textColor: string
  borderColor: string
}

export const ATESTADO_STATUS_MAP: Record<AtestadoStatus, AtestadoStatusConfig> = {
  recebido: {
    label: 'Recebido',
    color: '#FBC02D',
    description: 'Aguardando triagem',
    bgLight: 'bg-[#FFFDE7]',
    textColor: 'text-[#9A7B00]',
    borderColor: 'border-[#FBC02D]/40',
  },
  em_analise: {
    label: 'Em análise',
    color: '#1976D2',
    description: 'RH está revisando',
    bgLight: 'bg-[#E3F2FD]',
    textColor: 'text-[#1565C0]',
    borderColor: 'border-[#1976D2]/40',
  },
  validado: {
    label: 'Validado',
    color: '#388E3C',
    description: 'Aprovado',
    bgLight: 'bg-[#E8F5E9]',
    textColor: 'text-[#2E7D32]',
    borderColor: 'border-[#388E3C]/40',
  },
  necessita_correcao: {
    label: 'Necessita correção',
    color: '#D32F2F',
    description: 'Requer reenvio',
    bgLight: 'bg-[#FFEBEE]',
    textColor: 'text-[#C62828]',
    borderColor: 'border-[#D32F2F]/40',
  },
}

export type BeneficioTipo = 'vt' | 'vr' | 'va' | 'plano_saude' | 'seguro_vida' | 'plano_odonto'

export interface Beneficio {
  id: string
  tenant_id: string
  tipo: BeneficioTipo
  descricao?: string
  created?: string
  updated?: string
}

export interface DetalhesBeneficio {
  // Gerais / cartões / transporte
  operadora?: string
  plano?: string
  carteirinha?: string
  rede_credenciada?: string
  acomodacao?: string
  abrangencia?: string
  carencia_restante?: string
  contato_emergencia?: string
  dependentes_inclusos?: string[]
  // VT / VR / VA
  tipo_transporte?: string
  numero_cartao?: string
  dias_uteis?: number
  tarifa_diaria?: number
  linha_habitual?: string
  bandeira?: string
  valor_diario?: number
  cartao_final?: string
  recarga_dia?: string
  cobertura?: string
  // Seguro de Vida
  seguradora?: string
  apolice?: string
  valor_cobertura?: number
  cobertura_morte?: string
  cobertura_invalidez?: string
  assistencia_funeral?: string
  documento_beneficiario_url?: string
  documento_beneficiario_nome?: string
  [key: string]: unknown
}

export interface ColaboradorBeneficio {
  id: string
  tenant_id: string
  colaborador_id: string
  beneficio_id: string
  valor?: number
  detalhes_json?: DetalhesBeneficio
  created?: string
  updated?: string
  expand?: {
    colaborador_id?: Colaborador
    beneficio_id?: Beneficio
    tenant_id?: Tenant
  }
}

export interface BeneficioTipoConfig {
  tipo: BeneficioTipo
  nome: string
  emoji: string
  categoria: string
  cor: string // Hex spec
  bgLight: string
  badgeBg: string
  badgeText: string
  descricaoPadrao: string
}

export const BENEFICIOS_CONFIG: Record<BeneficioTipo, BeneficioTipoConfig> = {
  vt: {
    tipo: 'vt',
    nome: 'Vale Transporte',
    emoji: '🚌',
    categoria: 'Mobilidade',
    cor: '#0288D1',
    bgLight: 'bg-[#E1F5FE]',
    badgeBg: 'bg-[#E1F5FE]',
    badgeText: 'text-[#0277BD]',
    descricaoPadrao: 'Auxílio deslocamento diário residência / trabalho.',
  },
  vr: {
    tipo: 'vr',
    nome: 'Vale Refeição',
    emoji: '🍽️',
    categoria: 'Alimentação',
    cor: '#E65100',
    bgLight: 'bg-[#FFF3E0]',
    badgeBg: 'bg-[#FFF3E0]',
    badgeText: 'text-[#E65100]',
    descricaoPadrao: 'Crédito diário para almoço e refeições.',
  },
  va: {
    tipo: 'va',
    nome: 'Vale Alimentação',
    emoji: '🛒',
    categoria: 'Alimentação',
    cor: '#2E7D32',
    bgLight: 'bg-[#E8F5E9]',
    badgeBg: 'bg-[#E8F5E9]',
    badgeText: 'text-[#2E7D32]',
    descricaoPadrao: 'Crédito mensal para supermercados e compras.',
  },
  plano_saude: {
    tipo: 'plano_saude',
    nome: 'Plano de Saúde',
    emoji: '🏥',
    categoria: 'Saúde & Bem-estar',
    cor: '#D32F2F',
    bgLight: 'bg-[#FFEBEE]',
    badgeBg: 'bg-[#FFEBEE]',
    badgeText: 'text-[#C62828]',
    descricaoPadrao: 'Assistência médica hospitalar e ambulatorial corporativa.',
  },
  seguro_vida: {
    tipo: 'seguro_vida',
    nome: 'Seguro de Vida',
    emoji: '🛡️',
    categoria: 'Proteção Familiar',
    cor: '#0D47A1',
    bgLight: 'bg-[#E8EEF7]',
    badgeBg: 'bg-[#E8EEF7]',
    badgeText: 'text-[#0D47A1]',
    descricaoPadrao: 'Apólice de seguro de vida em grupo e amparo familiar.',
  },
  plano_odonto: {
    tipo: 'plano_odonto',
    nome: 'Plano Odontológico',
    emoji: '🦷',
    categoria: 'Saúde Bucal',
    cor: '#00897B',
    bgLight: 'bg-[#E0F2F1]',
    badgeBg: 'bg-[#E0F2F1]',
    badgeText: 'text-[#00695C]',
    descricaoPadrao: 'Consultas odontológicas, profilaxia e tratamentos gerais.',
  },
}

// ==========================================
// MÓDULO: AVALIAÇÃO DE DESEMPENHO (PROMPT 13)
// ==========================================

export type CicloAvaliacaoStatus = 'pendente' | 'em_andamento' | 'concluido'
export type CompetenciaTipo = 'geral' | 'especifica'
export type TipoAvaliador = 'principal' | 'apoio'
export type AvaliacaoStatus = 'pendente' | 'concluida'

export interface CicloAvaliacao {
  id: string
  tenant_id: string
  nome: string
  data_inicio: string
  data_fim: string
  status: CicloAvaliacaoStatus
  created?: string
  updated?: string
}

export interface Competencia {
  id: string
  tenant_id: string
  nome: string
  tipo: CompetenciaTipo
  peso?: number
  descricao?: string
  nota_esperada?: number
  created?: string
  updated?: string
}

export interface Avaliacao {
  id: string
  ciclo_id: string
  colaborador_id: string
  avaliador_id: string
  tipo_avaliador: TipoAvaliador
  peso: number
  status: AvaliacaoStatus
  comentario?: string
  nota_final?: number
  data_avaliacao?: string
  created?: string
  updated?: string
  expand?: {
    ciclo_id?: CicloAvaliacao
    colaborador_id?: Colaborador
    avaliador_id?: Colaborador
  }
}

export interface NotaCompetencia {
  id: string
  avaliacao_id: string
  competencia_id: string
  nota: number
  comentario?: string
  created?: string
  updated?: string
  expand?: {
    competencia_id?: Competencia
    avaliacao_id?: Avaliacao
  }
}

export const CICLO_STATUS_CONFIG: Record<
  CicloAvaliacaoStatus,
  { label: string; bg: string; text: string; border: string; dotColor: string }
> = {
  pendente: {
    label: 'Pendente',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dotColor: '#9E9E9E',
  },
  em_andamento: {
    label: 'Em Andamento',
    bg: 'bg-blue-50',
    text: 'text-[#0D47A1]',
    border: 'border-[#0D47A1]/30',
    dotColor: '#0D47A1',
  },
  concluido: {
    label: 'Concluído',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    dotColor: '#2E7D32',
  },
}

// ==========================================
// MÓDULO: CONTROLE DE PONTO E ESCALAS (PROMPT 14)
// ==========================================

export type RegistroPontoTipo = 'entrada' | 'saida_almoco' | 'volta_almoco' | 'saida'

export interface RegistroPonto {
  id: string
  tenant_id: string
  colaborador_id: string
  data_hora: string
  tipo: RegistroPontoTipo
  origem?: string
  created?: string
  updated?: string
  expand?: {
    colaborador_id?: Colaborador
    tenant_id?: Tenant
  }
}

export interface EscalaTrabalho {
  id: string
  tenant_id: string
  nome: string
  horario_inicio: string // "08:00"
  horario_fim: string // "17:00"
  dias_semana: string // "seg,ter,qua,qui,sex"
  created?: string
  updated?: string
}

export interface ColaboradorEscala {
  id: string
  tenant_id: string
  colaborador_id: string
  escala_id: string
  data_inicio: string
  data_fim?: string
  created?: string
  updated?: string
  expand?: {
    colaborador_id?: Colaborador
    escala_id?: EscalaTrabalho
  }
}

export interface PontoTipoConfig {
  tipo: RegistroPontoTipo
  label: string
  descricao: string
  corHex: string
  bgClass: string
  borderClass: string
  textClass: string
  btnClass: string
  badgeClass: string
}

export const REGISTRO_PONTO_CONFIG: Record<RegistroPontoTipo, PontoTipoConfig> = {
  entrada: {
    tipo: 'entrada',
    label: 'Entrada',
    descricao: 'Início da jornada de trabalho',
    corHex: '#2E7D32',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-300',
    textClass: 'text-emerald-700',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
  saida_almoco: {
    tipo: 'saida_almoco',
    label: 'Saída Almoço',
    descricao: 'Início do intervalo intrajornada',
    corHex: '#E65100',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-300',
    textClass: 'text-amber-700',
    btnClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-700/20',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
  },
  volta_almoco: {
    tipo: 'volta_almoco',
    label: 'Volta Almoço',
    descricao: 'Retorno do intervalo de refeição',
    corHex: '#0288D1',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-300',
    textClass: 'text-sky-700',
    btnClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-700/20',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-300',
  },
  saida: {
    tipo: 'saida',
    label: 'Saída',
    descricao: 'Encerramento da jornada diária',
    corHex: '#C62828',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-300',
    textClass: 'text-rose-700',
    btnClass: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-700/20',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
  },
}
