import pb from '@/lib/pocketbase/client'
import { HistoricoFuncao, HistoricoFuncaoOrigem } from '@/types'

export interface CriarHistoricoFuncaoDTO {
  tenant_id: string
  colaborador_id: string
  cargo: string
  departamento?: string
  data_inicio: string
  data_fim?: string | null
  origem: HistoricoFuncaoOrigem
  motivo?: string
  criado_por?: string
}

export const historicoFuncaoService = {
  /**
   * Retorna todo o histórico de funções de um colaborador ordenado pela data_inicio (mais recente primeiro ou ordem cronológica).
   * Padrão: cronológico ascendente (data_inicio ASC).
   */
  async getHistoricoPorColaborador(
    colaboradorId: string,
    ordemDesc = false,
  ): Promise<HistoricoFuncao[]> {
    try {
      const sort = ordemDesc ? '-data_inicio,-created' : 'data_inicio,created'
      const records = await pb.collection('historico_funcao').getFullList<HistoricoFuncao>({
        filter: `colaborador_id = "${colaboradorId}"`,
        sort,
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar historico_funcao:', err)
      return []
    }
  },

  /**
   * Registra uma nova função para o colaborador e encerra a função vigente anterior naquela data.
   */
  async registrarTransicaoFuncao(params: {
    tenant_id: string
    colaborador_id: string
    novoCargo: string
    novoDepartamento?: string
    dataMudanca: string // YYYY-MM-DD ou ISO
    origem?: HistoricoFuncaoOrigem
    motivo?: string
    criadoPor?: string
    cargoAnteriorFallback?: string
    departamentoAnteriorFallback?: string
    dataAdmissaoFallback?: string
  }): Promise<{ novaFuncao: HistoricoFuncao; funcaoAnteriorEncerrada?: HistoricoFuncao | null }> {
    const {
      tenant_id,
      colaborador_id,
      novoCargo,
      novoDepartamento,
      dataMudanca,
      origem = 'mudanca',
      motivo,
      criadoPor,
      cargoAnteriorFallback,
      departamentoAnteriorFallback,
      dataAdmissaoFallback,
    } = params

    // Normalizar a data da mudança para formato com hora UTC consistente
    const dataMudancaFormatada =
      dataMudanca.includes('T') || dataMudanca.includes(' ')
        ? dataMudanca
        : `${dataMudanca} 00:00:00.000Z`

    // 1. Buscar histórico existente do colaborador
    const historicoAtual = await this.getHistoricoPorColaborador(colaborador_id, false)

    let funcaoAnteriorEncerrada: HistoricoFuncao | null = null

    if (historicoAtual.length === 0) {
      // Se não havia nenhum registro histórico ainda, criar primeiro o nó inicial da função anterior
      // começando na data de admissão e encerrando na data da mudança
      if (cargoAnteriorFallback && dataAdmissaoFallback) {
        const dataInicioAdm =
          dataAdmissaoFallback.includes('T') || dataAdmissaoFallback.includes(' ')
            ? dataAdmissaoFallback
            : `${dataAdmissaoFallback} 00:00:00.000Z`

        try {
          const recInicial = await pb.collection('historico_funcao').create<HistoricoFuncao>({
            tenant_id,
            colaborador_id,
            cargo: cargoAnteriorFallback,
            departamento: departamentoAnteriorFallback || '',
            data_inicio: dataInicioAdm,
            data_fim: dataMudancaFormatada,
            origem: 'admissao',
            motivo: 'Função inicial de admissão',
            criado_por: criadoPor || '',
          })
          funcaoAnteriorEncerrada = recInicial
        } catch (e) {
          console.warn('Erro ao criar registro inicial retrospectivo de função:', e)
        }
      }
    } else {
      // Já existem registros: encontrar o que está aberto (data_fim null ou vazio)
      const funcaoAberta = historicoAtual.find((h) => !h.data_fim)
      if (funcaoAberta) {
        try {
          const encerramento = await pb
            .collection('historico_funcao')
            .update<HistoricoFuncao>(funcaoAberta.id, { data_fim: dataMudancaFormatada })
          funcaoAnteriorEncerrada = encerramento
        } catch (e) {
          console.warn('Erro ao encerrar funcao anterior:', e)
        }
      }
    }

    // 2. Criar a nova função vigente (com data_fim null)
    const novaFuncao = await pb.collection('historico_funcao').create<HistoricoFuncao>({
      tenant_id,
      colaborador_id,
      cargo: novoCargo.trim(),
      departamento: novoDepartamento ? novoDepartamento.trim() : '',
      data_inicio: dataMudancaFormatada,
      data_fim: null,
      origem,
      motivo: motivo || 'Mudança de enquadramento funcional',
      criado_por: criadoPor || '',
    })

    return { novaFuncao, funcaoAnteriorEncerrada }
  },

  async criarRegistro(data: CriarHistoricoFuncaoDTO): Promise<HistoricoFuncao> {
    const record = await pb.collection('historico_funcao').create<HistoricoFuncao>(data)
    return record
  },

  async atualizarRegistro(
    id: string,
    data: Partial<CriarHistoricoFuncaoDTO>,
  ): Promise<HistoricoFuncao> {
    const record = await pb.collection('historico_funcao').update<HistoricoFuncao>(id, data)
    return record
  },

  async deletarRegistro(id: string): Promise<boolean> {
    await pb.collection('historico_funcao').delete(id)
    return true
  },
}
