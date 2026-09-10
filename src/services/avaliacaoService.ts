import pb from '@/lib/pocketbase/client'
import {
  CicloAvaliacao,
  Competencia,
  Avaliacao,
  NotaCompetencia,
  CicloAvaliacaoStatus,
} from '@/types'

export const avaliacaoService = {
  // ----------------------------------------------------
  // CICLOS DE AVALIAÇÃO
  // ----------------------------------------------------
  async getCiclos(tenantId: string): Promise<CicloAvaliacao[]> {
    return await pb.collection('ciclo_avaliacao').getFullList<CicloAvaliacao>({
      filter: `tenant_id = '${tenantId}'`,
      sort: '-created',
    })
  },

  async getCicloById(id: string): Promise<CicloAvaliacao> {
    return await pb.collection('ciclo_avaliacao').getOne<CicloAvaliacao>(id)
  },

  async createCiclo(data: {
    tenant_id: string
    nome: string
    data_inicio: string
    data_fim: string
    status: CicloAvaliacaoStatus
  }): Promise<CicloAvaliacao> {
    return await pb.collection('ciclo_avaliacao').create<CicloAvaliacao>(data)
  },

  async updateCiclo(
    id: string,
    data: Partial<{
      nome: string
      data_inicio: string
      data_fim: string
      status: CicloAvaliacaoStatus
    }>,
  ): Promise<CicloAvaliacao> {
    return await pb.collection('ciclo_avaliacao').update<CicloAvaliacao>(id, data)
  },

  async deleteCiclo(id: string): Promise<boolean> {
    await pb.collection('ciclo_avaliacao').delete(id)
    return true
  },

  // ----------------------------------------------------
  // COMPETÊNCIAS
  // ----------------------------------------------------
  async getCompetencias(tenantId: string): Promise<Competencia[]> {
    return await pb.collection('competencia').getFullList<Competencia>({
      filter: `tenant_id = '${tenantId}'`,
      sort: 'tipo,-peso,nome',
    })
  },

  async createCompetencia(data: {
    tenant_id: string
    nome: string
    tipo: 'geral' | 'especifica'
    peso?: number
    descricao?: string
    nota_esperada?: number
  }): Promise<Competencia> {
    return await pb.collection('competencia').create<Competencia>(data)
  },

  async updateCompetencia(
    id: string,
    data: Partial<{
      nome: string
      tipo: 'geral' | 'especifica'
      peso: number
      descricao: string
      nota_esperada: number
    }>,
  ): Promise<Competencia> {
    return await pb.collection('competencia').update<Competencia>(id, data)
  },

  async deleteCompetencia(id: string): Promise<boolean> {
    await pb.collection('competencia').delete(id)
    return true
  },

  // ----------------------------------------------------
  // AVALIAÇÕES
  // ----------------------------------------------------
  async getAvaliacoesDoColaborador(colaboradorId: string): Promise<Avaliacao[]> {
    return await pb.collection('avaliacao').getFullList<Avaliacao>({
      filter: `colaborador_id = '${colaboradorId}'`,
      expand: 'ciclo_id,avaliador_id,colaborador_id',
      sort: '-created',
    })
  },

  async getAvaliacoesPorCiclo(cicloId: string): Promise<Avaliacao[]> {
    return await pb.collection('avaliacao').getFullList<Avaliacao>({
      filter: `ciclo_id = '${cicloId}'`,
      expand: 'colaborador_id,avaliador_id,ciclo_id',
      sort: 'colaborador_id.nome',
    })
  },

  async getAvaliacoesParaAvaliador(avaliadorId: string): Promise<Avaliacao[]> {
    return await pb.collection('avaliacao').getFullList<Avaliacao>({
      filter: `avaliador_id = '${avaliadorId}'`,
      expand: 'colaborador_id,ciclo_id',
      sort: '-created',
    })
  },

  async getAvaliacoesPorCicloEColaborador(
    cicloId: string,
    colaboradorId: string,
  ): Promise<Avaliacao[]> {
    return await pb.collection('avaliacao').getFullList<Avaliacao>({
      filter: `ciclo_id = '${cicloId}' && colaborador_id = '${colaboradorId}'`,
      expand: 'avaliador_id,colaborador_id,ciclo_id',
      sort: '-tipo_avaliador',
    })
  },

  async createAvaliacao(data: {
    ciclo_id: string
    colaborador_id: string
    avaliador_id: string
    tipo_avaliador: 'principal' | 'apoio'
    peso: number
    status?: 'pendente' | 'concluida'
    comentario?: string
    nota_final?: number
  }): Promise<Avaliacao> {
    return await pb.collection('avaliacao').create<Avaliacao>(
      {
        status: 'pendente',
        ...data,
      },
      {
        expand: 'ciclo_id,colaborador_id,avaliador_id',
      },
    )
  },

  async updateAvaliacao(
    id: string,
    data: Partial<{
      peso: number
      status: 'pendente' | 'concluida'
      comentario: string
      nota_final: number
      data_avaliacao: string
    }>,
  ): Promise<Avaliacao> {
    return await pb.collection('avaliacao').update<Avaliacao>(id, data, {
      expand: 'ciclo_id,colaborador_id,avaliador_id',
    })
  },

  async deleteAvaliacao(id: string): Promise<boolean> {
    await pb.collection('avaliacao').delete(id)
    return true
  },

  // ----------------------------------------------------
  // NOTAS POR COMPETÊNCIA
  // ----------------------------------------------------
  async getNotasPorAvaliacao(avaliacaoId: string): Promise<NotaCompetencia[]> {
    return await pb.collection('nota_competencia').getFullList<NotaCompetencia>({
      filter: `avaliacao_id = '${avaliacaoId}'`,
      expand: 'competencia_id',
      sort: 'competencia_id.tipo,competencia_id.nome',
    })
  },

  async getNotasPorAvaliacoes(avaliacaoIds: string[]): Promise<NotaCompetencia[]> {
    if (avaliacaoIds.length === 0) return []
    const filter = avaliacaoIds.map((id) => `avaliacao_id = '${id}'`).join(' || ')
    return await pb.collection('nota_competencia').getFullList<NotaCompetencia>({
      filter,
      expand: 'competencia_id,avaliacao_id',
      sort: 'competencia_id.tipo,competencia_id.nome',
    })
  },

  async salvarNotasAvaliacao(
    avaliacaoId: string,
    notas: Array<{ competencia_id: string; nota: number; comentario?: string }>,
    comentarioGeral?: string,
  ): Promise<Avaliacao> {
    // 1. Obter notas existentes para atualizar ou criar
    const existentes = await this.getNotasPorAvaliacao(avaliacaoId)
    const existentesMap = new Map<string, string>(existentes.map((n) => [n.competencia_id, n.id]))

    let somaNotas = 0
    for (const item of notas) {
      somaNotas += Number(item.nota)
      const existingId = existentesMap.get(item.competencia_id)
      if (existingId) {
        await pb.collection('nota_competencia').update(existingId as string, {
          nota: item.nota,
          comentario: item.comentario || '',
        })
      } else {
        await pb.collection('nota_competencia').create({
          avaliacao_id: avaliacaoId,
          competencia_id: item.competencia_id,
          nota: item.nota,
          comentario: item.comentario || '',
        })
      }
    }

    const mediaCompetencias = notas.length > 0 ? somaNotas / notas.length : 0
    const mediaArredondada = Math.round(mediaCompetencias * 10) / 10

    // Atualiza a avaliação com a nota_final média do avaliador e status concluída
    const avaliacaoAtualizada = await this.updateAvaliacao(avaliacaoId, {
      status: 'concluida',
      nota_final: mediaArredondada,
      comentario: comentarioGeral || '',
      data_avaliacao: new Date().toISOString(),
    })

    // Disparar notificação in-app para o colaborador avaliado
    try {
      const colab = avaliacaoAtualizada.expand?.colaborador_id
      const ciclo = avaliacaoAtualizada.expand?.ciclo_id
      if (colab?.user_id) {
        await pb.collection('notificacao').create({
          tenant_id: colab.tenant_id,
          destinatario_id: colab.user_id,
          tipo: 'avaliacao',
          titulo: 'Avaliação de desempenho concluída',
          mensagem: `A avaliação do ciclo "${ciclo?.nome || 'Desempenho'}" foi concluída e está disponível para consulta no portal.`,
          link: '/minhas-avaliacoes',
          lida: false,
        })
      }
    } catch (e) {
      console.warn('Erro ao notificar conclusao de avaliacao:', e)
    }

    return avaliacaoAtualizada
  },
}
