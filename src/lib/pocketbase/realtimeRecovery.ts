/**
 * Utilitário de resiliência e auto-recuperação para o serviço Realtime do PocketBase.
 *
 * Trata cenários onde a conexão SSE foi encerrada no servidor ou perdeu sincronismo,
 * retornando HTTP 400 ("Invalid realtime client.") ao tentar submeter subscriptions
 * (POST /api/realtime).
 *
 * Funcionalidades:
 * 1. Intercepta erros "Invalid realtime client" na submissão de subscriptions.
 * 2. Ao detectar o erro: descarta o clientId inválido, fecha a conexão SSE e solicita
 *    reconexão automática com novo stream GET /api/realtime.
 * 3. Aplica backoff exponencial limitado para evitar loops infinitos.
 * 4. Silencia o estouro de exceção não tratada no console, mantendo logs discretos de aviso/debug.
 * 5. Garante que chamadas a sendSubscriptions só sejam executadas se o cliente SSE estiver ativo ou
 *    reagendadas ordenadamente.
 */

import pb from '@/lib/pocketbase/client'

// Tipagem flexível para acessar campos internos do RealtimeService do PocketBase
interface InternalRealtimeService {
  clientId: string
  isConnected: boolean
  sendSubscriptions?: () => Promise<void>
  finalizePendingSubscriptions?: () => Promise<void>
  submitSubscriptions?: () => Promise<void>
  connect?: () => Promise<void>
  disconnect?: (fromReconnect?: boolean) => void
  initConnect?: () => void
  [key: string]: unknown
}

let isRealtimeRecoveryPatched = false
let reconnectRetryCount = 0
const MAX_RECONNECT_RETRIES = 5
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null

/**
 * Inicializa a camada de auto-recuperação no pb.realtime.
 * É idempotente e pode ser chamado na inicialização ou nos hooks de subscrição.
 */
export function setupRealtimeRecovery(): void {
  if (isRealtimeRecoveryPatched) return

  const realtime = pb.realtime as unknown as InternalRealtimeService
  if (!realtime) return

  const originalSendSubscriptions = realtime.sendSubscriptions

  if (typeof originalSendSubscriptions === 'function') {
    realtime.sendSubscriptions = async function patchedSendSubscriptions() {
      // Se não há clientId ou o serviço já foi desconectado, não adianta tentar enviar
      if (!realtime.clientId) {
        return
      }

      try {
        await originalSendSubscriptions.apply(this)
        // Se a chamada sucedeu, resetamos o contador de retentativas
        reconnectRetryCount = 0
      } catch (err: unknown) {
        const errorMsg =
          (err as { message?: string })?.message ||
          (err as { originalError?: { message?: string } })?.originalError?.message ||
          (err as { data?: { message?: string } })?.data?.message ||
          String(err)

        const status = (err as { status?: number })?.status

        const isInvalidClient =
          status === 400 ||
          errorMsg.toLowerCase().includes('invalid realtime client') ||
          errorMsg.toLowerCase().includes('missing or invalid client id')

        if (isInvalidClient) {
          // Log discreto informativo para diagnóstico sem poluir o console com unhandled rejection
          if (import.meta.env.DEV) {
            console.debug(
              '[RealtimeService] Conexão realtime expirada ou clientId inválido. Recuperando conexão...',
            )
          }

          // Descarta o clientId antigo e força o encerramento do SSE atual
          if (typeof realtime.disconnect === 'function') {
            realtime.disconnect(true)
          } else {
            realtime.clientId = ''
          }

          // Backoff exponencial limitado
          if (reconnectRetryCount < MAX_RECONNECT_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, reconnectRetryCount), 10000)
            reconnectRetryCount++

            if (reconnectTimeoutId) {
              clearTimeout(reconnectTimeoutId)
            }

            reconnectTimeoutId = setTimeout(() => {
              if (typeof realtime.connect === 'function') {
                realtime.connect().catch((connectErr: unknown) => {
                  if (import.meta.env.DEV) {
                    console.debug('[RealtimeService] Falha ao reconectar realtime:', connectErr)
                  }
                })
              }
            }, delay)
          } else {
            console.warn('[RealtimeService] Limite de tentativas de reconexão realtime atingido.')
          }

          // Retorna silenciosamente para não estourar uncaught rejection no microtask runner
          return
        }

        // Se for abort da requisição, ignora
        if ((err as { isAbort?: boolean })?.isAbort) {
          return
        }

        // Para outros erros transitórios de rede, log discreto
        console.warn('[RealtimeService] Aviso ao enviar subscriptions de realtime:', errorMsg)
      }
    }
  }

  isRealtimeRecoveryPatched = true
}

// Inicializa imediatamente ao carregar o módulo
setupRealtimeRecovery()
