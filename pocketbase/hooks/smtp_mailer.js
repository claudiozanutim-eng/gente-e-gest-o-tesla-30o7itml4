/**
 * Helper utilitário para envio de e-mails usando a configuração SMTP do tenant.
 * ATENÇÃO: As callbacks do PocketBase JSVM rodam em instâncias isoladas,
 * portanto as funções auxiliares devem ficar dentro de cada callback ou
 * declaradas com o mesmo escopo.
 */

// Hook disparado sempre que uma notificação in-app é criada
onRecordAfterCreateSuccess((e) => {
  const notif = e.record
  const tenantId = notif.getString('tenant_id')
  const destinatarioId = notif.getString('destinatario_id')
  const titulo = notif.getString('titulo')
  const mensagem = notif.getString('mensagem')
  const link = notif.getString('link')

  if (!tenantId || !destinatarioId) return

  const emailLogCol = e.app.findCollectionByNameOrId('email_log')

  try {
    // Buscar usuário destinatário
    const user = e.app.findRecordById('users', destinatarioId)
    if (!user) return

    const email = user.getString('email')
    if (!email) return

    // Buscar configuração SMTP do tenant
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
      const logRec = new Record(emailLogCol)
      logRec.set('tenant_id', tenantId)
      logRec.set('destinatario', email)
      logRec.set('assunto', titulo)
      logRec.set('status', 'pendente_envio')
      logRec.set(
        'erro',
        smtpRecord ? 'Configuração SMTP inativa' : 'Configuração SMTP não cadastrada',
      )
      try {
        e.app.save(logRec)
      } catch (eLog) {
        console.log('Falha ao salvar log pendente_envio:', eLog)
      }
      return
    }

    // Com SMTP ativo, tentar enviar
    const host = smtpRecord.getString('host')
    const porta = smtpRecord.getInt('porta') || 587
    const usuario = smtpRecord.getString('usuario') || ''
    const senha = smtpRecord.getString('senha') || ''
    const remetenteNome = smtpRecord.getString('remetente_nome') || 'Gente e Gestão Tesla'
    const remetenteEmail = smtpRecord.getString('remetente_email') || 'noreply@teslarh.com.br'
    const tls = smtpRecord.getBool('tls')

    const actionBtn = link
      ? '<div style="margin: 24px 0;"><a href="' +
        link +
        '" style="background-color: #0D47A1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">Acessar no Sistema</a></div>'
      : ''

    const corpoHtml =
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>' +
      titulo +
      "</title></head><body style=\"margin:0; padding:0; background-color:#F5F5F5; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#212121;\">" +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F5F5F5; padding: 30px 10px;">' +
      '<tr><td align="center">' +
      '<table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius: 10px; overflow:hidden; border: 1px solid #E0E0E0;">' +
      '<tr><td style="background-color:#0D47A1; padding: 20px 30px; text-align: left;"><span style="color:#ffffff; font-size: 18px; font-weight: 700;">Gente e Gestão Tesla</span></td></tr>' +
      '<tr><td style="padding: 35px 30px;"><h2 style="margin:0 0 16px 0; font-size: 20px; font-weight: 700; color:#0D47A1;">' +
      titulo +
      '</h2><div style="font-size: 15px; line-height: 1.6; color:#424242; white-space: pre-line;">' +
      mensagem +
      '</div>' +
      actionBtn +
      '</td></tr>' +
      '<tr><td style="background-color:#FAFAFA; border-top: 1px solid #EEEEEE; padding: 20px 30px; text-align: center;"><p style="margin:0 0 6px 0; font-size: 12px; font-weight: 600; color:#757575;">Gente e Gestão Tesla</p><p style="margin:0; font-size: 11px; color:#9E9E9E;">Esta é uma mensagem automática enviada pelo sistema.</p></td></tr>' +
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
          address: email,
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
    logRec.set('destinatario', email)
    logRec.set('assunto', titulo)
    logRec.set('status', 'enviado')
    logRec.set('erro', '')
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
  if (perfil !== 'admin') {
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
    'Parabéns! Se você recebeu esta mensagem, as credenciais e configurações de SMTP do seu tenant estão funcionando corretamente no Gente e Gestão Tesla.'

  const corpoHtml =
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>' +
    titulo +
    "</title></head><body style=\"margin:0; padding:0; background-color:#F5F5F5; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#212121;\">" +
    '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F5F5F5; padding: 30px 10px;">' +
    '<tr><td align="center">' +
    '<table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius: 10px; overflow:hidden; border: 1px solid #E0E0E0;">' +
    '<tr><td style="background-color:#0D47A1; padding: 20px 30px; text-align: left;"><span style="color:#ffffff; font-size: 18px; font-weight: 700;">Gente e Gestão Tesla</span></td></tr>' +
    '<tr><td style="padding: 35px 30px;"><h2 style="margin:0 0 16px 0; font-size: 20px; font-weight: 700; color:#0D47A1;">' +
    titulo +
    '</h2><div style="font-size: 15px; line-height: 1.6; color:#424242; white-space: pre-line;">' +
    mensagem +
    '</div></td></tr>' +
    '<tr><td style="background-color:#FAFAFA; border-top: 1px solid #EEEEEE; padding: 20px 30px; text-align: center;"><p style="margin:0 0 6px 0; font-size: 12px; font-weight: 600; color:#757575;">Gente e Gestão Tesla</p><p style="margin:0; font-size: 11px; color:#9E9E9E;">Esta é uma mensagem de teste enviada pela administração.</p></td></tr>' +
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
      c.app.save(logRec)
    } catch (_) {}

    return c.json(500, {
      success: false,
      message: 'Falha no envio via SMTP: ' + erroMsg,
    })
  }
})
