import pb from '@/lib/pocketbase/client'
import {
  PermissaoUsuario,
  PermissoesFlags,
  PermissaoMenuKey,
  FlagPermissaoEstado,
  UserPerfil,
} from '@/types'
import { logAuditoriaService } from '@/services/api'

export interface ItemPermissaoConfig {
  key: PermissaoMenuKey
  label: string
  descricao: string
  grupo: 'rh' | 'gestao_tempo' | 'administracao' | 'talentos'
  rota: string
  /**
   * Perfis que, por padrão, já têm acesso a este item
   */
  perfisPadrao: UserPerfil[]
  /**
   * Apenas admin geral pode conceder ou editar esta flag
   */
  apenasAdminGeral?: boolean
}

/**
 * Catálogo canônico dos itens e alçadas de permissão do sistema Gente e Gestão Tesla.
 * Mapeia as rotas e grupos do menu lateral corporativo.
 */
export const ITENS_PERMISSAO_CATALOGO: ItemPermissaoConfig[] = [
  // 1. Recursos Humanos & Gestão de Pessoas
  {
    key: 'dashboard_rh',
    label: 'Dashboard / Painel RH',
    descricao: 'Acesso ao painel principal do RH com indicadores gerais e atalhos rápidos',
    grupo: 'rh',
    rota: '/dashboard',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'comunicados',
    label: 'Comunicados Corporativos',
    descricao: 'Criação, publicação, segmentação e gestão de comunicados internos',
    grupo: 'rh',
    rota: '/comunicados/gestao',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'alteracoes_cadastrais',
    label: 'Alterações Cadastrais (Aprovação)',
    descricao:
      'Análise, aprovação ou reprovação de solicitações cadastrais enviadas pelos colaboradores',
    grupo: 'rh',
    rota: '/alteracoes/pendentes',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'colaboradores',
    label: 'Base de Colaboradores',
    descricao: 'Consulta e gestão completa das fichas cadastrais dos colaboradores',
    grupo: 'rh',
    rota: '/colaboradores',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'documentos',
    label: 'Gestão de Documentos',
    descricao: 'Repositório corporativo, categorias e upload de documentos da empresa',
    grupo: 'rh',
    rota: '/documentos',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'pendencias_docs',
    label: 'Pendências Documentais',
    descricao: 'Monitoramento de documentos obrigatórios pendentes de entrega ou ciência',
    grupo: 'rh',
    rota: '/pendencias-documentais',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'beneficios',
    label: 'Gestão de Benefícios',
    descricao: 'Manutenção de pacotes, planos de saúde, vales e benefícios do time',
    grupo: 'rh',
    rota: '/beneficios/gestao',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'atestados',
    label: 'Validação de Atestados',
    descricao: 'Validação médica, homologação e abono de faltas por atestados',
    grupo: 'rh',
    rota: '/atestados/validacao',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'ferias_aprovacoes',
    label: 'Aprovações de Férias',
    descricao: 'Análise e homologação de pedidos de férias da equipe e colaboradores',
    grupo: 'rh',
    rota: '/ferias/aprovacoes',
    perfisPadrao: ['gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'ferias_coletivo',
    label: 'Espelho de Férias Coletivo',
    descricao: 'Visão panorâmica de cobertura anual e planejamento de férias por departamento',
    grupo: 'rh',
    rota: '/ferias/coletivo',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'avaliacoes_admin',
    label: 'Avaliação de Desempenho (Admin/Ciclos)',
    descricao: 'Parametrização de ciclos de avaliação, competências e matrizes 9-box',
    grupo: 'rh',
    rota: '/avaliacoes/admin',
    perfisPadrao: ['admin_rh', 'admin'],
  },
  {
    key: 'folha',
    label: 'Gestão da Folha de Pagamento',
    descricao: 'Lançamentos periódicos, pontuais, horas extras e fechamento de folha',
    grupo: 'rh',
    rota: '/folha/gestao',
    perfisPadrao: ['admin_rh', 'admin'],
  },
  {
    key: 'pesquisa_clima',
    label: 'Pesquisa de Clima Organizacional',
    descricao: 'Criação e monitoramento de pesquisas e métricas de satisfação',
    grupo: 'rh',
    rota: '/pesquisa-clima',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'relatorios',
    label: 'Relatórios e Exportações',
    descricao: 'Emissão e download de relatórios em Excel/PDF dos subsistemas de RH',
    grupo: 'rh',
    rota: '/relatorios',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },

  // 2. Gestão do Tempo e Escalas
  {
    key: 'ponto_gestao',
    label: 'Gestão de Ponto da Equipe',
    descricao: 'Espelho de ponto, ajustes manuais e auditoria de batidas de ponto',
    grupo: 'gestao_tempo',
    rota: '/ponto/gestao',
    perfisPadrao: ['gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'escalas',
    label: 'Gestão de Escalas de Trabalho',
    descricao: 'Criação e alocação de escalas padrão e regimes especiais (ex.: 12x36)',
    grupo: 'gestao_tempo',
    rota: '/escalas',
    perfisPadrao: ['admin_rh', 'admin'],
  },
  {
    key: 'banco_horas_fechamento',
    label: 'Fechamento de Banco de Horas',
    descricao: 'Fechamento de competências mensais e apuração de saldos de banco de horas',
    grupo: 'gestao_tempo',
    rota: '/banco-horas/fechamento',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },

  // 3. Gestão de Talentos & Liderança
  {
    key: 'portal_gestor',
    label: 'Portal do Gestor',
    descricao: 'Visão consolidada do líder: métricas da equipe, aprovações e onboarding',
    grupo: 'talentos',
    rota: '/portal-gestor',
    perfisPadrao: ['gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'minha_equipe',
    label: 'Minha Equipe',
    descricao: 'Painel de colaboradores subordinados para o gestor imediato',
    grupo: 'talentos',
    rota: '/minha-equipe',
    perfisPadrao: ['gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'vagas',
    label: 'Recrutamento & Vagas',
    descricao: 'Abertura e acompanhamento de requisições de vagas',
    grupo: 'talentos',
    rota: '/vagas',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'candidatos',
    label: 'Banco de Candidatos',
    descricao: 'Triagem de currículos e pipeline de seleção',
    grupo: 'talentos',
    rota: '/candidatos',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'estrutura',
    label: 'Estrutura Organizacional',
    descricao: 'Organograma e distribuição funcional dos setores',
    grupo: 'talentos',
    rota: '/estrutura',
    perfisPadrao: ['gestor', 'rh', 'admin_rh', 'admin'],
  },

  // 4. Administração & Governança
  {
    key: 'dashboard_financeiro',
    label: 'Dashboard Financeiro',
    descricao: 'Visão consolidada de custos de folha, horas extras e orçamentos do tenant',
    grupo: 'administracao',
    rota: '/financeiro',
    perfisPadrao: ['admin_rh', 'admin'],
  },
  {
    key: 'assistente_clt',
    label: 'Assistente CLT & Legislação',
    descricao: 'Consulta inteligente de artigos e conformidade da CLT',
    grupo: 'administracao',
    rota: '/dashboard', // Integrado no Dashboard RH
    perfisPadrao: ['admin_rh', 'admin'],
  },
  {
    key: 'logs_auditoria',
    label: 'Logs de Auditoria',
    descricao: 'Trilha completa de auditoria e conformidade de ações no tenant',
    grupo: 'administracao',
    rota: '/admin/logs',
    perfisPadrao: ['admin_rh', 'admin'],
  },
  {
    key: 'configuracoes_empresa',
    label: 'Configurações da Empresa',
    descricao: 'Dados cadastrais da pessoa jurídica, CNPJ, razão social e regimes',
    grupo: 'administracao',
    rota: '/admin/configuracoes',
    perfisPadrao: ['admin'],
    apenasAdminGeral: true,
  },
  {
    key: 'usuarios_permissoes',
    label: 'Usuários e Permissões',
    descricao: 'Controle de contas, senhas, perfis de acesso e alçadas de liberação',
    grupo: 'administracao',
    rota: '/admin/usuarios',
    perfisPadrao: ['admin'],
    apenasAdminGeral: true,
  },
]

/**
 * Avalia se o usuário tem permissão para uma determinada funcionalidade/menu:
 * 1. Se houver flag 'liberado' -> TRUE (exceção concedida)
 * 2. Se houver flag 'bloqueado' -> FALSE (exceção bloqueada)
 * 3. Se 'padrao' ou ausente -> herda da lista `perfisPadrao` do item
 */
export function avaliarPermissaoItem(
  perfil: UserPerfil,
  flags: PermissoesFlags | undefined,
  itemKey: PermissaoMenuKey,
): boolean {
  const flag = flags?.[itemKey] || 'padrao'
  if (flag === 'liberado') return true
  if (flag === 'bloqueado') return false

  // Fallback: padrão do perfil
  const config = ITENS_PERMISSAO_CATALOGO.find((i) => i.key === itemKey)
  if (!config) return false
  return config.perfisPadrao.includes(perfil)
}

/**
 * Mapeamento entre caminhos de rota e suas respectivas chaves de permissão
 */
export const ROTA_PARA_CHAVE_MAP: Record<string, PermissaoMenuKey> = {
  '/dashboard': 'dashboard_rh',
  '/comunicados/gestao': 'comunicados',
  '/alteracoes/pendentes': 'alteracoes_cadastrais',
  '/colaboradores': 'colaboradores',
  '/documentos': 'documentos',
  '/pendencias-documentais': 'pendencias_docs',
  '/beneficios/gestao': 'beneficios',
  '/atestados/validacao': 'atestados',
  '/ferias/aprovacoes': 'ferias_aprovacoes',
  '/ferias/coletivo': 'ferias_coletivo',
  '/avaliacoes/admin': 'avaliacoes_admin',
  '/folha/gestao': 'folha',
  '/pesquisa-clima': 'pesquisa_clima',
  '/relatorios': 'relatorios',
  '/ponto/gestao': 'ponto_gestao',
  '/escalas': 'escalas',
  '/banco-horas/fechamento': 'banco_horas_fechamento',
  '/portal-gestor': 'portal_gestor',
  '/minha-equipe': 'minha_equipe',
  '/vagas': 'vagas',
  '/candidatos': 'candidatos',
  '/estrutura': 'estrutura',
  '/financeiro': 'dashboard_financeiro',
  '/admin/logs': 'logs_auditoria',
  '/admin/configuracoes': 'configuracoes_empresa',
  '/admin/usuarios': 'usuarios_permissoes',
}

export const permissaoUsuarioService = {
  /**
   * Busca as flags de permissão do usuário pelo ID
   */
  async getPermissaoPorUsuario(userId: string): Promise<PermissaoUsuario | null> {
    try {
      const records = await pb.collection('permissao_usuario').getList<PermissaoUsuario>(1, 1, {
        filter: `user_id = "${userId}"`,
      })
      return records.items[0] || null
    } catch (err) {
      console.warn(`Erro ao buscar permissões do usuário ${userId}:`, err)
      return null
    }
  },

  /**
   * Salva (cria ou atualiza) as flags de permissão de um usuário, registrando auditoria
   */
  async salvarFlagsPermissao(params: {
    tenantId: string
    userId: string
    targetUserName: string
    novasFlags: PermissoesFlags
    responsavelId: string
    responsavelNome: string
  }): Promise<PermissaoUsuario> {
    const { tenantId, userId, targetUserName, novasFlags, responsavelId, responsavelNome } = params

    // 1. Busca registro atual para comparar antes/depois no log de auditoria
    const atual = await this.getPermissaoPorUsuario(userId)
    const flagsAnteriores = atual?.flags_json || {}

    let savedRecord: PermissaoUsuario

    if (atual?.id) {
      savedRecord = await pb.collection('permissao_usuario').update<PermissaoUsuario>(atual.id, {
        flags_json: novasFlags,
        atualizado_por: responsavelId,
      })
    } else {
      savedRecord = await pb.collection('permissao_usuario').create<PermissaoUsuario>({
        tenant_id: tenantId,
        user_id: userId,
        flags_json: novasFlags,
        atualizado_por: responsavelId,
      })
    }

    // 2. Gravar em log_auditoria
    try {
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: responsavelId,
        acao: 'alteracao_permissoes',
        entidade: 'permissao_usuario',
        entidade_id: savedRecord.id,
        dados_json: {
          descricao: `Permissões de ${targetUserName} alteradas por ${responsavelNome}`,
          usuario_afetado_id: userId,
          usuario_afetado_nome: targetUserName,
          responsavel_id: responsavelId,
          responsavel_nome: responsavelNome,
          flags_anteriores: flagsAnteriores,
          flags_novas: novasFlags,
        },
      })
    } catch (auditErr) {
      console.warn('Erro ao gravar log de auditoria de permissões:', auditErr)
    }

    return savedRecord
  },
}
