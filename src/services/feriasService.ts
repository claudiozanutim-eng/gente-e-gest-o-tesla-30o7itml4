import { pb } from '@/lib/pocketbase/client'
import { Colaborador, SolicitacaoFerias, PeriodoAquisitivoFerias } from '@/types'

export interface ColaboradorFeriasStatus {
  colaborador: Colaborador
  dataAdmissao: Date
  fimPeriodoAquisitivo: Date
  limiteConcessivo: Date
  dataLimiteConcessao?: Date // Retrocompatibilidade com ModalFeriasProximas
  diasParaVencer: number
  diasAteLimite?: number // Retrocompatibilidade com ModalFeriasProximas
  mesesParaVencer: number
  status: 'ok' | 'alerta' | 'critico' | 'vencido'
  temFeriasAprovadasCobringo?: boolean
}

export const feriasService = {
  /**
   * Lista solicitações de férias com filtros opcionais
   */
  async listarSolicitacoes(params?: {
    tenantId?: string
    colaboradorId?: string
    status?: string
    expand?: string
  }): Promise<SolicitacaoFerias[]> {
    try {
      const filters: string[] = []
      if (params?.tenantId) {
        filters.push(`tenant_id = '${params.tenantId}'`)
      }
      if (params?.colaboradorId) {
        filters.push(`colaborador_id = '${params.colaboradorId}'`)
      }
      if (params?.status && params.status !== 'todos') {
        filters.push(`status = '${params.status}'`)
      }

      const records = await pb.collection('solicitacao_ferias').getFullList<SolicitacaoFerias>({
        filter: filters.length > 0 ? filters.join(' && ') : undefined,
        sort: '-created',
        expand: params?.expand || 'colaborador_id',
      })
      return records
    } catch (err) {
      console.error('Erro ao listar solicitações de férias:', err)
      return []
    }
  },

  /**
   * Lista solicitações pendentes para aprovação
   * Se for gestor, filtra pelos colaboradores da sua equipe ou busca do tenant respeitando RLS
   */
  async listarPendentes(
    tenantId?: string,
    colaboradorIds?: string[],
  ): Promise<SolicitacaoFerias[]> {
    try {
      const filters: string[] = ["status = 'pendente'"]
      if (tenantId) {
        filters.push(`tenant_id = '${tenantId}'`)
      }
      if (colaboradorIds && colaboradorIds.length > 0) {
        const idFilters = colaboradorIds.map((id) => `colaborador_id = '${id}'`).join(' || ')
        filters.push(`(${idFilters})`)
      }

      return await pb.collection('solicitacao_ferias').getFullList<SolicitacaoFerias>({
        filter: filters.join(' && '),
        sort: 'data_inicio',
        expand: 'colaborador_id',
      })
    } catch (err) {
      console.error('Erro ao listar pendências de férias:', err)
      return []
    }
  },

  /**
   * Cria nova solicitação de férias
   */
  async criarSolicitacao(dados: {
    tenant_id: string
    colaborador_id: string
    data_inicio: string
    data_fim: string
    dias: number
    abono_pecuniario: boolean
    vender_20_dias: boolean
  }): Promise<SolicitacaoFerias> {
    const payload = {
      ...dados,
      status: 'pendente',
      data_solicitacao: new Date().toISOString(),
    }
    return await pb.collection('solicitacao_ferias').create<SolicitacaoFerias>(payload)
  },

  /**
   * Aprova solicitação de férias
   */
  async aprovarSolicitacao(id: string, comentarioGestor?: string): Promise<SolicitacaoFerias> {
    const payload: Partial<SolicitacaoFerias> = {
      status: 'aprovada',
      data_resposta: new Date().toISOString(),
      comentario_gestor: comentarioGestor || undefined,
    }
    return await pb.collection('solicitacao_ferias').update<SolicitacaoFerias>(id, payload)
  },

  /**
   * Rejeita solicitação de férias com justificativa obrigatória
   */
  async rejeitarSolicitacao(id: string, motivo: string): Promise<SolicitacaoFerias> {
    if (!motivo?.trim()) {
      throw new Error('O motivo da rejeição é obrigatório.')
    }
    const payload: Partial<SolicitacaoFerias> = {
      status: 'rejeitada',
      data_resposta: new Date().toISOString(),
      comentario_gestor: motivo.trim(),
    }
    return await pb.collection('solicitacao_ferias').update<SolicitacaoFerias>(id, payload)
  },

  /**
   * Cancela uma solicitação de férias pendente pelo colaborador
   */
  async cancelarSolicitacao(id: string): Promise<SolicitacaoFerias> {
    return await pb.collection('solicitacao_ferias').update<SolicitacaoFerias>(id, {
      status: 'cancelada',
      data_resposta: new Date().toISOString(),
    })
  },

  /**
   * Calcula todos os períodos aquisitivos e concessivos de um colaborador a partir da admissão,
   * deduzindo dias de solicitações aprovadas.
   */
  analisarFeriasProximas(colaboradores: Colaborador[], dataRef: Date = new Date()) {
    const ativos = colaboradores.filter((c) => c.status === 'ativo' && c.data_admissao)
    const colaboradoresProximos: ColaboradorFeriasStatus[] = []

    for (const colab of ativos) {
      const adm = new Date(colab.data_admissao)
      if (isNaN(adm.getTime())) continue

      const diaAdm = adm.getUTCDate()
      const mesAdm = adm.getUTCMonth()
      const anoAdm = adm.getUTCFullYear()

      let anoPeriodo = anoAdm
      const anoLimite = dataRef.getFullYear()

      let periodoAtualFim: Date | null = null
      let limiteConcessivo: Date | null = null

      while (anoPeriodo <= anoLimite + 1) {
        const fimAquisitivo = new Date(Date.UTC(anoPeriodo + 1, mesAdm, diaAdm))
        fimAquisitivo.setUTCDate(fimAquisitivo.getUTCDate() - 1)

        const conc = new Date(Date.UTC(anoPeriodo + 2, mesAdm, diaAdm))
        conc.setUTCDate(conc.getUTCDate() - 1)

        if (dataRef >= fimAquisitivo) {
          periodoAtualFim = fimAquisitivo
          limiteConcessivo = conc
        }
        anoPeriodo++
      }

      if (!periodoAtualFim || !limiteConcessivo) continue

      const msParaVencer = limiteConcessivo.getTime() - dataRef.getTime()
      const diasParaVencer = Math.floor(msParaVencer / (1000 * 60 * 60 * 24))
      const mesesParaVencer = Math.floor(diasParaVencer / 30)

      let status: ColaboradorFeriasStatus['status'] = 'ok'
      if (diasParaVencer < 0) {
        status = 'vencido'
      } else if (diasParaVencer <= 30) {
        status = 'critico'
      } else if (diasParaVencer <= 60) {
        status = 'alerta'
      }

      if (status === 'critico' || status === 'alerta' || status === 'vencido') {
        colaboradoresProximos.push({
          colaborador: colab,
          dataAdmissao: adm,
          fimPeriodoAquisitivo: periodoAtualFim,
          limiteConcessivo,
          dataLimiteConcessao: limiteConcessivo,
          diasParaVencer,
          diasAteLimite: diasParaVencer,
          mesesParaVencer,
          status,
        })
      }
    }

    colaboradoresProximos.sort((a, b) => a.diasParaVencer - b.diasParaVencer)

    return {
      totalProximos: colaboradoresProximos.length,
      colaboradoresProximos,
    }
  },

  calcularPeriodosAquisitivos(
    dataAdmissaoStr?: string,
    solicitacoesAprovadas: SolicitacaoFerias[] = [],
    dataReferencia: Date = new Date(),
  ): PeriodoAquisitivoFerias[] {
    if (!dataAdmissaoStr) return []

    // Normalizar data de admissão
    const rawAdmissao = new Date(dataAdmissaoStr)
    if (isNaN(rawAdmissao.getTime())) return []

    // Criar data base usando ano, mês e dia local para evitar desvios de timezone
    const diaAdm = rawAdmissao.getUTCDate()
    const mesAdm = rawAdmissao.getUTCMonth()
    const anoAdm = rawAdmissao.getUTCFullYear()

    const periodos: PeriodoAquisitivoFerias[] = []
    const anoLimite = dataReferencia.getFullYear() + 1

    let anoAtual = anoAdm

    while (anoAtual <= anoLimite) {
      const inicioAquisitivo = new Date(Date.UTC(anoAtual, mesAdm, diaAdm))
      // Fim do período aquisitivo: 1 ano depois menos 1 dia
      const fimAquisitivo = new Date(Date.UTC(anoAtual + 1, mesAdm, diaAdm))
      fimAquisitivo.setUTCDate(fimAquisitivo.getUTCDate() - 1)

      // Limite concessivo: fim do período aquisitivo + 12 meses
      const limiteConcessivo = new Date(Date.UTC(anoAtual + 2, mesAdm, diaAdm))
      limiteConcessivo.setUTCDate(limiteConcessivo.getUTCDate() - 1)

      // Se o período começou no futuro distante (além de hoje + 1 ano), paramos
      if (inicioAquisitivo.getTime() > dataReferencia.getTime() + 365 * 24 * 60 * 60 * 1000) {
        break
      }

      // Filtrar solicitações que caem ou foram agendadas para gozo ligado a este período
      // Critério: férias aprovadas cuja data_inicio está entre o fim do aquisitivo e o limite concessivo
      // ou foram tiradas dentro desse ciclo
      const solicitacoesDestePeriodo = solicitacoesAprovadas.filter((s) => {
        const dInicio = new Date(s.data_inicio)
        return (
          dInicio >= fimAquisitivo &&
          dInicio <= new Date(limiteConcessivo.getTime() + 15 * 86400000)
        )
      })

      const diasGozados = solicitacoesDestePeriodo.reduce((acc, curr) => acc + (curr.dias || 0), 0)
      const saldo = Math.max(0, 30 - diasGozados)

      // Determinar status do período
      let status: PeriodoAquisitivoFerias['status'] = 'disponivel'
      const hojeMs = dataReferencia.getTime()

      if (hojeMs < fimAquisitivo.getTime()) {
        status = 'em_aquisicao'
      } else if (saldo <= 0) {
        status = 'gozado'
      } else if (hojeMs > limiteConcessivo.getTime()) {
        status = 'vencido'
      } else {
        const msParaVencer = limiteConcessivo.getTime() - hojeMs
        const diasParaVencer = Math.floor(msParaVencer / (1000 * 60 * 60 * 24))
        if (diasParaVencer <= 60) {
          status = 'vencendo'
        } else {
          status = 'disponivel'
        }
      }

      periodos.push({
        inicioAquisitivo,
        fimAquisitivo,
        limiteConcessivo,
        diasDireito: 30,
        diasGozados,
        saldo,
        status,
        solicitacoesAssociadas: solicitacoesDestePeriodo,
      })

      anoAtual++
    }

    return periodos.reverse() // Mais recentes primeiro
  },

  /**
   * Calcula colaboradores com férias próximas do vencimento para o Dashboard RH,
   * considerando apenas colaboradores que ainda NÃO têm férias aprovadas cobrindo o período.
   */
  async calcularFeriasProximas(
    colaboradores: Colaborador[],
    dataReferencia: Date = new Date(),
  ): Promise<ColaboradorFeriasStatus[]> {
    const ativos = colaboradores.filter((c) => c.status === 'ativo' && c.data_admissao)
    if (ativos.length === 0) return []

    // Buscar férias aprovadas do tenant para descartar quem já tem férias agendadas/gozadas
    let feriasAprovadas: SolicitacaoFerias[] = []
    try {
      feriasAprovadas = await pb.collection('solicitacao_ferias').getFullList<SolicitacaoFerias>({
        filter: "status = 'aprovada'",
      })
    } catch (e) {
      console.warn('Não foi possível carregar férias aprovadas para o cálculo de KPIs:', e)
    }

    const feriasPorColaborador = new Map<string, SolicitacaoFerias[]>()
    for (const f of feriasAprovadas) {
      const list = feriasPorColaborador.get(f.colaborador_id) || []
      list.push(f)
      feriasPorColaborador.set(f.colaborador_id, list)
    }

    const lista: ColaboradorFeriasStatus[] = []

    for (const colab of ativos) {
      const adm = new Date(colab.data_admissao)
      if (isNaN(adm.getTime())) continue

      const diaAdm = adm.getUTCDate()
      const mesAdm = adm.getUTCMonth()
      const anoAdm = adm.getUTCFullYear()

      let anoPeriodo = anoAdm
      const anoLimite = dataReferencia.getFullYear()

      let periodoAtualFim: Date | null = null
      let limiteConcessivo: Date | null = null

      while (anoPeriodo <= anoLimite + 1) {
        const fimAquisitivo = new Date(Date.UTC(anoPeriodo + 1, mesAdm, diaAdm))
        fimAquisitivo.setUTCDate(fimAquisitivo.getUTCDate() - 1)

        const conc = new Date(Date.UTC(anoPeriodo + 2, mesAdm, diaAdm))
        conc.setUTCDate(conc.getUTCDate() - 1)

        if (dataReferencia >= fimAquisitivo) {
          periodoAtualFim = fimAquisitivo
          limiteConcessivo = conc
        }
        anoPeriodo++
      }

      if (!periodoAtualFim || !limiteConcessivo) continue

      // Verificar se o colaborador já possui férias aprovadas cobrindo o período concessivo
      const minhasFerias = feriasPorColaborador.get(colab.id) || []
      const totalDiasAprovados = minhasFerias
        .filter((f) => {
          const dInicio = new Date(f.data_inicio)
          return dInicio >= periodoAtualFim! && dInicio <= limiteConcessivo!
        })
        .reduce((acc, f) => acc + (f.dias || 0), 0)

      // Se já tirou/programou 30 dias (ou pelo menos 20 com abono), não está pendente!
      const temFeriasCobringo = totalDiasAprovados >= 20

      const msParaVencer = limiteConcessivo.getTime() - dataReferencia.getTime()
      const diasParaVencer = Math.floor(msParaVencer / (1000 * 60 * 60 * 24))
      const mesesParaVencer = Math.floor(diasParaVencer / 30)

      let status: ColaboradorFeriasStatus['status'] = 'ok'
      if (diasParaVencer < 0) {
        status = 'vencido'
      } else if (diasParaVencer <= 30) {
        status = 'critico'
      } else if (diasParaVencer <= 60) {
        status = 'alerta'
      }

      if (
        (status === 'critico' || status === 'alerta' || status === 'vencido') &&
        !temFeriasCobringo
      ) {
        lista.push({
          colaborador: colab,
          dataAdmissao: adm,
          fimPeriodoAquisitivo: periodoAtualFim,
          limiteConcessivo,
          dataLimiteConcessao: limiteConcessivo,
          diasParaVencer,
          diasAteLimite: diasParaVencer,
          mesesParaVencer,
          status,
          temFeriasAprovadasCobringo: temFeriasCobringo,
        })
      }
    }

    // Ordenar pelo prazo mais urgente primeiro
    return lista.sort((a, b) => a.diasParaVencer - b.diasParaVencer)
  },

  /**
   * Verifica se determinada data de um colaborador é um dia de férias aprovadas
   */
  async verificarDataEmFerias(colaboradorId: string, dataIso: string): Promise<boolean> {
    try {
      const targetDate = dataIso.slice(0, 10)
      const ferias = await pb.collection('solicitacao_ferias').getList(1, 1, {
        filter: `colaborador_id = '${colaboradorId}' && status = 'aprovada' && data_inicio <= '${targetDate}' && data_fim >= '${targetDate}'`,
      })
      return ferias.items.length > 0
    } catch {
      return false
    }
  },

  /**
   * Busca todas as férias aprovadas de um colaborador que interceptam um determinado mês/intervalo
   */
  async buscarFeriasPeriodoColaborador(
    colaboradorId: string,
    dataInicioIso: string,
    dataFimIso: string,
  ): Promise<SolicitacaoFerias[]> {
    try {
      const records = await pb.collection('solicitacao_ferias').getFullList<SolicitacaoFerias>({
        filter: `colaborador_id = '${colaboradorId}' && status = 'aprovada' && data_fim >= '${dataInicioIso}' && data_inicio <= '${dataFimIso}'`,
      })
      return records
    } catch {
      return []
    }
  },

  /**
   * Busca todas as férias aprovadas do tenant que interceptam um determinado mês/intervalo
   */
  async buscarFeriasPeriodoTenant(
    tenantId: string,
    dataInicioIso: string,
    dataFimIso: string,
  ): Promise<SolicitacaoFerias[]> {
    try {
      const records = await pb.collection('solicitacao_ferias').getFullList<SolicitacaoFerias>({
        filter: `tenant_id = '${tenantId}' && status = 'aprovada' && data_fim >= '${dataInicioIso}' && data_inicio <= '${dataFimIso}'`,
      })
      return records
    } catch {
      return []
    }
  },
}
