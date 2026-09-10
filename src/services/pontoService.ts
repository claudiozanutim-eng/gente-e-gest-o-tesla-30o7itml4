import pb from '@/lib/pocketbase/client'
import {
  RegistroPonto,
  RegistroPontoTipo,
  EscalaTrabalho,
  ColaboradorEscala,
  DepartamentoEscala,
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
  tipoFolgaEspecial?: '12x36' | 'revezamento'
  irregularidades: string[]
}

export const pontoService = {
  /**
   * Determina se uma data específica é dia de trabalho ou folga com base na escala (semanal ou especial).
   * Considera data de início do vínculo para ciclos de 12x36 e revezamento.
   */
  isDiaDeTrabalho(
    dataIso: string,
    escala?: EscalaTrabalho,
    dataInicioVinculo?: string,
  ): {
    trabalho: boolean
    folgaEspecial?: '12x36' | 'revezamento'
    motivoFolga?: string
  } {
    if (!escala) {
      // Sem escala, adota seg a sex como padrão
      const [ano, mes, dia] = dataIso.split('-').map(Number)
      const d = new Date(ano, mes - 1, dia)
      const diaSemana = d.getDay()
      const isSemana = diaSemana >= 1 && diaSemana <= 5
      return { trabalho: isSemana, motivoFolga: isSemana ? undefined : 'Folga semanal' }
    }

    const tipo = escala.tipo || 'semanal'

    // 1. Escala Semanal tradicional
    if (tipo === 'semanal') {
      const [ano, mes, dia] = dataIso.split('-').map(Number)
      const d = new Date(ano, mes - 1, dia)
      const diasSemanaMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
      const diaTag = diasSemanaMap[d.getDay()]
      const diasEscalados = escala.dias_semana
        ? escala.dias_semana.toLowerCase().split(',')
        : ['seg', 'ter', 'qua', 'qui', 'sex']
      const trabalho = diasEscalados.includes(diaTag)
      return {
        trabalho,
        motivoFolga: trabalho ? undefined : 'Folga semanal / Descanso remunerado',
      }
    }

    // 2. Escalas Especiais (12x36 ou Revezamento)
    const modelo = escala.modelo_especial || '12x36'
    const dataBaseStr = (dataInicioVinculo || escala.created || dataIso).slice(0, 10)

    const [aTarget, mTarget, dTarget] = dataIso.split('-').map(Number)
    const targetDate = new Date(Date.UTC(aTarget, mTarget - 1, dTarget))

    const [aBase, mBase, dBase] = dataBaseStr.split('-').map(Number)
    const baseDate = new Date(Date.UTC(aBase, mBase - 1, dBase))

    // Diferença em dias inteiros UTC
    const diffMs = targetDate.getTime() - baseDate.getTime()
    const diffDias = Math.floor(diffMs / (24 * 60 * 60 * 1000))

    if (modelo === '12x36') {
      // Alternância de 2 dias: Dia 0 = Trabalho, Dia 1 = Folga, etc.
      // Modulo seguro para datas anteriores à data base
      const mod = ((diffDias % 2) + 2) % 2
      const trabalho = mod === 0
      return {
        trabalho,
        folgaEspecial: trabalho ? undefined : '12x36',
        motivoFolga: trabalho ? undefined : 'Folga (12x36)',
      }
    }

    if (modelo === 'revezamento') {
      const cicloTotal = escala.ciclo_dias && escala.ciclo_dias > 0 ? escala.ciclo_dias : 4
      const cicloTrab =
        escala.ciclo_dias_trabalho && escala.ciclo_dias_trabalho > 0
          ? escala.ciclo_dias_trabalho
          : Math.floor(cicloTotal / 2) || 2

      const mod = ((diffDias % cicloTotal) + cicloTotal) % cicloTotal
      const trabalho = mod < cicloTrab
      return {
        trabalho,
        folgaEspecial: trabalho ? undefined : 'revezamento',
        motivoFolga: trabalho ? undefined : 'Folga (Revezamento)',
      }
    }

    return { trabalho: true }
  },
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
    dataInicioVinculo?: string,
  ): DiaEspelhoPonto[] {
    const totalDiasNoMes = new Date(ano, mesZeroIndex + 1, 0).getDate()
    const diasSemanaLabelMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    const hoje = new Date()
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

    // Calcula horas esperadas na escala
    let duracaoEscalaMs = 8 * 60 * 60 * 1000 // default 8h
    if (escala?.horario_inicio && escala?.horario_fim) {
      const [hIni, mIni] = escala.horario_inicio.split(':').map(Number)
      const [hFim, mFim] = escala.horario_fim.split(':').map(Number)
      let minEsperados = hFim * 60 + mFim - (hIni * 60 + mIni)
      if (minEsperados < 0) {
        // Turno noturno que cruza meia-noite (ex: 19:00 às 07:00 = 12h)
        minEsperados += 24 * 60
      }
      if (escala.tipo === 'especial' && escala.modelo_especial === '12x36') {
        // Escala 12x36: 12 horas nominais com 1h de descanso inclusa ou 11h úteis dependendo da convenção
        duracaoEscalaMs = (minEsperados > 0 ? minEsperados : 12 * 60) * 60 * 1000
      } else {
        if (minEsperados > 360) {
          minEsperados -= 60 // subtrai 1h de almoço se > 6h
        }
        if (minEsperados > 0) {
          duracaoEscalaMs = minEsperados * 60 * 1000
        }
      }
    }

    // Filtrar atestados validados
    const atestadosValidados = atestados.filter((a) => a.status === 'validado')

    const resultado: DiaEspelhoPonto[] = []

    for (let dia = 1; dia <= totalDiasNoMes; dia++) {
      const dataObj = new Date(ano, mesZeroIndex, dia)
      const diaSemanaIndex = dataObj.getDay()
      const diaSemanaLabel = diasSemanaLabelMap[diaSemanaIndex]
      const diaIso = `${ano}-${String(mesZeroIndex + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

      const isFimDeSemana = diaSemanaIndex === 0 || diaSemanaIndex === 6
      const isHoje = diaIso === hojeStr
      const isFuturo = diaIso > hojeStr

      // Avaliação de dia de trabalho vs folga considerando escala semanal ou especial
      const avaliacaoEscala = this.isDiaDeTrabalho(diaIso, escala, dataInicioVinculo)
      const isDiaEscalado = avaliacaoEscala.trabalho

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
      let tipoFolgaEspecial: '12x36' | 'revezamento' | undefined

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

      // 3. Folga por escala (semanal ou especial)
      if (!isDiaEscalado && !ausenciaTipo) {
        ausenciaTipo = 'folga'
        tipoFolgaEspecial = avaliacaoEscala.folgaEspecial
        ausenciaDetalhe = avaliacaoEscala.motivoFolga || 'Folga semanal / Descanso remunerado'
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
        tipoFolgaEspecial,
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
      tipo?: 'semanal' | 'especial'
      modelo_especial?: '12x36' | 'revezamento'
      ciclo_dias?: number
      ciclo_dias_trabalho?: number
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
          tipo: data.tipo,
          modelo_especial: data.modelo_especial,
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
   * Retorna a escala ativa de um colaborador específico.
   * Precedência: Vínculo individual > Escala do Departamento.
   */
  async getEscalaAtivaColaborador(
    tenantId: string,
    colaboradorId: string,
    departamento?: string,
  ): Promise<{
    vinculo?: ColaboradorEscala
    departamentoVinculo?: DepartamentoEscala
    escala: EscalaTrabalho
    origem: 'individual' | 'departamento'
    dataInicioVigencia: string
  } | null> {
    try {
      // 1. Precedência: Vínculo individual do colaborador
      const records = await pb.collection('colaborador_escala').getFullList<ColaboradorEscala>({
        filter: `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}"`,
        sort: '-data_inicio',
        expand: 'escala_id',
      })

      if (records.length > 0) {
        const vinculo = records[0]
        const escala = vinculo.expand?.escala_id
        if (escala) {
          return {
            vinculo,
            escala,
            origem: 'individual',
            dataInicioVigencia: vinculo.data_inicio,
          }
        }
      }

      // 2. Se não tem vínculo individual, tentar escala do departamento do colaborador
      let depto = departamento
      if (!depto) {
        try {
          const colab = await pb.collection('colaborador').getOne<Colaborador>(colaboradorId)
          depto = colab?.departamento
        } catch {
          /* intentionally ignored */
        }
      }

      if (depto) {
        const depEscala = await this.getEscalaAtivaDepartamento(tenantId, depto)
        if (depEscala && depEscala.expand?.escala_id) {
          return {
            departamentoVinculo: depEscala,
            escala: depEscala.expand.escala_id,
            origem: 'departamento',
            dataInicioVigencia: depEscala.data_inicio,
          }
        }
      }

      return null
    } catch {
      return null
    }
  },

  /**
   * Retorna todas as escalas vinculadas a departamentos do tenant
   */
  async getEscalasDepartamento(tenantId: string): Promise<DepartamentoEscala[]> {
    try {
      const records = await pb.collection('departamento_escala').getFullList<DepartamentoEscala>({
        filter: `tenant_id = "${tenantId}"`,
        sort: 'departamento',
        expand: 'escala_id',
      })
      return records
    } catch {
      return []
    }
  },

  /**
   * Retorna a escala ativa de um departamento específico
   */
  async getEscalaAtivaDepartamento(
    tenantId: string,
    departamento: string,
  ): Promise<DepartamentoEscala | null> {
    try {
      const records = await pb.collection('departamento_escala').getFullList<DepartamentoEscala>({
        filter: `tenant_id = "${tenantId}" && departamento = "${departamento}"`,
        sort: '-data_inicio',
        expand: 'escala_id',
      })
      return records.length > 0 ? records[0] : null
    } catch {
      return null
    }
  },

  /**
   * Vincula ou atualiza escala de um departamento
   */
  async vincularDepartamento(
    data: {
      tenant_id: string
      departamento: string
      escala_id: string
      data_inicio: string
      data_fim?: string
    },
    userId?: string,
  ): Promise<DepartamentoEscala> {
    const record = await pb.collection('departamento_escala').create<DepartamentoEscala>(data, {
      expand: 'escala_id',
    })

    if (userId) {
      await logAuditoriaService.registrarLog({
        tenant_id: data.tenant_id,
        user_id: userId,
        acao: 'Vínculo de escala a departamento',
        entidade: 'departamento_escala',
        entidade_id: record.id,
        dados_json: {
          departamento: data.departamento,
          escala_id: data.escala_id,
          data_inicio: data.data_inicio,
          data_fim: data.data_fim,
        },
      })
    }

    return record
  },

  /**
   * Atualiza vínculo de departamento
   */
  async updateVinculoDepartamento(
    id: string,
    data: Partial<Omit<DepartamentoEscala, 'id' | 'created' | 'updated'>>,
    userId?: string,
    tenantId?: string,
  ): Promise<DepartamentoEscala> {
    const record = await pb.collection('departamento_escala').update<DepartamentoEscala>(id, data, {
      expand: 'escala_id',
    })

    if (userId && tenantId) {
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: userId,
        acao: 'Atualização de vínculo de escala por departamento',
        entidade: 'departamento_escala',
        entidade_id: id,
        dados_json: data as Record<string, unknown>,
      })
    }

    return record
  },

  /**
   * Remove vínculo de escala com departamento
   */
  async removerVinculoDepartamento(
    id: string,
    userId?: string,
    tenantId?: string,
  ): Promise<boolean> {
    await pb.collection('departamento_escala').delete(id)
    if (userId && tenantId) {
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: userId,
        acao: 'Remoção de vínculo de escala por departamento',
        entidade: 'departamento_escala',
        entidade_id: id,
      })
    }
    return true
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
