/**
 * Serviço de Envio de E-mails Transacionais
 *
 * Como não há provedor SMTP / chaves de e-mail (SendGrid/Resend) configuradas nos secrets do backend
 * (apenas segredos de infraestrutura interna Skip Cloud), este serviço atua de forma resiliente e isolada:
 * - Registra os eventos transacionais no console / logs de auditoria
 * - Nunca falha ou quebra a navegação/fluxo do usuário
 * - Pode ser conectado facilmente a uma API real de e-mails caso secrets SMTP sejam fornecidos no futuro.
 */

export interface DadosEmailTransacional {
  para: string
  assunto: string
  mensagem: string
  destinatarioNome?: string
  linkAcao?: string
  tipoEvento:
    | 'ferias_aprovada'
    | 'ferias_rejeitada'
    | 'holerite_disponivel'
    | 'ciencia_pendente'
    | 'compensacao_aprovada'
    | 'compensacao_recusada'
    | 'atestado_validado'
    | 'comunicado_publicado'
    | 'cadastro_aprovado'
    | 'cadastro_rejeitado'
    | 'avaliacao_recebida'
    | 'geral'
}

import pb from '@/lib/pocketbase/client'
import { SmtpConfig, EmailLog } from '@/types'

export const emailTransacionalService = {
  /**
   * Envia e-mail de forma silenciosa e resiliente sem lançar exceções para a interface.
   */
  async enviarEmail(
    dados: DadosEmailTransacional,
  ): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      console.info(
        `[E-mail Transacional — Tesla RH] Notificação para <${dados.para}> | Assunto: ${dados.assunto}`,
        {
          tipo: dados.tipoEvento,
          link: dados.linkAcao,
          mensagem: dados.mensagem,
        },
      )

      return {
        sucesso: true,
        mensagem: 'E-mail transacional processado.',
      }
    } catch (err) {
      console.warn('[E-mail Transacional] Falha ao processar disparo de e-mail:', err)
      return {
        sucesso: false,
        mensagem: 'Não foi possível disparar o e-mail transacional.',
      }
    }
  },

  /**
   * Obtém a configuração SMTP do tenant.
   */
  async getSmtpConfig(tenantId: string): Promise<SmtpConfig | null> {
    try {
      const records = await pb.collection('smtp_config').getFullList<SmtpConfig>({
        filter: `tenant_id = "${tenantId}"`,
        sort: '-created',
      })
      if (records.length === 0) return null
      return records[0]
    } catch (err) {
      console.error('Erro ao buscar configuração SMTP:', err)
      return null
    }
  },

  /**
   * Salva ou atualiza a configuração SMTP do tenant
   */
  async salvarSmtpConfig(
    tenantId: string,
    data: {
      id?: string
      host: string
      porta: number
      usuario?: string
      senha?: string
      remetente_nome: string
      remetente_email: string
      ativo: boolean
      tls: boolean
    },
  ): Promise<SmtpConfig> {
    const payload: Partial<SmtpConfig> = {
      tenant_id: tenantId,
      host: data.host,
      porta: Number(data.porta),
      usuario: data.usuario || '',
      remetente_nome: data.remetente_nome,
      remetente_email: data.remetente_email,
      ativo: Boolean(data.ativo),
      tls: Boolean(data.tls),
    }

    if (data.senha && data.senha.trim().length > 0) {
      payload.senha = data.senha
    }

    if (data.id) {
      return await pb.collection('smtp_config').update<SmtpConfig>(data.id, payload)
    } else {
      return await pb.collection('smtp_config').create<SmtpConfig>(payload)
    }
  },

  /**
   * Dispara teste de envio SMTP para o e-mail do admin logado
   */
  async testarEnvioSmtp(): Promise<{ success: boolean; message: string }> {
    const res = await pb.send<{ success: boolean; message: string }>(
      '/backend/v1/tesla/test-smtp',
      {
        method: 'POST',
      },
    )
    return res
  },

  /**
   * Lista os logs de diagnóstico de e-mail do tenant
   */
  async getEmailLogs(tenantId: string, limit = 50): Promise<EmailLog[]> {
    try {
      const records = await pb.collection('email_log').getList<EmailLog>(1, limit, {
        filter: `tenant_id = "${tenantId}"`,
        sort: '-created',
      })
      return records.items
    } catch (err) {
      console.error('Erro ao buscar logs de e-mail:', err)
      return []
    }
  },
}
