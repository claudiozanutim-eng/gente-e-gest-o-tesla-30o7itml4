import pb from '@/lib/pocketbase/client'
import { OrcamentoFolha } from '@/types'
import { logAuditoriaService } from '@/services/api'

export interface SalvarOrcamentoDTO {
  tenantId: string
  ano: number
  mes: number
  valorOrcadoFolha: number
  valorOrcadoBancoHoras?: number
  observacao?: string
  userId?: string
}

export const orcamentoFolhaService = {
  /**
   * Retorna os orçamentos cadastrados para o tenant.
   */
  async getOrcamentosTenant(tenantId: string): Promise<OrcamentoFolha[]> {
    if (!tenantId) return []
    try {
      const records = await pb.collection('orcamento_folha').getFullList<OrcamentoFolha>({
        filter: `tenant_id = "${tenantId}"`,
        sort: 'competencia',
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar orçamentos de folha:', err)
      return []
    }
  },

  /**
   * Busca um orçamento específico por competência (YYYY-MM).
   */
  async getOrcamentoPorCompetencia(
    tenantId: string,
    competencia: string,
  ): Promise<OrcamentoFolha | null> {
    if (!tenantId || !competencia) return null
    try {
      const records = await pb.collection('orcamento_folha').getFullList<OrcamentoFolha>({
        filter: `tenant_id = "${tenantId}" && competencia = "${competencia}"`,
      })
      return records.length > 0 ? records[0] : null
    } catch (err) {
      console.warn('Erro ao buscar orçamento por competência:', err)
      return null
    }
  },

  /**
   * Cria ou atualiza o orçamento de uma competência.
   */
  async salvarOrcamento(dto: SalvarOrcamentoDTO): Promise<OrcamentoFolha> {
    const {
      tenantId,
      ano,
      mes,
      valorOrcadoFolha,
      valorOrcadoBancoHoras = 0,
      observacao = '',
      userId,
    } = dto

    const safeValorFolha = Math.max(0, Math.round(valorOrcadoFolha * 100) / 100)
    const safeValorBanco = Math.max(0, Math.round((valorOrcadoBancoHoras || 0) * 100) / 100)
    const comp = `${ano}-${String(mes).padStart(2, '0')}`

    // Checar se já existe registro para a competência
    const existentes = await pb.collection('orcamento_folha').getFullList<OrcamentoFolha>({
      filter: `tenant_id = "${tenantId}" && competencia = "${comp}"`,
    })

    let record: OrcamentoFolha
    let acao: string

    if (existentes.length > 0) {
      const id = existentes[0].id
      record = await pb.collection('orcamento_folha').update<OrcamentoFolha>(id, {
        ano,
        mes,
        competencia: comp,
        valor_orcado_folha: safeValorFolha,
        valor_orcado_banco_horas: safeValorBanco,
        observacao,
        criado_por: userId || existentes[0].criado_por || null,
      })
      acao = 'ATUALIZAR_ORCAMENTO_FOLHA'
    } else {
      record = await pb.collection('orcamento_folha').create<OrcamentoFolha>({
        tenant_id: tenantId,
        ano,
        mes,
        competencia: comp,
        valor_orcado_folha: safeValorFolha,
        valor_orcado_banco_horas: safeValorBanco,
        observacao,
        criado_por: userId || null,
      })
      acao = 'CRIAR_ORCAMENTO_FOLHA'
    }

    if (userId) {
      logAuditoriaService
        .registrarLog({
          tenant_id: tenantId,
          user_id: userId,
          acao,
          entidade: 'orcamento_folha',
          entidade_id: record.id,
          dados_json: {
            competencia: comp,
            ano,
            mes,
            valor_orcado_folha: safeValorFolha,
            valor_orcado_banco_horas: safeValorBanco,
            observacao,
          },
        })
        .catch(() => {})
    }

    return record
  },

  /**
   * Verifica se o realizado da competência estourou (ou se aproxima ≥ 95%) do orçamento.
   * Dispara notificação in-app anti-spam (uma por competência e tipo) para admin_rh e admin do tenant
   * e registra log de auditoria.
   */
  async verificarAlertasOrcamento(params: {
    tenantId: string
    competencia: string // "YYYY-MM"
    realizadoFolha: number
    orcadoFolha: number
    userId?: string
  }): Promise<{ disparado: boolean; tipoAlerta?: 'estouro' | 'proximidade'; mensagem?: string }> {
    const { tenantId, competencia, realizadoFolha, orcadoFolha, userId } = params

    if (!tenantId || !competencia || orcadoFolha <= 0) {
      return { disparado: false }
    }

    const pctRealizado = (realizadoFolha / orcadoFolha) * 100
    const estourou = realizadoFolha > orcadoFolha
    const proximidade = !estourou && pctRealizado >= 95

    if (!estourou && !proximidade) {
      return { disparado: false }
    }

    const tipoAlerta: 'estouro' | 'proximidade' = estourou ? 'estouro' : 'proximidade'
    const tagAntiSpam = `[ORCAMENTO_${tipoAlerta.toUpperCase()}_${competencia}]`

    try {
      // Buscar usuários admin_rh e admin do tenant
      const admins = await pb.collection('users').getFullList({
        filter: `tenant_id = "${tenantId}" && (perfil = "admin_rh" || perfil = "admin")`,
      })

      if (admins.length === 0) {
        return { disparado: false }
      }

      // Checar se já foi gerada notificação desse tipo para essa competência neste tenant
      const notifsExistentes = await pb.collection('notificacao').getList(1, 1, {
        filter: `tenant_id = "${tenantId}" && link ~ "${tagAntiSpam}"`,
      })

      if (notifsExistentes.totalItems > 0) {
        // Anti-spam: já foi notificado
        return { disparado: false }
      }

      const formatMoeda = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

      const titulo = estourou
        ? `Orçamento estourado: competência ${competencia}`
        : `Aviso de orçamento próximo do limite: competência ${competencia}`

      const mensagem = estourou
        ? `Orçamento estourado: competência ${competencia} — realizado ${formatMoeda(
            realizadoFolha,
          )} excede o orçado ${formatMoeda(orcadoFolha)} (${pctRealizado.toFixed(1)}%).`
        : `Atenção: o realizado da competência ${competencia} (${formatMoeda(
            realizadoFolha,
          )}) atingiu ${pctRealizado.toFixed(1)}% do orçamento planejado (${formatMoeda(
            orcadoFolha,
          )}).`

      const linkComTag = `/financeiro?tag=${encodeURIComponent(tagAntiSpam)}`

      // Criar notificação para cada administrador
      await Promise.all(
        admins.map((admin) =>
          pb.collection('notificacao').create({
            tenant_id: tenantId,
            destinatario_id: admin.id,
            tipo: 'geral',
            titulo,
            mensagem,
            link: linkComTag,
            lida: false,
          }),
        ),
      )

      // Registrar em log de auditoria
      try {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: userId || admins[0].id,
          acao: estourou ? 'alerta_orcamento_estourado' : 'alerta_orcamento_proximidade',
          entidade: 'orcamento_folha',
          entidade_id: competencia,
          dados_json: {
            competencia,
            realizado: realizadoFolha,
            orcado: orcadoFolha,
            pct_consumo: pctRealizado,
            tipo_alerta: tipoAlerta,
            notificados_count: admins.length,
          },
        })
      } catch (logErr) {
        console.warn('Erro ao registrar log de auditoria do alerta de orçamento:', logErr)
      }

      return { disparado: true, tipoAlerta, mensagem }
    } catch (err) {
      console.warn('Erro ao verificar/disparar alertas de orçamento:', err)
      return { disparado: false }
    }
  },
}
