/**
 * Helper utilitário para envio de e-mails usando a configuração SMTP do tenant.
 * ATENÇÃO: As callbacks do PocketBase JSVM rodam em instâncias isoladas,
 * portanto as funções auxiliares e variáveis devem ficar estritamente DENTRO
 * de cada callback (sem closures/variáveis top-level compartilhadas).
 */

// Hook disparado sempre que uma notificação in-app é criada
onRecordAfterCreateSuccess((e) => {
  const notif = e.record
  const tenantId = notif.getString('tenant_id')
  const destinatarioId = notif.getString('destinatario_id')
  const titulo = notif.getString('titulo')
  const mensagem = notif.getString('mensagem')
  const link = notif.getString('link')
  const tipo = notif.getString('tipo') || 'geral'
  const notifId = notif.getString('id')

  if (!tenantId || !destinatarioId) return

  const emailLogCol = e.app.findCollectionByNameOrId('email_log')

  try {
    // 1. Buscar usuário destinatário
    const user = e.app.findRecordById('users', destinatarioId)
    if (!user) return

    // Buscar e-mail do usuário (ou fallback de e-mail cadastrado na ficha do colaborador)
    let emailDestino = user.getString('email') || ''
    let nomeDestino = user.getString('name') || ''

    if (!emailDestino) {
      try {
        const colabRecs = e.app.findRecordsByFilter(
          'colaborador',
          "user_id = '" + destinatarioId + "'",
          '-created',
          1,
          0,
        )
        if (colabRecs && colabRecs.length > 0) {
          emailDestino = colabRecs[0].getString('email') || ''
          if (!nomeDestino) {
            nomeDestino =
              colabRecs[0].getString('nome_completo') || colabRecs[0].getString('nome') || ''
          }
        }
      } catch (_) {}
    }

    if (!emailDestino || emailDestino.indexOf('@') === -1) {
      // Destinatário não possui e-mail válido cadastrado
      return
    }

    // 2. Anti-spam / Prevenção de duplicidade:
    // Não reenviar e-mail com mesmo assunto e destinatário se já foi enviado recentemente (últimos 3 minutos)
    // ou se já existe log com este evento_ref (id da notificação)
    try {
      const logsExistentes = e.app.findRecordsByFilter(
        'email_log',
        "tenant_id = '" +
          tenantId +
          "' && destinatario = '" +
          emailDestino +
          "' && (evento_ref = '" +
          notifId +
          "' || (assunto = '" +
          titulo.replace(/'/g, "\\'") +
          "' && status = 'enviado'))",
        '-created',
        3,
        0,
      )

      if (logsExistentes && logsExistentes.length > 0) {
        const agoraMs = new Date().getTime()
        for (let i = 0; i < logsExistentes.length; i++) {
          const l = logsExistentes[i]
          const ref = l.getString('evento_ref')
          if (ref && ref === notifId) {
            // Já processado para este mesmo evento
            return
          }
          const criadoIso = l.getString('created')
          if (criadoIso) {
            const criadoMs = new Date(criadoIso).getTime()
            // Se já foi enviado mesmo assunto para mesmo destinatário nos últimos 120 segundos, ignora
            if (agoraMs - criadoMs < 120000 && l.getString('status') === 'enviado') {
              return
            }
          }
        }
      }
    } catch (errAntiSpam) {
      console.log('Aviso na checagem anti-spam de email_log:', errAntiSpam)
    }

    // 3. Buscar configuração SMTP do tenant
    let smtpRecord = null
    try {
      const records = e.app.findRecordsByFilter(
        'smtp_config',
        "tenant_id = '" + tenantId + "'",
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        smtpRecord = records[0]
      }
    } catch (errFind) {
      console.log('Erro ao buscar smtp_config para tenant ' + tenantId + ':', errFind)
    }

    // Se não existir configuração ou estiver inativa
    if (!smtpRecord || !smtpRecord.getBool('ativo')) {
      const motivoInativo = smtpRecord
        ? 'Configuração SMTP inativa'
        : 'Configuração SMTP não cadastrada'

      const logRec = new Record(emailLogCol)
      logRec.set('tenant_id', tenantId)
      logRec.set('destinatario', emailDestino)
      logRec.set('assunto', titulo)
      logRec.set('status', 'pendente_envio')
      logRec.set('erro', motivoInativo)
      try {
        logRec.set('tipo_evento', tipo)
        logRec.set('evento_ref', notifId)
      } catch (_) {}

      try {
        e.app.save(logRec)
      } catch (eLog) {
        console.log('Falha ao salvar log pendente_envio:', eLog)
      }
      return
    }

    // 4. Com SMTP ativo, montar envio
    const host = smtpRecord.getString('host')
    const porta = smtpRecord.getInt('porta') || 587
    const usuario = smtpRecord.getString('usuario') || ''
    const senha = smtpRecord.getString('senha') || ''
    const remetenteNome = smtpRecord.getString('remetente_nome') || 'Gente e Gestão Tesla'
    const remetenteEmail = smtpRecord.getString('remetente_email') || 'noreply@teslarh.com.br'
    const tls = smtpRecord.getBool('tls')

    const saudacao = nomeDestino
      ? '<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151;">Olá, <strong>' +
        nomeDestino +
        '</strong>!</p>'
      : ''

    const actionBtn = link
      ? '<div style="margin: 28px 0 10px 0;"><a href="' +
        link +
        '" style="background-color: #0D47A1; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px; box-shadow: 0 2px 4px rgba(13,71,161,0.2);">Acessar no Sistema</a></div>'
      : ''

    const corpoHtml =
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' +
      titulo +
      "</title></head><body style=\"margin:0; padding:0; background-color:#F5F5F5; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#212121; -webkit-font-smoothing: antialiased;\">" +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F5F5F5; padding: 36px 12px;">' +
      '<tr><td align="center">' +
      '<table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius: 12px; overflow:hidden; border: 1px solid #E0E0E0; max-width:600px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">' +
      // Header com Azul Tesla (#0D47A1)
      '<tr><td style="background-color:#0D47A1; padding: 22px 32px; text-align: left;">' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
      '<td><span style="color:#ffffff; font-size: 19px; font-weight: 700; letter-spacing: -0.3px;">Gente e Gestão Tesla</span><div style="color:#BBDEFB; font-size: 11px; margin-top: 3px; font-weight: 500;">Plataforma de Gestão de Pessoas & RH</div></td>' +
      '<td align="right"><span style="background-color: rgba(255,255,255,0.18); color: #ffffff; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">Notificação</span></td>' +
      '</tr></table>' +
      '</td></tr>' +
      // Conteúdo
      '<tr><td style="padding: 36px 32px;">' +
      saudacao +
      '<h2 style="margin: 0 0 16px 0; font-size: 19px; font-weight: 700; color:#0D47A1; line-height: 1.3;">' +
      titulo +
      '</h2>' +
      '<div style="font-size: 14.5px; line-height: 1.65; color:#424242; white-space: pre-line; background-color: #FAFAFA; border-left: 3px solid #0D47A1; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">' +
      mensagem +
      '</div>' +
      actionBtn +
      '</td></tr>' +
      // Rodapé Institucional
      '<tr><td style="background-color:#FAFAFA; border-top: 1px solid #EEEEEE; padding: 22px 32px; text-align: center;">' +
      '<p style="margin:0 0 6px 0; font-size: 12px; font-weight: 700; color:#0D47A1;">Gente e Gestão Tesla</p>' +
      '<p style="margin:0 0 4px 0; font-size: 11px; color:#757575;">Esta é uma notificação automática corporativa gerada pelo sistema.</p>' +
      '<p style="margin:0; font-size: 10px; color:#9E9E9E;">Por favor, não responda diretamente a este e-mail.</p>' +
      '</td></tr>' +
      '</table></td></tr></table></body></html>'

    const mailerClient = $mailer.newSmtpClient({
      host: host,
      port: porta,
      username: usuario,
      password: senha,
      tls: tls,
    })

    const msg = new MailerMessage({
      from: {
        address: remetenteEmail,
        name: remetenteNome,
      },
      to: [
        {
          address: emailDestino,
          name: nomeDestino || emailDestino,
        },
      ],
      subject: titulo,
      html: corpoHtml,
      text: mensagem,
    })

    mailerClient.send(msg)

    // Log de sucesso com tipo_evento e evento_ref
    const logRec = new Record(emailLogCol)
    logRec.set('tenant_id', tenantId)
    logRec.set('destinatario', emailDestino)
    logRec.set('assunto', titulo)
    logRec.set('status', 'enviado')
    logRec.set('erro', '')
    try {
      logRec.set('tipo_evento', tipo)
      logRec.set('evento_ref', notifId)
    } catch (_) {}
    e.app.save(logRec)
  } catch (err) {
    const erroMsg = err && err.message ? err.message : String(err)
    console.log('Erro ao processar envio de e-mail na notificação:', erroMsg)

    try {
      const user = e.app.findRecordById('users', destinatarioId)
      const userEmail = user ? user.getString('email') : 'desconhecido'
      const logRec = new Record(emailLogCol)
      logRec.set('tenant_id', tenantId)
      logRec.set('destinatario', userEmail)
      logRec.set('assunto', titulo)
      logRec.set('status', 'falha')
      logRec.set('erro', erroMsg)
      try {
        logRec.set('tipo_evento', tipo)
        logRec.set('evento_ref', notifId)
      } catch (_) {}
      e.app.save(logRec)
    } catch (_) {}
  }
}, 'notificacao')

// Endpoint para testar o envio de e-mail pelo admin
routerAdd('POST', '/backend/v1/tesla/test-smtp', (c) => {
  const auth = c.get('authRecord')
  if (!auth) {
    return c.json(401, { message: 'Não autorizado.' })
  }

  const perfil = auth.getString('perfil')
  if (perfil !== 'admin' && perfil !== 'admin_rh') {
    return c.json(403, { message: 'Apenas administradores podem testar o envio de e-mail.' })
  }

  const tenantId = auth.getString('tenant_id')
  let destinatarioTeste = auth.getString('email')
  try {
    const body = c.requestInfo().body
    if (body && body.destinatario && String(body.destinatario).trim().length > 0) {
      destinatarioTeste = String(body.destinatario).trim()
    }
  } catch (_) {}

  if (!destinatarioTeste) {
    return c.json(400, { message: 'Informe um e-mail de destino para o teste.' })
  }

  const emailLogCol = c.app.findCollectionByNameOrId('email_log')

  // Buscar config SMTP do tenant
  let smtpRecord = null
  try {
    const records = c.app.findRecordsByFilter(
      'smtp_config',
      "tenant_id = '" + tenantId + "'",
      '-created',
      1,
      0,
    )
    if (records && records.length > 0) {
      smtpRecord = records[0]
    }
  } catch (errFind) {
    console.log('Erro ao buscar smtp_config para teste:', errFind)
  }

  if (!smtpRecord || !smtpRecord.getBool('ativo')) {
    const logRec = new Record(emailLogCol)
    logRec.set('tenant_id', tenantId)
    logRec.set('destinatario', destinatarioTeste)
    logRec.set('assunto', 'Teste de Conexão SMTP — Gente e Gestão Tesla')
    logRec.set('status', 'pendente_envio')
    logRec.set(
      'erro',
      smtpRecord ? 'Configuração SMTP inativa' : 'Configuração SMTP não cadastrada',
    )
    try {
      logRec.set('tipo_evento', 'teste_smtp')
    } catch (_) {}
    try {
      c.app.save(logRec)
    } catch (_) {}

    return c.json(400, {
      success: false,
      message:
        'SMTP não configurado ou inativo para este tenant. Configure os parâmetros e ative o serviço antes de testar.',
    })
  }

  const host = smtpRecord.getString('host')
  const porta = smtpRecord.getInt('porta') || 587
  const usuario = smtpRecord.getString('usuario') || ''
  const senha = smtpRecord.getString('senha') || ''
  const remetenteNome = smtpRecord.getString('remetente_nome') || 'Gente e Gestão Tesla'
  const remetenteEmail = smtpRecord.getString('remetente_email') || 'noreply@teslarh.com.br'
  const tls = smtpRecord.getBool('tls')

  const titulo = 'Teste de Conexão SMTP — Gente e Gestão Tesla'
  const mensagem =
    'Parabéns! Se você recebeu esta mensagem, as credenciais e configurações de SMTP do seu tenant estão funcionando perfeitamente no Gente e Gestão Tesla. As notificações reais do sistema já podem ser entregues aos colaboradores por e-mail.'

  const corpoHtml =
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' +
    titulo +
    "</title></head><body style=\"margin:0; padding:0; background-color:#F5F5F5; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#212121;\">" +
    '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F5F5F5; padding: 36px 12px;">' +
    '<tr><td align="center">' +
    '<table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius: 12px; overflow:hidden; border: 1px solid #E0E0E0; max-width:600px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">' +
    '<tr><td style="background-color:#0D47A1; padding: 22px 32px; text-align: left;">' +
    '<span style="color:#ffffff; font-size: 19px; font-weight: 700; letter-spacing: -0.3px;">Gente e Gestão Tesla</span><div style="color:#BBDEFB; font-size: 11px; margin-top: 3px;">Diagnóstico de Conexão SMTP</div>' +
    '</td></tr>' +
    '<tr><td style="padding: 36px 32px;"><h2 style="margin:0 0 16px 0; font-size: 19px; font-weight: 700; color:#0D47A1;">' +
    titulo +
    '</h2><div style="font-size: 14.5px; line-height: 1.65; color:#424242; white-space: pre-line; background-color: #F0FDF4; border-left: 3px solid #16A34A; padding: 14px 16px; border-radius: 0 8px 8px 0;">' +
    mensagem +
    '</div></td></tr>' +
    '<tr><td style="background-color:#FAFAFA; border-top: 1px solid #EEEEEE; padding: 22px 32px; text-align: center;"><p style="margin:0 0 6px 0; font-size: 12px; font-weight: 700; color:#0D47A1;">Gente e Gestão Tesla</p><p style="margin:0; font-size: 11px; color:#9E9E9E;">Esta é uma mensagem de teste enviada pela administração do tenant.</p></td></tr>' +
    '</table></td></tr></table></body></html>'

  try {
    const mailerClient = $mailer.newSmtpClient({
      host: host,
      port: porta,
      username: usuario,
      password: senha,
      tls: tls,
    })

    const msg = new MailerMessage({
      from: {
        address: remetenteEmail,
        name: remetenteNome,
      },
      to: [
        {
          address: destinatarioTeste,
        },
      ],
      subject: titulo,
      html: corpoHtml,
      text: mensagem,
    })

    mailerClient.send(msg)

    // Log de sucesso
    const logRec = new Record(emailLogCol)
    logRec.set('tenant_id', tenantId)
    logRec.set('destinatario', destinatarioTeste)
    logRec.set('assunto', titulo)
    logRec.set('status', 'enviado')
    logRec.set('erro', '')
    try {
      logRec.set('tipo_evento', 'teste_smtp')
    } catch (_) {}
    c.app.save(logRec)

    return c.json(200, {
      success: true,
      message: 'E-mail de teste enviado com sucesso para ' + destinatarioTeste,
    })
  } catch (errEnvio) {
    const erroMsg = errEnvio && errEnvio.message ? errEnvio.message : String(errEnvio)
    console.log('Falha no teste SMTP para ' + destinatarioTeste + ':', erroMsg)

    try {
      const logRec = new Record(emailLogCol)
      logRec.set('tenant_id', tenantId)
      logRec.set('destinatario', destinatarioTeste)
      logRec.set('assunto', titulo)
      logRec.set('status', 'falha')
      logRec.set('erro', erroMsg)
      try {
        logRec.set('tipo_evento', 'teste_smtp')
      } catch (_) {}
      c.app.save(logRec)
    } catch (_) {}

    return c.json(500, {
      success: false,
      message: 'Falha no envio via SMTP: ' + erroMsg,
    })
  }
})
