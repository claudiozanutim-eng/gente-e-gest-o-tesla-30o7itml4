import pb from '@/lib/pocketbase/client'
import {
  LancamentoPeriodico,
  LancamentoPontual,
  ResumoFinanceiroMes,
  PeriodicidadeLancamento,
  Colaborador,
} from '@/types'
import { logAuditoriaService } from '@/services/api'

export interface NovoLancamentoPeriodicoDTO {
  tenant_id: string
  colaborador_id: string
  descritivo: string
  quantidade: number
  periodicidade: PeriodicidadeLancamento
  data_recorrencia: number
  data_inicio_vigencia: string
  data_fim_vigencia?: string | null
}

export interface NovoLancamentoPontualDTO {
  tenant_id: string
  colaborador_id: string
  descritivo: string
  quantidade: number
  data: string
  comentario?: string
}

export const folhaService = {
  /**
   * Verifica se um lançamento periódico é válido para um dado mês/ano.
   * Regra:
   * 1. data_inicio_vigencia deve ser <= último dia do mês de referência.
   * 2. se houver data_fim_vigencia, deve ser >= primeiro dia do mês de referência.
   * Fora desse intervalo, o lançamento periódico é considerado fora de vigência e NÃO entra no demonstrativo.
   */
  isPeriodicoVigenteNoMes(
    lancamento: LancamentoPeriodico,
    ano: number,
    mes: number, // 1 a 12
  ): boolean {
    const primeiroDiaMes = new Date(ano, mes - 1, 1, 0, 0, 0, 0)
    const ultimoDiaMes = new Date(ano, mes, 0, 23, 59, 59, 999)

    const inicio = new Date(lancamento.data_inicio_vigencia)
    if (inicio > ultimoDiaMes) {
      return false
    }

    if (lancamento.data_fim_vigencia) {
      const fim = new Date(lancamento.data_fim_vigencia)
      if (fim < primeiroDiaMes) {
        return false
      }
    }

    return true
  },

  /**
   * Verifica se um lançamento pontual pertence a um dado mês/ano.
   */
  isPontualNoMes(lancamento: LancamentoPontual, ano: number, mes: number): boolean {
    if (!lancamento.data) return false
    const d = new Date(lancamento.data)
    // Usar UTC ou local respeitando a data string YYYY-MM-DD
    const dateYear = d.getUTCFullYear()
    const dateMonth = d.getUTCMonth() + 1
    return dateYear === ano && dateMonth === mes
  },

  /**
   * Calcula o resumo financeiro a partir das listas de lançamentos vigentes/pertencentes ao mês.
   * Convenção:
   * Provento: quantidade > 0
   * Desconto: quantidade < 0
   */
  calcularResumoFinanceiro(
    periodicos: LancamentoPeriodico[],
    pontuais: LancamentoPontual[],
    ano: number,
    mes: number,
  ): ResumoFinanceiroMes {
    let totalProventos = 0
    let totalDescontos = 0
    let qtdPeriodicos = 0
    let qtdPontuais = 0

    // Filtra periódicos vigentes no mês
    for (const p of periodicos) {
      if (this.isPeriodicoVigenteNoMes(p, ano, mes)) {
        qtdPeriodicos++
        if (p.quantidade >= 0) {
          totalProventos += p.quantidade
        } else {
          totalDescontos += Math.abs(p.quantidade)
        }
      }
    }

    // Filtra pontuais ocorridos no mês
    for (const p of pontuais) {
      if (this.isPontualNoMes(p, ano, mes)) {
        qtdPontuais++
        if (p.quantidade >= 0) {
          totalProventos += p.quantidade
        } else {
          totalDescontos += Math.abs(p.quantidade)
        }
      }
    }

    const valorLiquido = totalProventos - totalDescontos

    return {
      totalProventos: Math.round(totalProventos * 100) / 100,
      totalDescontos: Math.round(totalDescontos * 100) / 100,
      valorLiquido: Math.round(valorLiquido * 100) / 100,
      quantidadePeriodicos: qtdPeriodicos,
      quantidadePontuais: qtdPontuais,
    }
  },

  // ----------------------------------------------------
  // Leitura de Dados
  // ----------------------------------------------------

  /**
   * Busca todos os lançamentos periódicos de um colaborador específico.
   */
  async getPeriodicosColaborador(
    tenantId: string,
    colaboradorId: string,
  ): Promise<LancamentoPeriodico[]> {
    try {
      const records = await pb.collection('lancamento_periodico').getFullList<LancamentoPeriodico>({
        filter: `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}"`,
        sort: '-data_inicio_vigencia,-created',
        expand: 'colaborador_id',
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar lançamentos periódicos do colaborador:', err)
      return []
    }
  },

  /**
   * Busca todos os lançamentos pontuais de um colaborador específico.
   */
  async getPontuaisColaborador(
    tenantId: string,
    colaboradorId: string,
  ): Promise<LancamentoPontual[]> {
    try {
      const records = await pb.collection('lancamento_pontual').getFullList<LancamentoPontual>({
        filter: `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}"`,
        sort: '-data,-created',
        expand: 'colaborador_id',
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar lançamentos pontuais do colaborador:', err)
      return []
    }
  },

  /**
   * Busca todos os lançamentos periódicos do tenant (visão RH).
   */
  async getPeriodicosTenant(tenantId: string): Promise<LancamentoPeriodico[]> {
    try {
      const records = await pb.collection('lancamento_periodico').getFullList<LancamentoPeriodico>({
        filter: `tenant_id = "${tenantId}"`,
        sort: '-data_inicio_vigencia,-created',
        expand: 'colaborador_id',
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar lançamentos periódicos do tenant:', err)
      return []
    }
  },

  /**
   * Busca todos os lançamentos pontuais do tenant (visão RH).
   */
  async getPontuaisTenant(tenantId: string): Promise<LancamentoPontual[]> {
    try {
      const records = await pb.collection('lancamento_pontual').getFullList<LancamentoPontual>({
        filter: `tenant_id = "${tenantId}"`,
        sort: '-data,-created',
        expand: 'colaborador_id',
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar lançamentos pontuais do tenant:', err)
      return []
    }
  },

  /**
   * Compila o resumo consolidado de todos os colaboradores do tenant para um mês/ano específico.
   * Utilizado na tela /folha/gestao.
   */
  async getResumoGestaoFolha(
    tenantId: string,
    ano: number,
    mes: number,
  ): Promise<
    Array<{
      colaborador: Colaborador
      resumo: ResumoFinanceiroMes
      periodicos: LancamentoPeriodico[]
      pontuais: LancamentoPontual[]
    }>
  > {
    const [colaboradores, periodicos, pontuais] = await Promise.all([
      pb.collection('colaborador').getFullList<Colaborador>({
        filter: `tenant_id = "${tenantId}" && status = "ativo"`,
        sort: 'nome',
      }),
      this.getPeriodicosTenant(tenantId),
      this.getPontuaisTenant(tenantId),
    ])

    const periodicosPorColab = new Map<string, LancamentoPeriodico[]>()
    for (const p of periodicos) {
      const list = periodicosPorColab.get(p.colaborador_id) || []
      list.push(p)
      periodicosPorColab.set(p.colaborador_id, list)
    }

    const pontuaisPorColab = new Map<string, LancamentoPontual[]>()
    for (const p of pontuais) {
      const list = pontuaisPorColab.get(p.colaborador_id) || []
      list.push(p)
      pontuaisPorColab.set(p.colaborador_id, list)
    }

    return colaboradores.map((colab) => {
      const colabPeriodicos = periodicosPorColab.get(colab.id) || []
      const colabPontuais = pontuaisPorColab.get(colab.id) || []
      const resumo = this.calcularResumoFinanceiro(colabPeriodicos, colabPontuais, ano, mes)

      return {
        colaborador: colab,
        resumo,
        periodicos: colabPeriodicos,
        pontuais: colabPontuais,
      }
    })
  },

  // ----------------------------------------------------
  // Importação em Lote via Planilha (CSV/Excel)
  // ----------------------------------------------------

  /**
   * Importa múltiplos lançamentos pontuais e periódicos com validação individual.
   */
  async importarLancamentosLote(
    tenantId: string,
    userId: string,
    itensValidos: Array<{
      tipo_lancamento: 'periodico' | 'pontual'
      colaborador_id: string
      colaborador_nome: string
      descritivo: string
      quantidade: number
      periodicidade?: PeriodicidadeLancamento
      data_recorrencia?: number
      data_inicio_vigencia?: string
      data_fim_vigencia?: string | null
      data?: string
      comentario?: string
    }>,
  ): Promise<{ importados: number; erros: number }> {
    let importados = 0
    let erros = 0

    for (const item of itensValidos) {
      try {
        if (item.tipo_lancamento === 'periodico') {
          await this.criarLancamentoPeriodico(
            {
              tenant_id: tenantId,
              colaborador_id: item.colaborador_id,
              descritivo: item.descritivo,
              quantidade: item.quantidade,
              periodicidade: item.periodicidade || 'mensal',
              data_recorrencia: item.data_recorrencia || 5,
              data_inicio_vigencia:
                item.data_inicio_vigencia || new Date().toISOString().slice(0, 10),
              data_fim_vigencia: item.data_fim_vigencia || null,
            },
            userId,
          )
        } else {
          await this.criarLancamentoPontual(
            {
              tenant_id: tenantId,
              colaborador_id: item.colaborador_id,
              descritivo: item.descritivo,
              quantidade: item.quantidade,
              data: item.data || new Date().toISOString().slice(0, 10),
              comentario: item.comentario || 'importado via planilha',
            },
            userId,
          )
        }
        importados++
      } catch (errItem) {
        console.warn('Erro ao importar linha individual de lançamento:', errItem)
        erros++
      }
    }

    // Log consolidado da importação
    if (importados > 0) {
      try {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: userId,
          acao: 'importacao_lancamentos_planilha',
          entidade: 'folha_lancamentos',
          entidade_id: `lote_${Date.now()}`,
          dados_json: {
            total_processados: itensValidos.length,
            importados,
            erros,
            origem: 'importado via planilha por usuário',
          },
        })
      } catch (auditErr) {
        console.warn('Erro ao registrar log de importação em lote:', auditErr)
      }
    }

    return { importados, erros }
  },

  // ----------------------------------------------------
  // Mutações: Lançamento Periódico (com Auditoria)
  // ----------------------------------------------------
  async criarLancamentoPeriodico(
    dto: NovoLancamentoPeriodicoDTO,
    userId: string,
  ): Promise<LancamentoPeriodico> {
    const payload: Record<string, unknown> = {
      tenant_id: dto.tenant_id,
      colaborador_id: dto.colaborador_id,
      descritivo: dto.descritivo,
      quantidade: dto.quantidade,
      periodicidade: dto.periodicidade,
      data_recorrencia: Number(dto.data_recorrencia),
      data_inicio_vigencia: dto.data_inicio_vigencia,
      data_fim_vigencia: dto.data_fim_vigencia || null,
    }

    const record = await pb
      .collection('lancamento_periodico')
      .create<LancamentoPeriodico>(payload, { expand: 'colaborador_id' })

    await logAuditoriaService.registrarLog({
      tenant_id: dto.tenant_id,
      user_id: userId,
      acao: 'criacao_lancamento_periodico',
      entidade: 'lancamento_periodico',
      entidade_id: record.id,
      dados_json: {
        colaborador_id: dto.colaborador_id,
        descritivo: dto.descritivo,
        quantidade: dto.quantidade,
        periodicidade: dto.periodicidade,
        data_recorrencia: dto.data_recorrencia,
        data_inicio_vigencia: dto.data_inicio_vigencia,
        data_fim_vigencia: dto.data_fim_vigencia,
      },
    })

    return record
  },

  async atualizarLancamentoPeriodico(
    id: string,
    dto: Partial<NovoLancamentoPeriodicoDTO>,
    tenantId: string,
    userId: string,
  ): Promise<LancamentoPeriodico> {
    const payload: Record<string, unknown> = { ...dto }
    if (dto.data_recorrencia !== undefined) {
      payload.data_recorrencia = Number(dto.data_recorrencia)
    }
    if (dto.data_fim_vigencia === '') {
      payload.data_fim_vigencia = null
    }

    const record = await pb
      .collection('lancamento_periodico')
      .update<LancamentoPeriodico>(id, payload, { expand: 'colaborador_id' })

    await logAuditoriaService.registrarLog({
      tenant_id: tenantId,
      user_id: userId,
      acao: 'atualizacao_lancamento_periodico',
      entidade: 'lancamento_periodico',
      entidade_id: id,
      dados_json: payload,
    })

    return record
  },

  async removerLancamentoPeriodico(
    id: string,
    tenantId: string,
    userId: string,
    detalhes?: { descritivo: string; colaborador_id: string },
  ): Promise<boolean> {
    await pb.collection('lancamento_periodico').delete(id)

    await logAuditoriaService.registrarLog({
      tenant_id: tenantId,
      user_id: userId,
      acao: 'remocao_lancamento_periodico',
      entidade: 'lancamento_periodico',
      entidade_id: id,
      dados_json: detalhes ? { ...detalhes } : { removido: true },
    })

    return true
  },

  // ----------------------------------------------------
  // Mutações: Lançamento Pontual (com Auditoria)
  // ----------------------------------------------------

  async criarLancamentoPontual(
    dto: NovoLancamentoPontualDTO,
    userId: string,
  ): Promise<LancamentoPontual> {
    const payload: Record<string, unknown> = {
      tenant_id: dto.tenant_id,
      colaborador_id: dto.colaborador_id,
      descritivo: dto.descritivo,
      quantidade: dto.quantidade,
      data: dto.data,
      comentario: dto.comentario || '',
    }

    const record = await pb
      .collection('lancamento_pontual')
      .create<LancamentoPontual>(payload, { expand: 'colaborador_id' })

    await logAuditoriaService.registrarLog({
      tenant_id: dto.tenant_id,
      user_id: userId,
      acao: 'criacao_lancamento_pontual',
      entidade: 'lancamento_pontual',
      entidade_id: record.id,
      dados_json: {
        colaborador_id: dto.colaborador_id,
        descritivo: dto.descritivo,
        quantidade: dto.quantidade,
        data: dto.data,
        comentario: dto.comentario,
      },
    })

    return record
  },

  async atualizarLancamentoPontual(
    id: string,
    dto: Partial<NovoLancamentoPontualDTO>,
    tenantId: string,
    userId: string,
  ): Promise<LancamentoPontual> {
    const payload: Record<string, unknown> = { ...dto }

    const record = await pb
      .collection('lancamento_pontual')
      .update<LancamentoPontual>(id, payload, { expand: 'colaborador_id' })

    await logAuditoriaService.registrarLog({
      tenant_id: tenantId,
      user_id: userId,
      acao: 'atualizacao_lancamento_pontual',
      entidade: 'lancamento_pontual',
      entidade_id: id,
      dados_json: payload,
    })

    return record
  },

  async removerLancamentoPontual(
    id: string,
    tenantId: string,
    userId: string,
    detalhes?: { descritivo: string; colaborador_id: string },
  ): Promise<boolean> {
    await pb.collection('lancamento_pontual').delete(id)

    await logAuditoriaService.registrarLog({
      tenant_id: tenantId,
      user_id: userId,
      acao: 'remocao_lancamento_pontual',
      entidade: 'lancamento_pontual',
      entidade_id: id,
      dados_json: detalhes ? { ...detalhes } : { removido: true },
    })

    return true
  },
}
