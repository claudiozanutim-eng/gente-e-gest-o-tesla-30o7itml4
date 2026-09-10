import pb from '@/lib/pocketbase/client'
import {
  RegistroPonto,
  RegistroPontoTipo,
  EscalaTrabalho,
  ColaboradorEscala,
  Colaborador,
  Atestado,
  SolicitacaoFerias,
} from '@/types'
import { logAuditoriaService } from '@/services/api'
import { feriasService } from '@/services/feriasService'

export interface ResumoDiaColaborador {
  colaborador: Colaborador
  registros: RegistroPonto[]
  escala?: EscalaTrabalho
  status: 'presente' | 'ausente' | 'nao_registrado' | 'atestado' | 'ferias' | 'folga'
  totalHorasTrabalhadasMs: number
  totalHorasFormatadas: string
  primeiraEntrada?: string
  ultimaSaida?: string
  irregularidades: string[]
}

export interface DiaEspelhoPonto {
  dataIso: string // YYYY-MM-DD
  dataObjeto: Date
  diaSemanaLabel: string // "Seg", "Ter", etc.
  diaNumero: number
  registros: RegistroPonto[]
  entrada?: string // HH:MM
  saidaAlmoco?: string // HH:MM
  voltaAlmoco?: string // HH:MM
  saida?: string // HH:MM
  totalHorasMs: number
  totalHorasFormatadas: string
  saldoMs: number // comparado com a escala
  saldoFormatado: string
  escalaEsperada?: EscalaTrabalho
  isDiaEscalado: boolean
  isFimDeSemana: boolean
  isHoje: boolean
  isFuturo: boolean
  ausenciaTipo?: 'atestado' | 'ferias' | 'folga'
  ausenciaDetalhe?: string
  irregularidades: string[]
}

