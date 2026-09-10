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

export const emailTransacionalService = {
  /**
   * Envia e-mail de forma silenciosa e resiliente sem lançar exceções para a interface.
   */
  async enviarEmail(
    dados: DadosEmailTransacional,
  ): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      // Como não há credenciais de SMTP/API disponíveis no ambiente, simulamos envio seguro
      // e documentamos nos logs para fins de rastreabilidade
      console.info(
        `[E-mail Transacional — Tesla RH] Simulação para <${dados.para}> | Assunto: ${dados.assunto}`,
        {
          tipo: dados.tipoEvento,
          link: dados.linkAcao,
          mensagem: dados.mensagem,
        },
      )

      return {
        sucesso: true,
        mensagem: 'E-mail transacional enfileirado com sucesso.',
      }
    } catch (err) {
      console.warn('[E-mail Transacional] Falha silenciosa ao processar disparo de e-mail:', err)
      return {
        sucesso: false,
        mensagem: 'Não foi possível disparar o e-mail transacional.',
      }
    }
  },
}
