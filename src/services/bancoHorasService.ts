import pb from '@/lib/pocketbase/client'
import { BancoHorasFechamento } from '@/types'
import { pontoService, escalaService } from '@/services/pontoService'
import { logAuditoriaService, atestadoService, colaboradorService } from '@/services/api'
import { feriasService } from '@/services/feriasService'

export interface FechamentoCalculadoItem {
  colaboradorId: string
  colaboradorNome: string
  colaboradorCargo?: string
  departamento?: string
  competencia: string // "AAAA-MM"
  horasTrabalhadasMs: number
  horasEscaladasMs: number
  saldoMs: number
  horasCreditoMs: number
  horasDebitoMs: number
  jaFechado: boolean
  fechamentoExistente?: BancoHorasFechamento
}

export const bancoHorasService = {
  /**
   * Lista fechamentos do colaborador ordenados por competência decrescente
   */
  async getFechamentosColaborador(
    tenantId: string,
    colaboradorId: string,
  ): Promise<BancoHorasFechamento[]> {
    try {
      const records = await pb
        .collection('banco_horas_fechamento')
        .getFullList<BancoHorasFechamento>({
          filter: `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}"`,
          sort: '-competencia',
          expand: 'colaborador_id',
        })
      return records
    } catch (err) {
      console.error('Erro ao buscar fechamentos de banco de horas do colaborador:', err)
      return []
    }
  },

  /**
   * Lista fechamentos de uma competência para todo o tenant (visão RH)
   */
  async getFechamentosTenantCompetencia(
    tenantId: string,
    competencia: string,
  ): Promise<BancoHorasFechamento[]> {
    try {
      const records = await pb
        .collection('banco_horas_fechamento')
        .getFullList<BancoHorasFechamento>({
          filter: `tenant_id = "${tenantId}" && competencia = "${competencia}"`,
          sort: '-created',
          expand: 'colaborador_id',
        })
      return records
    } catch (err) {
      console.error('Erro ao buscar fechamentos do tenant por competência:', err)
      return []
    }
  },

  /**
   * Lista todos os fechamentos do tenant para totalizar saldos consolidados
   */
  async getAllFechamentosTenant(tenantId: string): Promise<BancoHorasFechamento[]> {
    try {
      const records = await pb
        .collection('banco_horas_fechamento')
        .getFullList<BancoHorasFechamento>({
          filter: `tenant_id = "${tenantId}"`,
          sort: '-competencia',
        })
      return records
    } catch (err) {
      console.error('Erro ao buscar todos fechamentos do tenant:', err)
      return []
    }
  },

  /**
   * Calcula o espelho e o saldo de horas de um colaborador numa competência (ano, mes)
   */
  async calcularSaldoMes(
    tenantId: string,
    colaboradorId: string,
    ano: number,
    mes: number, // 1 a 12
  ): Promise<{
    horasTrabalhadasMs: number
    horasEscaladasMs: number
    saldoMs: number
    horasCreditoMs: number
    horasDebitoMs: number
  }> {
    const mesZeroIndex = mes - 1
    // Buscar registros de ponto, vínculos de escala, atestados e férias
    const [registros, vinculoEscala, atestados, colaborador, solicitacoesFerias] =
      await Promise.all([
        pontoService.getRegistrosMes(tenantId, colaboradorId, ano, mesZeroIndex),
        escalaService.getEscalaAtivaColaborador(tenantId, colaboradorId),
        atestadoService.getAtestadosColaborador(tenantId, colaboradorId).catch(() => []),
        colaboradorService.getColaboradorById(colaboradorId).catch(() => undefined),
        feriasService.listarSolicitacoes({ tenantId }).catch(() => []),
      ])

    const feriasColaborador = solicitacoesFerias.filter(
      (f) => f.colaborador_id === colaboradorId && f.status === 'aprovada',
    )

    const espelho = pontoService.construirEspelhoMensal(
      ano,
      mesZeroIndex,
      registros,
      vinculoEscala?.escala,
      atestados,
      colaborador,
      feriasColaborador,
    )

    let horasTrabalhadasMs = 0
    let horasEscaladasMs = 0
    let horasCreditoMs = 0
    let horasDebitoMs = 0

    // Duração diária esperada da escala
    let duracaoEscalaDiaMs = 8 * 60 * 60 * 1000
    if (vinculoEscala?.escala?.horario_inicio && vinculoEscala?.escala?.horario_fim) {
      const [hIni, mIni] = vinculoEscala.escala.horario_inicio.split(':').map(Number)
      const [hFim, mFim] = vinculoEscala.escala.horario_fim.split(':').map(Number)
      let minEsperados = hFim * 60 + mFim - (hIni * 60 + mIni)
      if (minEsperados > 360) {
        minEsperados -= 60
      }
      if (minEsperados > 0) {
        duracaoEscalaDiaMs = minEsperados * 60 * 1000
      }
    }

    espelho.forEach((dia) => {
      horasTrabalhadasMs += dia.totalHorasMs

      if (dia.isDiaEscalado && !dia.ausenciaTipo) {
        horasEscaladasMs += duracaoEscalaDiaMs
      }

      if (dia.saldoMs > 0) {
        horasCreditoMs += dia.saldoMs
      } else if (dia.saldoMs < 0) {
        horasDebitoMs += Math.abs(dia.saldoMs)
      }
    })

    const saldoMs = horasTrabalhadasMs - horasEscaladasMs

    return {
      horasTrabalhadasMs,
      horasEscaladasMs,
      saldoMs,
      horasCreditoMs,
      horasDebitoMs,
    }
  },

  /**
   * Realiza o fechamento mensal para um colaborador específico
   */
  async fecharMesColaborador(dados: {
    tenantId: string
    colaboradorId: string
    competencia: string // "AAAA-MM"
    comentarioRh?: string
    userId: string
  }): Promise<BancoHorasFechamento> {
    const { tenantId, colaboradorId, competencia, comentarioRh, userId } = dados

    // 1. Verificar se já existe fechamento para esta competência e colaborador
    try {
      const existente = await pb
        .collection('banco_horas_fechamento')
        .getFirstListItem<BancoHorasFechamento>(
          `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}" && competencia = "${competencia}"`,
        )
      if (existente) {
        throw new Error(`A competência ${competencia} já foi fechada para este colaborador.`)
      }
    } catch (e: any) {
      if (e?.message?.includes('já foi fechada')) {
        throw e
      }
      // Se deu 404 (não achou), segue o fluxo normal
    }

    // 2. Apurar saldo da competência
    const [anoStr, mesStr] = competencia.split('-')
    const ano = parseInt(anoStr, 10)
    const mes = parseInt(mesStr, 10)

    const apuracao = await this.calcularSaldoMes(tenantId, colaboradorId, ano, mes)
    const dataFechamento = new Date().toISOString()

    // 3. Salvar registro no banco
    const registro = await pb.collection('banco_horas_fechamento').create<BancoHorasFechamento>({
      tenant_id: tenantId,
      colaborador_id: colaboradorId,
      competencia,
      horas_trabalhadas_ms: apuracao.horasTrabalhadasMs,
      horas_escaladas_ms: apuracao.horasEscaladasMs,
      saldo_ms: apuracao.saldoMs,
      horas_credito_ms: apuracao.horasCreditoMs,
      horas_debito_ms: apuracao.horasDebitoMs,
      status: 'fechado',
      data_fechamento: dataFechamento,
      comentario_rh: comentarioRh || '',
    })

    // 4. Registrar em log_auditoria
    try {
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: userId,
        acao: 'FECHAMENTO_BANCO_HORAS',
        entidade: 'banco_horas_fechamento',
        entidade_id: registro.id,
        dados_json: {
          colaborador_id: colaboradorId,
          competencia,
          saldo_ms: apuracao.saldoMs,
          horas_trabalhadas_ms: apuracao.horasTrabalhadasMs,
          comentario_rh: comentarioRh,
        },
      })
    } catch (auditErr) {
      console.warn('Erro ao registrar auditoria de fechamento de banco de horas:', auditErr)
    }

    return registro
  },

  /**
   * Helper de formatação de milissegundos para HH:MM com sinal (+/-)
   */
  formatarSaldoMs(ms: number): string {
    const absMs = Math.abs(ms)
    const totalMinutos = Math.floor(absMs / (60 * 1000))
    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60
    const str = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
    if (ms > 0) return `+${str}`
    if (ms < 0) return `-${str}`
    return '00:00'
  },

  /**
   * Helper de formatação simples de horas e minutos (sem sinal)
   */
  formatarHorasMs(ms: number): string {
    const absMs = Math.abs(ms)
    const totalMinutos = Math.floor(absMs / (60 * 1000))
    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60
    return `${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m`
  },

  /**
   * Converte "AAAA-MM" para formato amigável "Mês/AAAA"
   */
  formatarCompetenciaLabel(competencia: string): string {
    const meses = [
      '',
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]
    const [ano, mes] = competencia.split('-')
    const mesNum = parseInt(mes, 10)
    return `${meses[mesNum] || mes}/${ano}`
  },
}
