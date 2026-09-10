import pb from '@/lib/pocketbase/client'
import { OnboardingGestorRecord, OnboardingEtapaDef } from '@/types'
import { notificacaoService } from '@/services/notificacaoService'

export const ETAPAS_ONBOARDING_GESTOR: OnboardingEtapaDef[] = [
  {
    etapa: 1,
    titulo: 'Conhecer sua equipe',
    descricao:
      'Visualize a lista de colaboradores, cargos, admissões e departamentos da sua equipe.',
    link: '/portal-gestor',
    botaoTexto: 'Ver equipe',
  },
  {
    etapa: 2,
    titulo: 'Revisar solicitações pendentes',
    descricao:
      'Acesse a fila unificada de aprovações de férias, compensações e alterações cadastrais.',
    link: '/portal-gestor#aprovacoes',
    botaoTexto: 'Ver fila de aprovações',
  },
  {
    etapa: 3,
    titulo: 'Ver o calendário de férias da equipe',
    descricao:
      'Consulte as programações de férias e sobreposições para planejar a escala da equipe.',
    link: '/ferias/coletivo',
    botaoTexto: 'Ver calendário de férias',
  },
  {
    etapa: 4,
    titulo: 'Realizar a primeira avaliação de desempenho',
    descricao:
      'Acesse os ciclos de avaliação de competências e forneça feedbacks aos colaboradores.',
    link: '/minha-equipe',
    botaoTexto: 'Acessar avaliações',
  },
  {
    etapa: 5,
    titulo: 'Conferir o ponto da equipe',
    descricao: 'Acompanhe as batidas de ponto, inconsistências, atrasos e horas extras da equipe.',
    link: '/ponto/gestao',
    botaoTexto: 'Conferir gestão de ponto',
  },
]

export const onboardingGestorService = {
  /**
   * Obtém o progresso de onboarding de um gestor específico
   */
  async getProgressoGestor(
    tenantId: string,
    gestorUserId: string,
  ): Promise<{
    registros: OnboardingGestorRecord[]
    concluidasSet: Set<number>
    percentual: number
    isConcluido: boolean
    isNovoGestor: boolean
  }> {
    try {
      const records = await pb.collection('onboarding_gestor').getFullList<OnboardingGestorRecord>({
        filter: `tenant_id = "${tenantId}" && gestor_user_id = "${gestorUserId}"`,
      })

      const concluidasSet = new Set<number>()
      records.forEach((r) => {
        if (r.concluida) {
          concluidasSet.add(r.etapa)
        }
      })

      const totalEtapas = ETAPAS_ONBOARDING_GESTOR.length
      const concluidasCount = concluidasSet.size
      const percentual = Math.round((concluidasCount / totalEtapas) * 100)
      const isConcluido = concluidasCount === totalEtapas
      const isNovoGestor = records.length === 0

      return {
        registros: records,
        concluidasSet,
        percentual,
        isConcluido,
        isNovoGestor,
      }
    } catch (err) {
      console.warn('Erro ao carregar onboarding do gestor:', err)
      return {
        registros: [],
        concluidasSet: new Set(),
        percentual: 0,
        isConcluido: false,
        isNovoGestor: true,
      }
    }
  },

  /**
   * Marca ou desmarca uma etapa como concluída.
   * Se for a última etapa concluída, envia notificação in-app de parabéns.
   */
  async alternarEtapa(
    tenantId: string,
    gestorUserId: string,
    etapa: number,
    concluida: boolean,
  ): Promise<{
    registro: OnboardingGestorRecord
    todasConcluidas: boolean
  }> {
    // Buscar registro existente para esta etapa
    let registroExistente: OnboardingGestorRecord | null = null
    try {
      const results = await pb
        .collection('onboarding_gestor')
        .getList<OnboardingGestorRecord>(1, 1, {
          filter: `tenant_id = "${tenantId}" && gestor_user_id = "${gestorUserId}" && etapa = ${etapa}`,
        })
      if (results.items.length > 0) {
        registroExistente = results.items[0]
      }
    } catch {
      /* intentionally ignored */
    }

    let record: OnboardingGestorRecord
    if (registroExistente) {
      record = await pb
        .collection('onboarding_gestor')
        .update<OnboardingGestorRecord>(registroExistente.id, { concluida })
    } else {
      record = await pb.collection('onboarding_gestor').create<OnboardingGestorRecord>({
        tenant_id: tenantId,
        gestor_user_id: gestorUserId,
        etapa,
        concluida,
      })
    }

    // Checar se todas as 5 etapas estão concluídas
    const progresso = await this.getProgressoGestor(tenantId, gestorUserId)
    const todasConcluidas = progresso.isConcluido

    if (todasConcluidas && concluida) {
      try {
        await notificacaoService.notificar({
          tenantId,
          destinatarioId: gestorUserId,
          tipo: 'geral',
          titulo: 'Parabéns! Onboarding de liderança concluído 🎉',
          mensagem:
            'Você completou com sucesso todas as etapas do checklist de boas-vindas do gestor. Sua liderança está pronta para apoiar a equipe!',
          link: '/portal-gestor',
        })
      } catch (notifErr) {
        console.warn('Erro ao enviar notificação de parabéns do onboarding:', notifErr)
      }
    }

    return { registro: record, todasConcluidas }
  },

  /**
   * Reseta o checklist (opcional para rever/reabrir)
   */
  async resetarProgresso(tenantId: string, gestorUserId: string): Promise<void> {
    const records = await pb.collection('onboarding_gestor').getFullList<OnboardingGestorRecord>({
      filter: `tenant_id = "${tenantId}" && gestor_user_id = "${gestorUserId}"`,
    })
    for (const r of records) {
      await pb.collection('onboarding_gestor').update(r.id, { concluida: false })
    }
  },
}
