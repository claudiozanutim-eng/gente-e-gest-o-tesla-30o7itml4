import pb from '@/lib/pocketbase/client'
import {
  streamAgentChat,
  displayableMessages,
  type AgentMessage,
  type DisplayMessage,
  type AgentCitation,
} from '@/lib/skipAi'

export interface NikoConversationSummary {
  id: string
  title?: string
  created?: string
  updated?: string
}

export interface NikoChatSendParams {
  message: string
  conversationId?: string | null
  signal?: AbortSignal
  onChunk?: (delta: string, full: string) => void
  onCitations?: (citations: AgentCitation[]) => void
}

export const nikoRhService = {
  /**
   * Envia mensagem para o agente nativo NIKO RH via streaming com SSE.
   * Se a stream falhar ou não suportar SSE, tem fallback automático para requisição síncrona.
   */
  async sendMessageStream(params: NikoChatSendParams): Promise<{
    conversationId: string
    messageId: string
    content: string
    citations?: AgentCitation[]
  }> {
    const { message, conversationId, signal, onChunk, onCitations } = params
    const token = pb.authStore.token

    if (!token) {
      throw new Error('Sessão expirada ou usuário não autenticado.')
    }

    const url = `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/niko/chat-stream`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
        },
        body: JSON.stringify({
          message,
          conversation_id: conversationId || null,
        }),
        signal,
      })

      const streamResult = await streamAgentChat(res, {
        onChunk: (delta, accumulated) => {
          onChunk?.(delta, accumulated)
        },
        onCitations: (items) => {
          onCitations?.(items)
        },
        signal,
      })

      const finalConvId =
        res.headers.get('X-Conversation-Id') || streamResult.conversation_id || conversationId || ''

      return {
        conversationId: finalConvId,
        messageId: streamResult.message_id,
        content: streamResult.content,
        citations: streamResult.citations,
      }
    } catch (err: unknown) {
      // Se for abort intencional, propaga
      if (signal?.aborted) {
        throw err
      }

      console.warn('Falha na stream do NIKO RH, tentando rota síncrona de fallback...', err)
      return this.sendMessageSync(message, conversationId || null)
    }
  },

  /**
   * Envia mensagem síncrona diretamente para o NIKO RH
   */
  async sendMessageSync(
    message: string,
    conversationId: string | null = null,
  ): Promise<{
    conversationId: string
    messageId: string
    content: string
    citations?: AgentCitation[]
  }> {
    const token = pb.authStore.token
    if (!token) throw new Error('Sessão expirada')

    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/niko/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Falha ao conversar com NIKO RH')
    }

    return {
      conversationId: data.conversation_id,
      messageId: data.message_id,
      content: data.content,
      citations: data.citations,
    }
  },

  /**
   * Lista as conversas anteriores do usuário com o NIKO RH
   */
  async listConversations(limit = 20): Promise<NikoConversationSummary[]> {
    const token = pb.authStore.token
    if (!token) return []

    try {
      const res = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/niko/conversations?limit=${limit}`,
        {
          headers: { Authorization: token },
        },
      )
      if (!res.ok) return []
      const payload = (await res.json()) as { conversations?: NikoConversationSummary[] }
      return payload.conversations || []
    } catch (err) {
      console.warn('Erro ao carregar conversas do NIKO RH:', err)
      return []
    }
  },

  /**
   * Carrega mensagens tratadas de uma conversa específica
   */
  async loadConversationMessages(conversationId: string): Promise<DisplayMessage[]> {
    const token = pb.authStore.token
    if (!token) return []

    try {
      const res = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/niko/conversations/${conversationId}/messages`,
        {
          headers: { Authorization: token },
        },
      )
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData?.error || 'Falha ao obter histórico de mensagens')
      }

      const payload = (await res.json()) as { messages?: AgentMessage[] }
      const raw = payload.messages || []
      return displayableMessages(raw)
    } catch (err) {
      console.warn(`Erro ao carregar mensagens da conversa ${conversationId}:`, err)
      throw err
    }
  },
}
