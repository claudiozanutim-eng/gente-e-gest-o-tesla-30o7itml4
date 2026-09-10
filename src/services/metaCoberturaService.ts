import pb from '@/lib/pocketbase/client'
import { MetaCoberturaDepartamento } from '@/types'
import { logAuditoriaService } from '@/services/api'

export const metaCoberturaService = {
  /**
   * Retorna todas as metas de cobertura do tenant.
   */
  async getMetasTenant(tenantId: string): Promise<MetaCoberturaDepartamento[]> {
    if (!tenantId) return []
    try {
      const records = await pb
        .collection('meta_cobertura_departamento')
        .getFullList<MetaCoberturaDepartamento>({
          filter: `tenant_id = "${tenantId}"`,
          sort: 'departamento',
        })
      return records
    } catch (err) {
      console.warn('Erro ao carregar metas de cobertura:', err)
      return []
    }
  },

  /**
   * Salva ou atualiza a meta de cobertura para um departamento.
   */
  async salvarMeta(params: {
    tenantId: string
    departamento: string
    metaPercentual: number
    userId?: string
  }): Promise<MetaCoberturaDepartamento> {
    const { tenantId, departamento, metaPercentual, userId } = params
    const safeMeta = Math.min(100, Math.max(0, Math.round(metaPercentual)))

    // Procurar registro existente para este tenant e departamento
    const existentes = await pb
      .collection('meta_cobertura_departamento')
      .getFullList<MetaCoberturaDepartamento>({
        filter: `tenant_id = "${tenantId}" && departamento = "${departamento}"`,
      })

    let record: MetaCoberturaDepartamento
    let acao: string

    if (existentes.length > 0) {
      const id = existentes[0].id
      record = await pb
        .collection('meta_cobertura_departamento')
        .update<MetaCoberturaDepartamento>(id, {
          meta_percentual: safeMeta,
          atualizado_por: userId || null,
        })
      acao = 'ATUALIZAR_META_COBERTURA'
    } else {
      record = await pb
        .collection('meta_cobertura_departamento')
        .create<MetaCoberturaDepartamento>({
          tenant_id: tenantId,
          departamento,
          meta_percentual: safeMeta,
          atualizado_por: userId || null,
        })
      acao = 'CRIAR_META_COBERTURA'
    }

    if (userId) {
      logAuditoriaService
        .registrarLog({
          tenant_id: tenantId,
          user_id: userId,
          acao,
          entidade: 'meta_cobertura_departamento',
          entidade_id: record.id,
          dados_json: {
            departamento,
            meta_percentual: safeMeta,
          },
        })
        .catch(() => {})
    }

    return record
  },
}
