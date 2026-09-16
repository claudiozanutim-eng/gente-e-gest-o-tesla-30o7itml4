// Endpoint de chat síncrono e streaming com o agente nativo NIKO RH
// Rota síncrona: POST /backend/v1/niko/chat
// Rota streaming: POST /backend/v1/niko/chat-stream
// Rota de histórico de conversas: GET /backend/v1/niko/conversations
// Rota de mensagens de uma conversa: GET /backend/v1/niko/conversations/{conversationId}/messages

routerAdd(
  'POST',
  '/backend/v1/niko/chat',
  (e) => {
    try {
      const authRecord = e.auth
      const userId = authRecord?.id
      if (!userId) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const body = e.requestInfo().body || {}
      const message = (body.message || '').trim()
      if (!message) {
        return e.json(400, { message: 'Mensagem é obrigatória' })
      }

      const conversationId = body.conversation_id || null

      const result = $ai.agent('niko-rh').chat({
        user_id: userId,
        conversation_id: conversationId,
        message: message,
      })

      // Auditoria leve: registrar interação com o agente
      try {
        const tenantId = authRecord.getString('tenant_id')
        if (tenantId) {
          const auditCol = $app.findCollectionByNameOrId('log_auditoria')
          const log = new Record(auditCol)
          log.set('tenant_id', tenantId)
          log.set('user_id', userId)
          log.set('acao', 'consulta_niko_rh')
          log.set('entidade', 'niko_rh_chat')
          log.set('entidade_id', result.conversation_id || '')
          log.set('dados_json', {
            tipo: 'sync',
            mensagem_tamanho: message.length,
            resposta_tamanho: (result.content || '').length,
            iteracoes: result.iterations || 1,
          })
          log.set('data_hora', new Date().toISOString())
          $app.save(log)
        }
      } catch (auditErr) {
        // Falha de auditoria não deve quebrar a resposta ao usuário
      }

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations,
        message_id: result.message_id,
        iterations: result.iterations,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço do NIKO RH temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, { error: status >= 500 ? 'Falha ao consultar NIKO RH' : err.message })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, { error: status >= 500 ? 'Serviço de IA indisponível' : err.message })
      }
      return e.json(500, { error: err.message || 'Erro interno ao processar chat' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/niko/chat-stream',
  (e) => {
    try {
      const authRecord = e.auth
      const userId = authRecord?.id
      if (!userId) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const body = e.requestInfo().body || {}
      const message = (body.message || '').trim()
      if (!message) {
        return e.json(400, { message: 'Mensagem é obrigatória' })
      }

      const conv = $ai.agent('niko-rh').getOrCreateConversation({
        user_id: userId,
        id: body.conversation_id || null,
        title: body.title || 'Consulta NIKO RH',
      })

      const iter = $ai.agent('niko-rh').chat({
        user_id: userId,
        conversation_id: conv.id,
        message: message,
        stream: true,
      })

      // Auditoria leve
      try {
        const tenantId = authRecord.getString('tenant_id')
        if (tenantId) {
          const auditCol = $app.findCollectionByNameOrId('log_auditoria')
          const log = new Record(auditCol)
          log.set('tenant_id', tenantId)
          log.set('user_id', userId)
          log.set('acao', 'consulta_niko_rh_stream')
          log.set('entidade', 'niko_rh_chat')
          log.set('entidade_id', conv.id)
          log.set('dados_json', {
            tipo: 'stream',
            mensagem_tamanho: message.length,
          })
          log.set('data_hora', new Date().toISOString())
          $app.save(log)
        }
      } catch (_) {}

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)
      return $response.stream(e, iter)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço do NIKO RH temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha ao iniciar streaming do NIKO RH' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, { error: status >= 500 ? 'Serviço de IA indisponível' : err.message })
      }
      return e.json(500, { error: err.message || 'Erro interno ao iniciar chat em streaming' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/niko/conversations',
  (e) => {
    try {
      const authRecord = e.auth
      const userId = authRecord?.id
      if (!userId) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const query = e.requestInfo().query || {}
      const limit = parseInt(query.limit || '20', 10) || 20

      const conversations = $ai.agent('niko-rh').listConversations({
        user_id: userId,
        limit: limit,
      })

      return e.json(200, { conversations: conversations })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao listar conversas' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/niko/conversations/{conversationId}/messages',
  (e) => {
    try {
      const authRecord = e.auth
      const userId = authRecord?.id
      if (!userId) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const conversationId = e.request.pathValue('conversationId')
      if (!conversationId) {
        return e.json(400, { message: 'ID da conversa é obrigatório' })
      }

      const result = $ai.agent('niko-rh').listMessages({
        conversation_id: conversationId,
        user_id: userId,
        limit: 50,
      })

      return e.json(200, result)
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, { error: status >= 500 ? 'Conversa não encontrada' : err.message })
      }
      return e.json(500, { error: err.message || 'Erro ao buscar histórico da conversa' })
    }
  },
  $apis.requireAuth(),
)
