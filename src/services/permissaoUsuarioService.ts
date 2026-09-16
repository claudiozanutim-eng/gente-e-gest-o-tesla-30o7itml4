import pb from '@/lib/pocketbase/client'
import {
  PermissaoUsuario,
  PermissoesFlags,
  PermissaoMenuKey,
  FlagPermissaoEstado,
  UserPerfil,
} from '@/types'
import { logAuditoriaService } from '@/services/api'

export type GrupoPermissao = 'talentos' | 'pessoas' | 'tempo' | 'administracao'

export interface ItemPermissaoConfig {
  key: PermissaoMenuKey
  label: string
  descricao: string
  grupo: GrupoPermissao
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
 * Organizado estritamente pelos 3 pilares corporativos + grupo de Administração da sidebar:
 * 1. Gestão de Talentos
 * 2. Gestão de Pessoas
 * 3. Gestão do Tempo
 * 4. Administração
 */
export const ITENS_PERMISSAO_CATALOGO: ItemPermissaoConfig[] = [
  // ==========================================
  // PILAR 1: GESTÃO DE TALENTOS
  // ==========================================
  {
    key: 'vagas',
    label: 'Vagas & Recrutamento',
    descricao: 'Abertura, acompanhamento e divulgação de vagas e requisições de pessoal',
    grupo: 'talentos',
    rota: '/vagas',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'candidatos',
    label: 'Banco de Candidatos',
    descricao: 'Triagem de currículos, etapas do processo seletivo e pipeline de talentos',
    grupo: 'talentos',
    rota: '/candidatos',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'portal_gestor',
    label: 'Portal do Gestor',
    descricao: 'Painel do líder com métricas da equipe direta, onboarding e aprovações rápidas',
    grupo: 'talentos',
    rota: '/portal-gestor',
    perfisPadrao: ['gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'minha_equipe',
    label: 'Minha Equipe',
    descricao: 'Visão dos liderados imediatos, fichas operacionais e avaliações de time',
    grupo: 'talentos',
    rota: '/minha-equipe',
    perfisPadrao: ['gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'estrutura',
    label: 'Estrutura Organizacional',
    descricao: 'Organograma empresarial, departamentos, cargos e hierarquia funcional',
    grupo: 'talentos',
    rota: '/estrutura',
    perfisPadrao: ['gestor', 'rh', 'admin_rh', 'admin'],
  },

  // ==========================================
  // PILAR 2: GESTÃO DE PESSOAS
  // ==========================================
  {
    key: 'niko_rh',
    label: 'NIKO RH — Assistente Virtual',
    descricao:
      'Assistente inteligente nativo especializado em CLT, cultura Tesla e direitos dos colaboradores',
    grupo: 'pessoas',
    rota: '/niko-rh',
    perfisPadrao: ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'colaboradores',
    label: 'Colaboradores (Base Geral)',
    descricao: 'Ficha cadastral completa, dependentes, documentos e histórico funcional',
    grupo: 'pessoas',
    rota: '/colaboradores',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'folha',
    label: 'Gestão da Folha de Pagamento',
    descricao: 'Lançamentos periódicos, pontuais, horas extras, adicionais e fechamento',
    grupo: 'pessoas',
    rota: '/folha/gestao',
    perfisPadrao: ['admin_rh', 'admin'],
  },
  {
    key: 'comunicados',
    label: 'Comunicados Corporativos',
    descricao: 'Publicação, segmentação por setor/função e gestão de comunicados internos',
    grupo: 'pessoas',
    rota: '/comunicados/gestao',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'alteracoes_cadastrais',
    label: 'Alterações Cadastrais (Aprovação)',
    descricao: 'Aprovação ou reprovação de solicitações de alteração de dados dos colaboradores',
    grupo: 'pessoas',
    rota: '/alteracoes/pendentes',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'avaliacoes_admin',
    label: 'Avaliações Admin (Ciclos & Matriz)',
    descricao: 'Configuração de ciclos de avaliação, competências, metas e matriz 9-box',
    grupo: 'pessoas',
    rota: '/avaliacoes/admin',
    perfisPadrao: ['admin_rh', 'admin'],
  },
  {
    key: 'pesquisa_clima',
    label: 'Pesquisa de Clima Organizacional',
    descricao: 'Criação, aplicação de questionários de clima, eNPS e relatórios de satisfação',
    grupo: 'pessoas',
    rota: '/pesquisa-clima',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'pendencias_docs',
    label: 'Pendências Documentais',
    descricao: 'Acompanhamento de documentos obrigatórios pendentes de entrega ou assinatura',
    grupo: 'pessoas',
    rota: '/pendencias-documentais',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'documentos',
    label: 'Gestão de Documentos',
    descricao: 'Repositório corporativo, categorias, políticas da empresa e upload de arquivos',
    grupo: 'pessoas',
    rota: '/documentos',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'beneficios',
    label: 'Gestão de Benefícios',
    descricao: 'Controle de planos de saúde, vales alimentação/refeição, transporte e seguros',
    grupo: 'pessoas',
    rota: '/beneficios/gestao',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'atestados',
    label: 'Validação de Atestados',
    descricao: 'Recepção, perícia do RH, homologação de atestados médicos e abono de faltas',
    grupo: 'pessoas',
    rota: '/atestados/validacao',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'ferias_aprovacoes',
    label: 'Aprovações de Férias',
    descricao: 'Análise, aprovação e homologação das solicitações de férias dos colaboradores',
    grupo: 'pessoas',
    rota: '/ferias/aprovacoes',
    perfisPadrao: ['gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'ferias',
    label: 'Férias (Solicitação / Saldo)',
    descricao: 'Módulo de férias do colaborador, saldo de dias adquiridos e pedidos de gozo',
    grupo: 'pessoas',
    rota: '/ferias',
    perfisPadrao: ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'ferias_coletivo',
    label: 'Férias Coletivas / Espelho Calendário',
    descricao: 'Planejamento panorâmico, metas de cobertura anual e calendário coletivo',
    grupo: 'pessoas',
    rota: '/ferias/coletivo',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'relatorios',
    label: 'Relatórios & Exportações',
    descricao: 'Extração e download de relatórios em Excel e PDF de todos os subsistemas de RH',
    grupo: 'pessoas',
    rota: '/relatorios',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },

  // ==========================================
  // PILAR 3: GESTÃO DO TEMPO
  // ==========================================
  {
    key: 'ponto_colaborador',
    label: 'Meu Ponto (Registro & Espelho)',
    descricao: 'Registro diário de ponto, batidas, justificativas e espelho individual',
    grupo: 'tempo',
    rota: '/ponto',
    perfisPadrao: ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'banco_horas',
    label: 'Banco de Horas (Extrato & Saldo)',
    descricao: 'Extrato de créditos, débitos e solicitações de compensação do colaborador',
    grupo: 'tempo',
    rota: '/banco-horas',
    perfisPadrao: ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'banco_horas_fechamento',
    label: 'Fechamento de Banco de Horas',
    descricao: 'Apuração mensal de saldos de banco de horas, quitação e fechamento contábil',
    grupo: 'tempo',
    rota: '/banco-horas/fechamento',
    perfisPadrao: ['rh', 'admin_rh', 'admin'],
  },
  {
    key: 'ponto_gestao',
    label: 'Gestão de Ponto da Equipe',
    descricao: 'Tratamento de exceções, espelho geral de ponto e auditoria de marcações',
    grupo: 'tempo',
    rota: '/ponto/gestao',
    perfisPadrao: ['gestor', 'rh', 'admin_rh', 'admin'],
  },
  {
    key: 'escalas',
    label: 'Escalas de Trabalho',
    descricao: 'Parametrização de jornadas padrão, turnos e regimes especiais (ex.: 12x36)',
    grupo: 'tempo',
    rota: '/escalas',
    perfisPadrao: ['admin_rh', 'admin'],
  },

  // ==========================================
  // GRUPO: ADMINISTRAÇÃO & GOVERNANÇA
  // ==========================================
  {
    key: 'dashboard_financeiro',
    label: 'Dashboard Financeiro',
    descricao: 'Visão consolidada de provisão de folha, custos de horas extras e orçamentos',
    grupo: 'administracao',
    rota: '/financeiro',
    perfisPadrao: ['admin_rh', 'admin'],
  },
  {
    key: 'configuracoes_empresa',
    label: 'Configurações da Empresa',
    descricao: 'Dados cadastrais da pessoa jurídica, CNPJ, razão social, logotipo e regimes',
    grupo: 'administracao',
    rota: '/admin/configuracoes',
    perfisPadrao: ['admin'],
    apenasAdminGeral: true,
  },
  {
    key: 'configuracoes_email',
    label: 'Configurações de E-mail (SMTP)',
    descricao: 'Parâmetros do servidor SMTP para disparo de e-mails transacionais e notificações',
    grupo: 'administracao',
    rota: '/admin/email',
    perfisPadrao: ['admin'],
    apenasAdminGeral: true,
  },
  {
    key: 'usuarios_permissoes',
    label: 'Usuários e Permissões',
    descricao: 'Gestão de contas, redefinição de senhas, perfis e flags individuais de acesso',
    grupo: 'administracao',
    rota: '/admin/usuarios',
    perfisPadrao: ['admin', 'admin_rh'],
    apenasAdminGeral: false, // Admin RH pode gerenciar usuários, mas bandeiras marcadas com apenasAdminGeral ficam com cadeado
  },
  {
    key: 'logs_auditoria',
    label: 'Logs de Auditoria',
    descricao: 'Trilha completa de auditoria, conformidade e registro de ações dos operadores',
    grupo: 'administracao',
    rota: '/admin/logs',
    perfisPadrao: ['admin_rh', 'admin'],
  },
  {
    key: 'gestao_tenant',
    label: 'Gestão de Tenant (SaaS)',
    descricao: 'Configuração avançada do tenant, planos e recursos do SaaS corporativo',
    grupo: 'administracao',
    rota: '/admin/tenant',
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
  // Pilar 1: Gestão de Talentos
  '/vagas': 'vagas',
  '/candidatos': 'candidatos',
  '/portal-gestor': 'portal_gestor',
  '/minha-equipe': 'minha_equipe',
  '/estrutura': 'estrutura',

  // Pilar 2: Gestão de Pessoas
  '/niko-rh': 'niko_rh',
  '/colaboradores': 'colaboradores',
  '/folha/gestao': 'folha',
  '/comunicados/gestao': 'comunicados',
  '/alteracoes/pendentes': 'alteracoes_cadastrais',
  '/avaliacoes/admin': 'avaliacoes_admin',
  '/pesquisa-clima': 'pesquisa_clima',
  '/pendencias-documentais': 'pendencias_docs',
  '/documentos': 'documentos',
  '/beneficios/gestao': 'beneficios',
  '/atestados/validacao': 'atestados',
  '/ferias/aprovacoes': 'ferias_aprovacoes',
  '/ferias': 'ferias',
  '/minhas-ferias': 'ferias',
  '/ferias/coletivo': 'ferias_coletivo',
  '/relatorios': 'relatorios',

  // Pilar 3: Gestão do Tempo
  '/ponto': 'ponto_colaborador',
  '/banco-horas': 'banco_horas',
  '/banco-horas/fechamento': 'banco_horas_fechamento',
  '/ponto/gestao': 'ponto_gestao',
  '/escalas': 'escalas',

  // Pilar 4: Administração
  '/financeiro': 'dashboard_financeiro',
  '/admin/configuracoes': 'configuracoes_empresa',
  '/admin': 'configuracoes_empresa',
  '/admin/email': 'configuracoes_email',
  '/admin/usuarios': 'usuarios_permissoes',
  '/admin/logs': 'logs_auditoria',
  '/admin/tenant': 'gestao_tenant',

  // Atalhos e Complementares
  '/dashboard': 'dashboard_rh',
  '/documentos-importantes': 'documentos_importantes',
  '/demonstrativo': 'demonstrativo',
  '/beneficios': 'beneficios_colaborador',
  '/avaliacoes': 'minhas_avaliacoes',
  '/atestados': 'atestados',
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
