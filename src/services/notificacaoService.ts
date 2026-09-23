import pb from '@/lib/pocketbase/client'
import { Notificacao, NotificacaoTipo } from '@/types'
import { emailTransacionalService } from '@/services/emailService'

export interface CriarNotificacaoDTO {
  tenantId: string
  destinatarioId: string
  tipo: NotificacaoTipo
  titulo: string
  mensagem: string
  link?: string
  emailDestinatario?: string
  nomeDestinatario?: string
}

export const notificacaoService = {
  /**
   * Lista notificações do destinatário ordenadas da mais recente para a mais antiga
   */
  async getNotificacoesUsuario(destinatarioId: string, limit = 20): Promise<Notificacao[]> {
    try {
      const records = await pb.collection('notificacao').getList<Notificacao>(1, limit, {
        filter: `destinatario_id = "${destinatarioId}"`,
        sort: '-created',
      })
      return records.items
    } catch (err) {
      console.error('Erro ao buscar notificações do usuário:', err)
      return []
    }
  },

  /**
   * Conta quantidade de notificações não lidas
   */
  async getContagemNaoLidas(destinatarioId: string): Promise<number> {
    try {
      const result = await pb.collection('notificacao').getList(1, 1, {
        filter: `destinatario_id = "${destinatarioId}" && lida = false`,
      })
      return result.totalItems
    } catch (err) {
      console.warn('Erro ao contar notificações não lidas:', err)
      return 0
    }
  },

  /**
   * Marca uma notificação como lida
   */
  async marcarComoLida(notificacaoId: string): Promise<boolean> {
    try {
      await pb.collection('notificacao').update(notificacaoId, {
        lida: true,
      })
      return true
    } catch (err) {
      console.error('Erro ao marcar notificação como lida:', err)
      return false
    }
  },

  /**
   * Marca todas as notificações do usuário como lidas
   */
  async marcarTodasComoLidas(destinatarioId: string): Promise<boolean> {
    try {
      const naoLidas = await pb.collection('notificacao').getFullList<Notificacao>({
        filter: `destinatario_id = "${destinatarioId}" && lida = false`,
      })
      await Promise.all(
        naoLidas.map((item) =>
          pb.collection('notificacao').update(item.id, {
            lida: true,
          }),
        ),
      )
      return true
    } catch (err) {
      console.error('Erro ao marcar todas notificações como lidas:', err)
      return false
    }
  },

  /**
   * Cria notificação in-app e dispara tentativa de e-mail transacional isolada
   */
  async notificar(dto: CriarNotificacaoDTO): Promise<Notificacao | null> {
    try {
      const record = await pb.collection('notificacao').create<Notificacao>({
        tenant_id: dto.tenantId,
        destinatario_id: dto.destinatarioId,
        tipo: dto.tipo,
        titulo: dto.titulo,
        mensagem: dto.mensagem,
        link: dto.link || '',
        lida: false,
      })

      // Se houver e-mail do destinatário, despacha silenciosamente pelo serviço isolado
      if (dto.emailDestinatario) {
        emailTransacionalService
          .enviarEmail({
            para: dto.emailDestinatario,
            destinatarioNome: dto.nomeDestinatario,
            assunto: `[Tesla RH] ${dto.titulo}`,
            mensagem: dto.mensagem,
            linkAcao: dto.link,
            tipoEvento: dto.tipo === 'ferias' ? 'ferias_aprovada' : 'geral',
          })
          .catch(() => {})
      }

      return record
    } catch (err) {
      console.warn('Erro ao criar notificação in-app:', err)
      return null
    }
  },

  /**
   * Notifica todos os gestores de um tenant ou setor
   */
  /**
   * Notifica todos os gestores de um tenant ou setor
   */
  async notificarGestores(
    tenantId: string,
    dados: {
      titulo: string
      mensagem: string
      link?: string
      departamento?: string
      tipo?: NotificacaoTipo
    },
  ): Promise<void> {
    try {
      const usersGestores = await pb.collection('users').getFullList({
        filter: `tenant_id = "${tenantId}" && (perfil = "gestor" || perfil = "rh" || perfil = "admin_rh" || perfil = "admin")`,
      })

      await Promise.all(
        usersGestores.map((u) =>
          this.notificar({
            tenantId,
            destinatarioId: u.id,
            tipo: dados.tipo || 'geral',
            titulo: dados.titulo,
            mensagem: dados.mensagem,
            link: dados.link,
            emailDestinatario: u.email,
            nomeDestinatario: u.name,
          }),
        ),
      )
    } catch (err) {
      console.warn('Erro ao notificar gestores:', err)
    }
  },

  /**
   * Notifica a equipe de RH e Administradores do tenant (ex: nova solicitação cadastral pendente)
   */
  async notificarRH(
    tenantId: string,
    dados: { titulo: string; mensagem: string; link?: string; tipo?: NotificacaoTipo },
  ): Promise<void> {
    try {
      const usersRH = await pb.collection('users').getFullList({
        filter: `tenant_id = "${tenantId}" && (perfil = "rh" || perfil = "admin_rh" || perfil = "admin")`,
      })

      await Promise.all(
        usersRH.map((u) =>
          this.notificar({
            tenantId,
            destinatarioId: u.id,
            tipo: dados.tipo || 'cadastro',
            titulo: dados.titulo,
            mensagem: dados.mensagem,
            link: dados.link,
            emailDestinatario: u.email,
            nomeDestinatario: u.name,
          }),
        ),
      )
    } catch (err) {
      console.warn('Erro ao notificar equipe de RH:', err)
    }
  },
}
