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
}
