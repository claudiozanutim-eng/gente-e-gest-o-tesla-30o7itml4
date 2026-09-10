import pb from '@/lib/pocketbase/client'
import { CompensacaoBancoHoras, CompensacaoStatus } from '@/types'
import { bancoHorasService } from '@/services/bancoHorasService'
import { logAuditoriaService, atestadoService, colaboradorService } from '@/services/api'
import { feriasService } from '@/services/feriasService'
import { notificacaoService } from '@/services/notificacaoService'

export interface SolicitarCompensacaoDTO {
  tenantId: string
  colaboradorId: string
  dataCompensacao: string // YYYY-MM-DD
  horas: number // Decimal ex: 0.5, 4, 8
  motivo: string
  userId: string
}

export const compensacaoService = {
  /**
   * Lista compensações do colaborador
   */
  async getCompensacoesColaborador(
    tenantId: string,
    colaboradorId: string,
  ): Promise<CompensacaoBancoHoras[]> {
    try {
      const records = await pb
        .collection('compensacao_banco_horas')
        .getFullList<CompensacaoBancoHoras>({
          filter: `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}"`,
          sort: '-data_compensacao',
          expand: 'colaborador_id,aprovado_por',
        })
      return records
    } catch (err) {
      console.error('Erro ao buscar compensações do colaborador:', err)
      return []
    }
  },

  /**
   * Lista todas as compensações do tenant (RH vê todas com filtros)
   */
  async getCompensacoesTenant(
    tenantId: string,
    status?: CompensacaoStatus,
  ): Promise<CompensacaoBancoHoras[]> {
    try {
      const filterParts = [`tenant_id = "${tenantId}"`]
      if (status) {
        filterParts.push(`status = "${status}"`)
      }
      const records = await pb
        .collection('compensacao_banco_horas')
        .getFullList<CompensacaoBancoHoras>({
          filter: filterParts.join(' && '),
          sort: '-created',
          expand: 'colaborador_id,aprovado_por',
        })
      return records
    } catch (err) {
      console.error('Erro ao buscar compensações do tenant:', err)
      return []
    }
  },

  /**
   * Lista compensações da equipe do gestor (mesmo departamento)
   */
  async getCompensacoesEquipe(
    tenantId: string,
    departamento: string,
    status?: CompensacaoStatus,
  ): Promise<CompensacaoBancoHoras[]> {
    try {
      const filterParts = [`tenant_id = "${tenantId}"`]
      if (status) {
        filterParts.push(`status = "${status}"`)
      }
      const records = await pb
        .collection('compensacao_banco_horas')
        .getFullList<CompensacaoBancoHoras>({
          filter: filterParts.join(' && '),
          sort: '-created',
          expand: 'colaborador_id,aprovado_por',
        })

      // Filtrar pelo departamento do colaborador
      return records.filter((r) => {
        const colabDepto = r.expand?.colaborador_id?.departamento
        return colabDepto === departamento
      })
    } catch (err) {
      console.error('Erro ao buscar compensações da equipe:', err)
      return []
    }
  },

  /**
   * Valida se uma solicitação de compensação pode ser realizada
   */
  async validarSolicitacao(dados: {
    tenantId: string
    colaboradorId: string
    dataCompensacao: string // YYYY-MM-DD
    horas: number
  }): Promise<{ valida: boolean; erro?: string }> {
    const { tenantId, colaboradorId, dataCompensacao, horas } = dados

    // 1. Quantidade de horas válida
    if (horas <= 0) {
      return { valida: false, erro: 'A quantidade de horas deve ser maior que zero.' }
    }

    // 2. Data não futura além de 30 dias
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const [anoComp, mesComp, diaComp] = dataCompensacao.split('-').map(Number)
    const dataAlvo = new Date(anoComp, mesComp - 1, diaComp)
    dataAlvo.setHours(0, 0, 0, 0)

    const limiteFuturo = new Date(hoje)
    limiteFuturo.setDate(limiteFuturo.getDate() + 30)

    if (dataAlvo > limiteFuturo) {
      return {
        valida: false,
        erro: 'A data da compensação não pode ser superior a 30 dias no futuro.',
      }
    }

    // 3. Saldo acumulado disponível no banco de horas
    const fechamentos = await bancoHorasService.getFechamentosColaborador(tenantId, colaboradorId)
    const saldoAcumuladoMs = fechamentos.reduce((acc, f) => acc + f.saldo_ms, 0)
    const saldoAcumuladoHoras = saldoAcumuladoMs / (1000 * 60 * 60)

    // Se saldo for menor ou igual a zero, bloquear
    if (saldoAcumuladoHoras <= 0) {
      return {
        valida: false,
        erro: 'Você não possui saldo positivo no banco de horas para solicitar compensação.',
      }
    }

    // Considerar também compensações já aprovadas e pendentes que ainda abaterão
    const compensacoesExistentes = await this.getCompensacoesColaborador(tenantId, colaboradorId)
    const horasCompensadasOuPendentes = compensacoesExistentes
      .filter((c) => c.status === 'aprovada' || c.status === 'pendente')
      .reduce((acc, c) => acc + (c.horas || 0), 0)

    const saldoDisponivelEfetivo = saldoAcumuladoHoras - horasCompensadasOuPendentes

    if (horas > saldoDisponivelEfetivo) {
      return {
        valida: false,
        erro: `Horas solicitadas (${horas}h) excedem o saldo disponível após outras solicitações (${saldoDisponivelEfetivo.toFixed(1)}h disponíveis).`,
      }
    }

    // 4. Bloquear se já houver solicitação para o mesmo dia
    const jaSolicitadoParaData = compensacoesExistentes.some(
      (c) => c.data_compensacao.slice(0, 10) === dataCompensacao && c.status !== 'recusada',
    )
    if (jaSolicitadoParaData) {
      return {
        valida: false,
        erro: 'Já existe uma solicitação de compensação para esta data.',
      }
    }

    // 5. Bloquear se o colaborador tiver atestado validado ou recebido na data
    try {
      const atestados = await atestadoService.getAtestadosColaborador(tenantId, colaboradorId)
      const dataAlvoMs = dataAlvo.getTime()
      const temAtestadoNaData = atestados.some((at) => {
        if (at.status !== 'validado' && at.status !== 'recebido' && at.status !== 'em_analise')
          return false
        const [aAno, aMes, aDia] = at.data_inicio.slice(0, 10).split('-').map(Number)
        const dIni = new Date(aAno, aMes - 1, aDia).getTime()
        const dFim = dIni + (at.qtd_dias || 1) * 24 * 60 * 60 * 1000
        return dataAlvoMs >= dIni && dataAlvoMs < dFim
      })

      if (temAtestadoNaData) {
        return {
          valida: false,
          erro: 'Você possui atestado médico lançado para a data selecionada.',
        }
      }
    } catch (e) {
      console.warn('Aviso ao checar atestados para compensação:', e)
    }

    // 6. Bloquear se o colaborador tiver férias aprovadas na data
    try {
      const emFerias = await feriasService.verificarDataEmFerias(colaboradorId, dataCompensacao)
      if (emFerias) {
        return {
          valida: false,
          erro: 'Você possui férias aprovadas na data selecionada.',
        }
      }
    } catch (e) {
      console.warn('Aviso ao checar férias para compensação:', e)
    }

    return { valida: true }
  },

  /**
   * Solicita compensação de horas
   */
  async solicitarCompensacao(dto: SolicitarCompensacaoDTO): Promise<CompensacaoBancoHoras> {
    const validacao = await this.validarSolicitacao({
      tenantId: dto.tenantId,
      colaboradorId: dto.colaboradorId,
      dataCompensacao: dto.dataCompensacao,
      horas: dto.horas,
    })

    if (!validacao.valida) {
      throw new Error(validacao.erro || 'Solicitação inválida.')
    }

    const record = await pb.collection('compensacao_banco_horas').create<CompensacaoBancoHoras>({
      tenant_id: dto.tenantId,
      colaborador_id: dto.colaboradorId,
      data_compensacao: dto.dataCompensacao,
      horas: dto.horas,
      motivo: dto.motivo,
      status: 'pendente',
      data_solicitacao: new Date().toISOString(),
    })

    // Registrar no log de auditoria
    try {
      await logAuditoriaService.registrarLog({
        tenant_id: dto.tenantId,
        user_id: dto.userId,
        acao: 'SOLICITACAO_COMPENSACAO_BANCO_HORAS',
        entidade: 'compensacao_banco_horas',
        entidade_id: record.id,
        dados_json: {
          colaborador_id: dto.colaboradorId,
          data_compensacao: dto.dataCompensacao,
          horas: dto.horas,
          motivo: dto.motivo,
        },
      })
    } catch (e) {
      console.warn('Erro ao registrar auditoria da compensação:', e)
    }

    // Notificar gestor da equipe ou RH
    try {
      const colab = await colaboradorService.getColaboradorById(dto.colaboradorId)
      if (colab) {
        // Encontrar gestores do departamento
        const gestores = await pb.collection('users').getFullList({
          filter: `tenant_id = "${dto.tenantId}" && (perfil = "gestor" || perfil = "rh" || perfil = "admin_rh")`,
        })

        for (const gestor of gestores) {
          await notificacaoService.notificar({
            tenantId: dto.tenantId,
            destinatarioId: gestor.id,
            tipo: 'compensacao',
            titulo: 'Nova solicitação de compensação',
            mensagem: `${colab.nome} solicitou compensação de ${dto.horas}h para ${dto.dataCompensacao}.`,
            link: '/portal-gestor',
            emailDestinatario: gestor.email,
            nomeDestinatario: gestor.name,
          })
        }
      }
    } catch (e) {
      console.warn('Erro ao disparar notificações de compensação:', e)
    }

    return record
  },

  /**
   * Aprova compensação de horas: debita as horas do saldo do banco de horas,
   * registra no histórico e cria notificação para o colaborador.
   */
  async aprovarCompensacao(dados: {
    compensacaoId: string
    userId: string
    comentario?: string
  }): Promise<CompensacaoBancoHoras> {
    const comp = await pb
      .collection('compensacao_banco_horas')
      .getOne<CompensacaoBancoHoras>(dados.compensacaoId, {
        expand: 'colaborador_id',
      })

    if (comp.status !== 'pendente') {
      throw new Error('Esta solicitação não está mais pendente de aprovação.')
    }

    const agora = new Date().toISOString()

    // 1. Atualizar status da solicitação
    const atualizada = await pb
      .collection('compensacao_banco_horas')
      .update<CompensacaoBancoHoras>(comp.id, {
        status: 'aprovada',
        data_resposta: agora,
        motivo_resposta: dados.comentario || 'Aprovado pelo gestor / RH.',
        aprovado_por: dados.userId,
      })

    // 2. Registrar em log_auditoria
    try {
      await logAuditoriaService.registrarLog({
        tenant_id: comp.tenant_id,
        user_id: dados.userId,
        acao: 'APROVACAO_COMPENSACAO_BANCO_HORAS',
        entidade: 'compensacao_banco_horas',
        entidade_id: comp.id,
        dados_json: {
          colaborador_id: comp.colaborador_id,
          horas: comp.horas,
          data_compensacao: comp.data_compensacao,
          comentario: dados.comentario,
        },
      })
    } catch (e) {
      console.warn('Erro ao registrar log de auditoria da aprovação de compensação:', e)
    }

    // 3. Notificar o colaborador
    try {
      const colab = comp.expand?.colaborador_id
      if (colab?.user_id) {
        await notificacaoService.notificar({
          tenantId: comp.tenant_id,
          destinatarioId: colab.user_id,
          tipo: 'compensacao',
          titulo: 'Compensação de horas aprovada',
          mensagem: `Sua compensação de ${comp.horas}h para o dia ${comp.data_compensacao.slice(0, 10)} foi aprovada.`,
          link: '/banco-horas',
          emailDestinatario: colab.email,
          nomeDestinatario: colab.nome,
        })
      }
    } catch (e) {
      console.warn('Erro ao notificar colaborador sobre compensação aprovada:', e)
    }

    return atualizada
  },

  /**
   * Recusa solicitação de compensação de banco de horas
   */
  async recusarCompensacao(dados: {
    compensacaoId: string
    userId: string
    motivoRecusa: string
  }): Promise<CompensacaoBancoHoras> {
    if (!dados.motivoRecusa?.trim()) {
      throw new Error('O motivo da recusa é obrigatório.')
    }

    const comp = await pb
      .collection('compensacao_banco_horas')
      .getOne<CompensacaoBancoHoras>(dados.compensacaoId, {
        expand: 'colaborador_id',
      })

    const agora = new Date().toISOString()

    const atualizada = await pb
      .collection('compensacao_banco_horas')
      .update<CompensacaoBancoHoras>(comp.id, {
        status: 'recusada',
        data_resposta: agora,
        motivo_resposta: dados.motivoRecusa.trim(),
        aprovado_por: dados.userId,
      })

    // Registrar no log_auditoria
    try {
      await logAuditoriaService.registrarLog({
        tenant_id: comp.tenant_id,
        user_id: dados.userId,
        acao: 'RECUSA_COMPENSACAO_BANCO_HORAS',
        entidade: 'compensacao_banco_horas',
        entidade_id: comp.id,
        dados_json: {
          colaborador_id: comp.colaborador_id,
          horas: comp.horas,
          motivo_recusa: dados.motivoRecusa.trim(),
        },
      })
    } catch (e) {
      console.warn('Erro ao registrar log de recusa de compensação:', e)
    }

    // Notificar colaborador
    try {
      const colab = comp.expand?.colaborador_id
      if (colab?.user_id) {
        await notificacaoService.notificar({
          tenantId: comp.tenant_id,
          destinatarioId: colab.user_id,
          tipo: 'compensacao',
          titulo: 'Compensação de horas recusada',
          mensagem: `Sua solicitação de compensação de ${comp.horas}h foi recusada. Motivo: ${dados.motivoRecusa.trim()}`,
          link: '/banco-horas',
          emailDestinatario: colab.email,
          nomeDestinatario: colab.nome,
        })
      }
    } catch (e) {
      console.warn('Erro ao notificar colaborador sobre recusa:', e)
    }

    return atualizada
  },
}
