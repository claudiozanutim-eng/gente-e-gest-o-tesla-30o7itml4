import pb from '@/lib/pocketbase/client'
import {
  PesquisaClima,
  PesquisaClimaResposta,
  PesquisaClimaEscala,
  PesquisaClimaStatus,
  Colaborador,
} from '@/types'
import { logAuditoriaService } from '@/services/api'

export interface CriarPesquisaDTO {
  tenantId: string
  pergunta: string
  escala: PesquisaClimaEscala
  dataInicio: string // YYYY-MM-DD
  dataFim: string // YYYY-MM-DD
  status?: PesquisaClimaStatus
  userId?: string
}

export interface ResponderPesquisaDTO {
  tenantId: string
  pesquisaId: string
  colaboradorId: string
  nota: number
  comentario?: string
  userId?: string
}

export interface EstatisticasPesquisaClima {
  totalRespostas: number
  totalColaboradoresElegiveis: number
  taxaParticipacaoPct: number
  mediaGeral: number
  distribuicaoNotas: Array<{ nota: number; rotulo: string; quantidade: number; percentual: number }>
}

export const pesquisaClimaService = {
  /**
   * Retorna todas as pesquisas do tenant ordenadas pela data mais recente
   */
  async getPesquisasTenant(tenantId: string): Promise<PesquisaClima[]> {
    if (!tenantId) return []
    try {
      const records = await pb.collection('pesquisa_clima').getFullList<PesquisaClima>({
        filter: `tenant_id = "${tenantId}"`,
        sort: '-data_inicio,-created',
        expand: 'criado_por',
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar pesquisas de clima do tenant:', err)
      return []
    }
  },

  /**
   * Retorna a pesquisa ativa vigente atual para o Portal do Colaborador
   */
  async getPesquisaAtiva(tenantId: string): Promise<PesquisaClima | null> {
    if (!tenantId) return null
    try {
      const hoje = new Date().toISOString()
      // Busca pesquisas ativas onde data_inicio <= hoje e data_fim >= hoje
      const records = await pb.collection('pesquisa_clima').getList<PesquisaClima>(1, 1, {
        filter: `tenant_id = "${tenantId}" && status = "ativa" && data_inicio <= "${hoje}" && data_fim >= "${hoje}"`,
        sort: '-data_inicio',
      })
      if (records.items.length > 0) {
        return records.items[0]
      }
      // Se não houver por intervalo de data rigoroso, busca a pesquisa marcada como ativa mais recente
      const fallback = await pb.collection('pesquisa_clima').getList<PesquisaClima>(1, 1, {
        filter: `tenant_id = "${tenantId}" && status = "ativa"`,
        sort: '-created',
      })
      return fallback.items[0] || null
    } catch (err) {
      console.warn('Erro ao carregar pesquisa de clima ativa:', err)
      return null
    }
  },

  /**
   * Busca a resposta de um colaborador específico para uma dada pesquisa
   */
  async getRespostaColaborador(
    tenantId: string,
    pesquisaId: string,
    colaboradorId: string,
  ): Promise<PesquisaClimaResposta | null> {
    if (!tenantId || !pesquisaId || !colaboradorId) return null
    try {
      const records = await pb
        .collection('pesquisa_clima_resposta')
        .getList<PesquisaClimaResposta>(1, 1, {
          filter: `tenant_id = "${tenantId}" && pesquisa_id = "${pesquisaId}" && colaborador_id = "${colaboradorId}"`,
        })
      return records.items[0] || null
    } catch (err) {
      console.warn('Erro ao buscar resposta do colaborador:', err)
      return null
    }
  },

  /**
   * Retorna todas as respostas de uma pesquisa (visão RH / Gestão)
   */
  async getRespostasPesquisa(
    tenantId: string,
    pesquisaId: string,
  ): Promise<PesquisaClimaResposta[]> {
    if (!tenantId || !pesquisaId) return []
    try {
      const records = await pb
        .collection('pesquisa_clima_resposta')
        .getFullList<PesquisaClimaResposta>({
          filter: `tenant_id = "${tenantId}" && pesquisa_id = "${pesquisaId}"`,
          sort: '-created',
          expand: 'colaborador_id,pesquisa_id',
        })
      return records
    } catch (err) {
      console.warn('Erro ao carregar respostas da pesquisa de clima:', err)
      return []
    }
  },

  /**
   * Calcula as estatísticas consolidadas da pesquisa
   */
  calcularEstatisticas(
    respostas: PesquisaClimaResposta[],
    totalColaboradores: number,
    escala: PesquisaClimaEscala = '1-5',
  ): EstatisticasPesquisaClima {
    const totalRespostas = respostas.length
    const taxaParticipacaoPct =
      totalColaboradores > 0
        ? Math.min(100, Math.round((totalRespostas / totalColaboradores) * 1000) / 10)
        : 0

    const somaNotas = respostas.reduce((acc, r) => acc + (r.nota || 0), 0)
    const mediaGeral = totalRespostas > 0 ? Math.round((somaNotas / totalRespostas) * 100) / 100 : 0

    const maxNota = escala === '1-10' ? 10 : 5
    const contagemPorNota: Record<number, number> = {}
    for (let i = 1; i <= maxNota; i++) {
      contagemPorNota[i] = 0
    }

    respostas.forEach((r) => {
      const n = Math.round(r.nota)
      if (contagemPorNota[n] !== undefined) {
        contagemPorNota[n]++
      }
    })

    const labels1a5: Record<number, string> = {
      1: 'Muito Insatisfeito (1)',
      2: 'Insatisfeito (2)',
      3: 'Neutro / Regular (3)',
      4: 'Satisfeito (4)',
      5: 'Muito Satisfeito (5)',
    }

    const distribuicaoNotas = []
    for (let i = 1; i <= maxNota; i++) {
      const qtd = contagemPorNota[i] || 0
      const pct = totalRespostas > 0 ? Math.round((qtd / totalRespostas) * 1000) / 10 : 0
      distribuicaoNotas.push({
        nota: i,
        rotulo: escala === '1-5' ? labels1a5[i] : `Nota ${i}`,
        quantidade: qtd,
        percentual: pct,
      })
    }

    return {
      totalRespostas,
      totalColaboradoresElegiveis: totalColaboradores,
      taxaParticipacaoPct,
      mediaGeral,
      distribuicaoNotas,
    }
  },

  /**
   * Cria uma nova pesquisa de clima
   */
  async criarPesquisa(dto: CriarPesquisaDTO): Promise<PesquisaClima> {
    const { tenantId, pergunta, escala, dataInicio, dataFim, status = 'ativa', userId } = dto

    const record = await pb.collection('pesquisa_clima').create<PesquisaClima>({
      tenant_id: tenantId,
      pergunta,
      escala,
      data_inicio: dataInicio,
      data_fim: dataFim,
      status,
      criado_por: userId || null,
    })

    if (userId) {
      try {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: userId,
          acao: 'criacao_pesquisa_clima',
          entidade: 'pesquisa_clima',
          entidade_id: record.id,
          dados_json: { pergunta, escala, dataInicio, dataFim, status },
        })
      } catch {
        /* intentionally ignored */
      }
    }

    return record
  },

  /**
   * Envia ou atualiza a resposta do colaborador (uma resposta por colaborador por pesquisa)
   */
  async responderPesquisa(dto: ResponderPesquisaDTO): Promise<PesquisaClimaResposta> {
    const { tenantId, pesquisaId, colaboradorId, nota, comentario = '', userId } = dto

    // Verifica se já existe resposta
    const existente = await this.getRespostaColaborador(tenantId, pesquisaId, colaboradorId)

    let record: PesquisaClimaResposta
    let acao: string

    if (existente) {
      record = await pb
        .collection('pesquisa_clima_resposta')
        .update<PesquisaClimaResposta>(existente.id, {
          nota,
          comentario,
        })
      acao = 'atualizacao_resposta_pesquisa_clima'
    } else {
      record = await pb.collection('pesquisa_clima_resposta').create<PesquisaClimaResposta>({
        tenant_id: tenantId,
        pesquisa_id: pesquisaId,
        colaborador_id: colaboradorId,
        nota,
        comentario,
      })
      acao = 'envio_resposta_pesquisa_clima'
    }

    if (userId) {
      try {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: userId,
          acao,
          entidade: 'pesquisa_clima_resposta',
          entidade_id: record.id,
          dados_json: { pesquisa_id: pesquisaId, colaborador_id: colaboradorId, nota },
        })
      } catch {
        /* intentionally ignored */
      }
    }

    return record
  },

  /**
   * Atualiza status da pesquisa (ex: encerrar pesquisa)
   */
  async atualizarStatusPesquisa(
    id: string,
    status: PesquisaClimaStatus,
    tenantId: string,
    userId?: string,
  ): Promise<PesquisaClima> {
    const record = await pb.collection('pesquisa_clima').update<PesquisaClima>(id, { status })
    if (userId) {
      try {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: userId,
          acao: 'atualizacao_status_pesquisa_clima',
          entidade: 'pesquisa_clima',
          entidade_id: id,
          dados_json: { status },
        })
      } catch {
        /* intentionally ignored */
      }
    }
    return record
  },
}
