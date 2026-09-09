import { Colaborador } from '@/types'

export interface ColaboradorFeriasStatus {
  colaborador: Colaborador
  dataAdmissao: Date
  dataLimiteConcessao: Date
  diasAteLimite: number
  proximoVencimento: boolean // <= hoje + 60 dias
  semSolicitacaoAprovada: boolean
}

/**
 * Serviço isolado para cálculo de previsão de férias e prazos concessivos da CLT.
 * 
 * Regra CLT:
 * - Período aquisitivo 1: 12 meses após a admissão.
 * - Período concessivo 1: Os 12 meses seguintes (limite = admissão + 24 meses).
 * - Ciclos subsequentes: Admissão + 24 meses + (N - 1) * 12 meses.
 * 
 * Nota de desacoplamento: Como o módulo de férias ainda não existe,
 * "semSolicitacaoAprovada" é considerado true por padrão. Quando o módulo
 * de férias for implementado, basta injetar a checagem das solicitações aprovadas.
 */
export const feriasService = {
  /**
   * Calcula a data limite de concessão do ciclo corrente/próximo de um colaborador.
   * Considera no mínimo admissão + 24 meses para o primeiro ciclo.
   * Se já ultrapassou o 1º ciclo, projeta o próximo vencimento concessivo anual.
   */
  calcularLimiteConcessao(dataAdmissaoStr: string, dataReferencia: Date = new Date()): Date {
    const admissao = new Date(dataAdmissaoStr)
    if (isNaN(admissao.getTime())) {
      // Fallback em caso de data inválida: 24 meses a partir de hoje
      const fallback = new Date(dataReferencia)
      fallback.setMonth(fallback.getMonth() + 24)
      return fallback
    }

    // Primeiro limite concessivo: data de admissão + 24 meses
    const primeiroLimite = new Date(admissao)
    primeiroLimite.setMonth(primeiroLimite.getMonth() + 24)

    // Se o primeiro limite ainda está no futuro ou próximo, esse é o ciclo
    if (primeiroLimite.getTime() >= dataReferencia.getTime() - 1000 * 60 * 60 * 24 * 30) {
      return primeiroLimite
    }

    // Para colaboradores mais antigos cujo 1º limite já passou no passado,
    // calcula o ciclo concessivo mais próximo/vigente
    const proximoLimite = new Date(primeiroLimite)
    while (proximoLimite.getTime() < dataReferencia.getTime()) {
      proximoLimite.setFullYear(proximoLimite.getFullYear() + 1)
    }

    return proximoLimite
  },

  /**
   * Avalia a situação de férias dos colaboradores ativos no tenant.
   * Retorna os colaboradores cujo limite concessivo está a 60 dias ou menos de hoje
   * e que não possuem solicitação de férias aprovada.
   */
  analisarFeriasProximas(
    colaboradores: Colaborador[],
    dataReferencia: Date = new Date(),
    diasJanela: number = 60,
  ): {
    totalProximos: number
    colaboradoresProximos: ColaboradorFeriasStatus[]
    todosStatus: ColaboradorFeriasStatus[]
  } {
    const hojeMs = dataReferencia.getTime()
    const msPorDia = 1000 * 60 * 60 * 24
    const janelaMs = diasJanela * msPorDia

    const todosStatus: ColaboradorFeriasStatus[] = colaboradores
      .filter((c) => c.status === 'ativo')
      .map((colaborador) => {
        const dataAdmissao = new Date(colaborador.data_admissao)
        const dataLimiteConcessao = this.calcularLimiteConcessao(
          colaborador.data_admissao,
          dataReferencia,
        )

        const diferencaMs = dataLimiteConcessao.getTime() - hojeMs
        const diasAteLimite = Math.ceil(diferencaMs / msPorDia)

        // Pela especificação: data_limite_concessao <= hoje + 60 dias E sem solicitacao aprovada
        // "como não há solicitações de férias, considere 'sem solicitação aprovada' = true"
        const semSolicitacaoAprovada = true
        const proximoVencimento = diferencaMs <= janelaMs && semSolicitacaoAprovada

        return {
          colaborador,
          dataAdmissao,
          dataLimiteConcessao,
          diasAteLimite,
          proximoVencimento,
          semSolicitacaoAprovada,
        }
      })

    // Ordena os mais urgentes primeiro (menor quantidade de dias até o limite)
    const colaboradoresProximos = todosStatus
      .filter((s) => s.proximoVencimento)
      .sort((a, b) => a.diasAteLimite - b.diasAteLimite)

    return {
      totalProximos: colaboradoresProximos.length,
      colaboradoresProximos,
      todosStatus,
    }
  },
}