export const pontoService = {
  /**
   * Registra uma batida de ponto para o colaborador.
   * O horário oficial é garantido pelo servidor no backend (pb_hooks onRecordCreateRequest).
   */
  async registrarPonto(data: {
    tenant_id: string
    colaborador_id: string
    tipo: RegistroPontoTipo
    origem?: string
  }): Promise<RegistroPonto> {
    const record = await pb.collection('registro_ponto').create<RegistroPonto>({
      tenant_id: data.tenant_id,
      colaborador_id: data.colaborador_id,
      tipo: data.tipo,
      data_hora: new Date().toISOString(), // O hook no backend substitui pela hora real do servidor
      origem: data.origem || 'web',
    })
    return record
  },

  /**
   * Retorna os registros de ponto de um colaborador para uma data específica (ou hoje)
   */
  async getRegistrosDoDia(
    tenantId: string,
    colaboradorId: string,
    dataReferencia: Date = new Date(),
  ): Promise<RegistroPonto[]> {
    const ano = dataReferencia.getFullYear()
    const mes = String(dataReferencia.getMonth() + 1).padStart(2, '0')
    const dia = String(dataReferencia.getDate()).padStart(2, '0')

    const inicioDia = `${ano}-${mes}-${dia} 00:00:00.000Z`
    const fimDia = `${ano}-${mes}-${dia} 23:59:59.999Z`

    const records = await pb.collection('registro_ponto').getFullList<RegistroPonto>({
      filter: `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}" && data_hora >= "${inicioDia}" && data_hora <= "${fimDia}"`,
      sort: 'data_hora',
    })

    return records
  },

  /**
   * Retorna os registros de um mês inteiro para compor o espelho de ponto
   */
  async getRegistrosMes(
    tenantId: string,
    colaboradorId: string,
    ano: number,
    mesZeroIndex: number,
  ): Promise<RegistroPonto[]> {
    const inicioMes = new Date(Date.UTC(ano, mesZeroIndex, 1, 0, 0, 0)).toISOString()
    const ultimoDia = new Date(Date.UTC(ano, mesZeroIndex + 1, 0, 23, 59, 59, 999)).toISOString()

    const records = await pb.collection('registro_ponto').getFullList<RegistroPonto>({
      filter: `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}" && data_hora >= "${inicioMes}" && data_hora <= "${ultimoDia}"`,
      sort: 'data_hora',
    })

    return records
  },

  /**
   * Retorna todas as batidas de ponto do tenant para um dia específico (visão RH)
   */
  async getRegistrosDiaTenant(tenantId: string, dataIsoDia: string): Promise<RegistroPonto[]> {
    const inicio = `${dataIsoDia} 00:00:00.000Z`
    const fim = `${dataIsoDia} 23:59:59.999Z`

    const records = await pb.collection('registro_ponto').getFullList<RegistroPonto>({
      filter: `tenant_id = "${tenantId}" && data_hora >= "${inicio}" && data_hora <= "${fim}"`,
      sort: 'data_hora',
      expand: 'colaborador_id',
    })

    return records
  },

  /**
   * Helper para formatar milissegundos em HH:MM ou HHh MMm
   */
  formatarHorasMinutos(ms: number): string {
    if (ms <= 0) return '00:00'
    const totalMinutos = Math.floor(ms / (1000 * 60))
    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60
    return `${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m`
  },

  /**
   * Calcula o total trabalhado a partir dos registros de um dia
   */
  calcularHorasDia(registros: RegistroPonto[]): number {
    let totalMs = 0
    let entradaTime: number | null = null
    let voltaAlmocoTime: number | null = null

    // Ordena por horário
    const ordenados = [...registros].sort(
      (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime(),
    )

    for (const reg of ordenados) {
      const regTime = new Date(reg.data_hora).getTime()

      if (reg.tipo === 'entrada') {
        entradaTime = regTime
      } else if (reg.tipo === 'saida_almoco') {
        if (entradaTime) {
          totalMs += Math.max(0, regTime - entradaTime)
          entradaTime = null
        }
      } else if (reg.tipo === 'volta_almoco') {
        voltaAlmocoTime = regTime
      } else if (reg.tipo === 'saida') {
        if (voltaAlmocoTime) {
          totalMs += Math.max(0, regTime - voltaAlmocoTime)
          voltaAlmocoTime = null
        } else if (entradaTime) {
          totalMs += Math.max(0, regTime - entradaTime)
          entradaTime = null
        }
      }
    }

    return totalMs
  },

  /**
   * Monta o espelho de ponto completo de um mês com integração de atestados e previsão de férias CLT
   */
  construirEspelhoMensal(
    ano: number,
    mesZeroIndex: number,
    registros: RegistroPonto[],
    escala?: EscalaTrabalho,
    atestados: Atestado[] = [],
    colaborador?: Colaborador,
    feriasAprovadas: SolicitacaoFerias[] = [],
  ): DiaEspelhoPonto[] {
    const totalDiasNoMes = new Date(ano, mesZeroIndex + 1, 0).getDate()
    const diasSemanaMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
    const diasSemanaLabelMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    const hoje = new Date()
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

    const diasEscalados = escala?.dias_semana ? escala.dias_semana.toLowerCase().split(',') : []

    // Calcula horas esperadas na escala
    let duracaoEscalaMs = 8 * 60 * 60 * 1000 // default 8h
    if (escala?.horario_inicio && escala?.horario_fim) {
      const [hIni, mIni] = escala.horario_inicio.split(':').map(Number)
      const [hFim, mFim] = escala.horario_fim.split(':').map(Number)
      let minEsperados = hFim * 60 + mFim - (hIni * 60 + mIni)
      if (minEsperados > 360) {
        minEsperados -= 60 // subtrai 1h de almoço se > 6h
      }
      if (minEsperados > 0) {
        duracaoEscalaMs = minEsperados * 60 * 1000
      }
    }

    // Filtrar atestados validados
    const atestadosValidados = atestados.filter((a) => a.status === 'validado')

    // Checar férias concessivas se colaborador informado
    let statusFerias
    if (colaborador?.data_admissao) {
      try {
        const analise = feriasService.analisarFeriasProximas(
          [colaborador],
          new Date(ano, mesZeroIndex, 15),
        )
        statusFerias = analise.colaboradoresProximos[0]
      } catch {
        /* intentionally ignored */
      }
    }

    const resultado: DiaEspelhoPonto[] = []

    for (let dia = 1; dia <= totalDiasNoMes; dia++) {
      const dataObj = new Date(ano, mesZeroIndex, dia)
      const diaSemanaIndex = dataObj.getDay()
      const diaSemanaTag = diasSemanaMap[diaSemanaIndex]
      const diaSemanaLabel = diasSemanaLabelMap[diaSemanaIndex]
      const diaIso = `${ano}-${String(mesZeroIndex + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

      const isFimDeSemana = diaSemanaIndex === 0 || diaSemanaIndex === 6
      const isDiaEscalado = diasEscalados.includes(diaSemanaTag)
      const isHoje = diaIso === hojeStr
      const isFuturo = diaIso > hojeStr

      // Filtrar registros deste dia
      const regsDoDia = registros.filter((r) => {
        const d = new Date(r.data_hora)
        const dIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return dIso === diaIso
      })

      // Ordenar batidas do dia
      regsDoDia.sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())

      let entrada: string | undefined
      let saidaAlmoco: string | undefined
      let voltaAlmoco: string | undefined
      let saida: string | undefined

      regsDoDia.forEach((r) => {
        const d = new Date(r.data_hora)
        const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        if (r.tipo === 'entrada' && !entrada) entrada = hhmm
        else if (r.tipo === 'saida_almoco' && !saidaAlmoco) saidaAlmoco = hhmm
        else if (r.tipo === 'volta_almoco' && !voltaAlmoco) voltaAlmoco = hhmm
        else if (r.tipo === 'saida') saida = hhmm
      })

      const totalHorasMs = this.calcularHorasDia(regsDoDia)
      const totalHorasFormatadas = this.formatarHorasMinutos(totalHorasMs)

      // Verificar ausências justificadas (Férias Aprovadas e Atestados Validados)
      let ausenciaTipo: 'atestado' | 'ferias' | 'folga' | undefined
      let ausenciaDetalhe: string | undefined

      // 1. Prioridade para Férias aprovadas
      for (const fer of feriasAprovadas) {
        if (fer.status !== 'aprovada') continue
        const dInicioStr = fer.data_inicio.slice(0, 10)
        const dFimStr = fer.data_fim.slice(0, 10)

        if (diaIso >= dInicioStr && diaIso <= dFimStr) {
          ausenciaTipo = 'ferias'
          ausenciaDetalhe = `Férias regulamentares aprovadas (${fer.dias} dias)`
          break
        }
      }

      // 2. Atestados médicos validados
      if (!ausenciaTipo) {
        for (const at of atestadosValidados) {
          const dataInicio = new Date(at.data_inicio)
          const dataFim = new Date(dataInicio)
          dataFim.setDate(dataFim.getDate() + (at.qtd_dias || 1))

          const dTime = dataObj.getTime()
          const iTime = new Date(
            dataInicio.getFullYear(),
            dataInicio.getMonth(),
            dataInicio.getDate(),
          ).getTime()
          const fTime = new Date(
            dataFim.getFullYear(),
            dataFim.getMonth(),
            dataFim.getDate(),
          ).getTime()

          if (dTime >= iTime && dTime < fTime) {
            ausenciaTipo = 'atestado'
            ausenciaDetalhe = `Atestado médico homologado (${at.qtd_dias}d)`
            break
          }
        }
      }

      // Folga semanal
      if (!isDiaEscalado && !ausenciaTipo) {
        ausenciaTipo = 'folga'
        ausenciaDetalhe = 'Folga semanal / Descanso remunerado'
      }

      // Irregularidades e saldo
      const irregularidades: string[] = []
      let saldoMs = 0

      if (!isFuturo && isDiaEscalado && !ausenciaTipo) {
        if (regsDoDia.length === 0) {
          if (!isHoje) {
            irregularidades.push('Falta não justificada')
            saldoMs = -duracaoEscalaMs
          }
        } else {
          saldoMs = totalHorasMs - duracaoEscalaMs
          if (escala?.horario_inicio && entrada) {
            const [hExp, mExp] = escala.horario_inicio.split(':').map(Number)
            const [hReal, mReal] = entrada.split(':').map(Number)
            const diffMin = hReal * 60 + mReal - (hExp * 60 + mExp)
            if (diffMin > 10) {
              irregularidades.push(`Atraso na entrada (+${diffMin} min)`)
            }
          }
          if (saldoMs > 15 * 60 * 1000) {
            irregularidades.push(`Hora extra (${this.formatarHorasMinutos(saldoMs)})`)
          } else if (saldoMs < -15 * 60 * 1000 && !isHoje) {
            irregularidades.push(
              `Horas insuficientes (${this.formatarHorasMinutos(Math.abs(saldoMs))})`,
            )
          }
        }
      }

      let saldoFormatado = '00:00'
      if (saldoMs > 0) {
        saldoFormatado = `+${this.formatarHorasMinutos(saldoMs)}`
      } else if (saldoMs < 0) {
        saldoFormatado = `-${this.formatarHorasMinutos(Math.abs(saldoMs))}`
      }

      resultado.push({
        dataIso: diaIso,
        dataObjeto: dataObj,
        diaSemanaLabel,
        diaNumero: dia,
        registros: regsDoDia,
        entrada,
        saidaAlmoco,
        voltaAlmoco,
        saida,
        totalHorasMs,
        totalHorasFormatadas,
        saldoMs,
        saldoFormatado,
        escalaEsperada: escala,
        isDiaEscalado,
        isFimDeSemana,
        isHoje,
        isFuturo,
        ausenciaTipo,
        ausenciaDetalhe,
        irregularidades,
      })
    }

    return resultado
  },
}

export const escalaService = {
  /**
   * Retorna todas as escalas cadastradas no tenant
   */
  async getEscalas(tenantId: string): Promise<EscalaTrabalho[]> {
    const records = await pb.collection('escala_trabalho').getFullList<EscalaTrabalho>({
      filter: `tenant_id = "${tenantId}"`,
      sort: 'nome',
    })
    return records
  },

  /**
   * Cria uma nova escala de trabalho
   */
  async createEscala(
    data: {
      tenant_id: string
      nome: string
      horario_inicio: string
      horario_fim: string
      dias_semana: string
    },
    userId?: string,
  ): Promise<EscalaTrabalho> {
    const record = await pb.collection('escala_trabalho').create<EscalaTrabalho>(data)

    if (userId) {
      await logAuditoriaService.registrarLog({
        tenant_id: data.tenant_id,
        user_id: userId,
        acao: 'Criação de escala de trabalho',
        entidade: 'escala_trabalho',
        entidade_id: record.id,
        dados_json: {
          nome: data.nome,
          horario: `${data.horario_inicio}–${data.horario_fim}`,
          dias: data.dias_semana,
        },
      })
    }

    return record
  },

  /**
   * Atualiza escala existente
   */
  async updateEscala(
    id: string,
    data: Partial<Omit<EscalaTrabalho, 'id' | 'created' | 'updated'>>,
    userId?: string,
    tenantId?: string,
  ): Promise<EscalaTrabalho> {
    const record = await pb.collection('escala_trabalho').update<EscalaTrabalho>(id, data)

    if (userId && tenantId) {
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: userId,
        acao: 'Atualização de escala de trabalho',
        entidade: 'escala_trabalho',
        entidade_id: record.id,
        dados_json: data as Record<string, unknown>,
      })
    }

    return record
  },

  /**
   * Exclui escala
   */
  async deleteEscala(id: string, userId?: string, tenantId?: string): Promise<boolean> {
    await pb.collection('escala_trabalho').delete(id)
    if (userId && tenantId) {
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: userId,
        acao: 'Exclusão de escala de trabalho',
        entidade: 'escala_trabalho',
        entidade_id: id,
      })
    }
    return true
  },

  /**
   * Retorna os vínculos de colaboradores e escalas
   */
  async getVinculosColaboradorEscala(tenantId: string): Promise<ColaboradorEscala[]> {
    const records = await pb.collection('colaborador_escala').getFullList<ColaboradorEscala>({
      filter: `tenant_id = "${tenantId}"`,
      sort: '-created',
      expand: 'colaborador_id,escala_id',
    })
    return records
  },

  /**
   * Retorna a escala ativa de um colaborador específico
   */
  async getEscalaAtivaColaborador(
    tenantId: string,
    colaboradorId: string,
  ): Promise<{ vinculo: ColaboradorEscala; escala: EscalaTrabalho } | null> {
    try {
      const records = await pb.collection('colaborador_escala').getFullList<ColaboradorEscala>({
        filter: `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}"`,
        sort: '-data_inicio',
        expand: 'escala_id',
      })

      if (records.length === 0) return null
      const vinculo = records[0]
      const escala = vinculo.expand?.escala_id
      if (!escala) return null
      return { vinculo, escala }
    } catch {
      return null
    }
  },

  /**
   * Vincula um colaborador a uma escala com vigência
   */
  async vincularColaborador(
    data: {
      tenant_id: string
      colaborador_id: string
      escala_id: string
      data_inicio: string
      data_fim?: string
    },
    userId?: string,
  ): Promise<ColaboradorEscala> {
    const record = await pb.collection('colaborador_escala').create<ColaboradorEscala>(data, {
      expand: 'colaborador_id,escala_id',
    })

    if (userId) {
      await logAuditoriaService.registrarLog({
        tenant_id: data.tenant_id,
        user_id: userId,
        acao: 'Vínculo de colaborador a escala',
        entidade: 'colaborador_escala',
        entidade_id: record.id,
        dados_json: {
          colaborador_id: data.colaborador_id,
          escala_id: data.escala_id,
          data_inicio: data.data_inicio,
        },
      })
    }

    return record
  },

  /**
   * Remove vínculo de escala
   */
  async removerVinculo(id: string, userId?: string, tenantId?: string): Promise<boolean> {
    await pb.collection('colaborador_escala').delete(id)
    if (userId && tenantId) {
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: userId,
        acao: 'Remoção de vínculo de escala',
        entidade: 'colaborador_escala',
        entidade_id: id,
      })
    }
    return true
  },
}
