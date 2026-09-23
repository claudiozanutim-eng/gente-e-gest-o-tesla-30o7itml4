/**
 * Hook disparado após a criação de um novo registro na coleção 'atestado'.
 *
 * Funcionalidade:
 * - Identifica o colaborador que enviou o atestado (nome, cargo, departamento, ficha funcional).
 * - Notifica imediatamente por e-mail os usuários com perfil 'rh', 'admin_rh' e 'admin' do MESMO tenant.
 * - Utiliza a configuração SMTP corporativa ativa do tenant (mesmo padrão institucional Tesla #0D47A1).
 * - Tolerante a falhas: se não houver SMTP ativo ou se ocorrer erro no envio, registra em email_log
 *   como 'pendente_envio' ou 'falha' sem quebrar a criação do atestado.
 * - Anti-duplicidade: registra o ID do atestado em evento_ref e valida se já foi enviado para evitar reprocessamento.
 *
 * NOTA DE ARQUITETURA JSVM (PocketBase v0.36):
 * As callbacks rodam em VM isolada — todas as funções auxiliares e variáveis
 * devem ficar estritamente DENTRO da callback (sem variáveis top-level compartilhadas).
 */

onRecordAfterCreateSuccess((e) => {
  const atestado = e.record
  if (!atestado) return

  const atestadoId = atestado.getString('id')
  const tenantId = atestado.getString('tenant_id')
  const colaboradorId = atestado.getString('colaborador_id')
  const qtdDias = atestado.getInt('qtd_dias') || 1
  const dataInicioRaw = atestado.getString('data_inicio') || ''
  const dataEnvioRaw = atestado.getString('data_envio') || atestado.getString('created') || ''

  if (!tenantId || !atestadoId) return

  const emailLogCol = e.app.findCollectionByNameOrId('email_log')

  try {
    // 1. Buscar dados do colaborador na ficha funcional
    let nomeColaborador = 'Colaborador'
    let cargoColaborador = 'Cargo não informado'
    let deptoColaborador = 'Departamento não informado'

    if (colaboradorId) {
      try {
        const colabRec = e.app.findRecordById('colaborador', colaboradorId)
        if (colabRec) {
          nomeColaborador =
            colabRec.getString('nome_completo') || colabRec.getString('nome') || nomeColaborador
          cargoColaborador = colabRec.getString('cargo') || cargoColaborador
          deptoColaborador = colabRec.getString('departamento') || deptoColaborador
        }
      } catch (errColab) {
        console.log('[on_atestado_create] Aviso ao buscar ficha do colaborador:', errColab)
      }
    }

    // 2. Formatar datas em pt-BR
    let dataEnvioPtBr = ''
    if (dataEnvioRaw && dataEnvioRaw.length >= 10) {
      const parts = dataEnvioRaw.slice(0, 10).split('-')
      if (parts.length === 3) {
        dataEnvioPtBr = parts[2] + '/' + parts[1] + '/' + parts[0]
      }
    }
    if (!dataEnvioPtBr) {
      const dNow = new Date()
      const d = String(dNow.getDate()).padStart(2, '0')
      const m = String(dNow.getMonth() + 1).padStart(2, '0')
      const y = dNow.getFullYear()
      dataEnvioPtBr = d + '/' + m + '/' + y
    }

    let periodoInicioPtBr = ''
    if (dataInicioRaw && dataInicioRaw.length >= 10) {
      const p = dataInicioRaw.slice(0, 10).split('-')
      if (p.length === 3) {
        periodoInicioPtBr = p[2] + '/' + p[1] + '/' + p[0]
      }
    } else {
      periodoInicioPtBr = dataEnvioPtBr
    }

    const diasTexto = qtdDias === 1 ? '1 dia' : qtdDias + ' dias'

    // 3. Buscar destinatários com perfil RH / Admin do mesmo tenant
    const destinatariosRH = []
    try {
      const usersRH = e.app.findRecordsByFilter(
        'users',
        "tenant_id = '" +
          tenantId +
          "' && ativo = true && (perfil = 'rh' || perfil = 'admin_rh' || perfil = 'admin')",
        '-created',
        50,
        0,
      )

      for (let u = 0; u < usersRH.length; u++) {
        const usr = usersRH[u]
        let emailRH = usr.getString('email') || ''
        let nomeRH = usr.getString('name') || ''

        // Fallback: se o user não tiver email direto, busca na ficha de colaborador
        if (!emailRH) {
          try {
            const colabList = e.app.findRecordsByFilter(
              'colaborador',
              "user_id = '" + usr.getString('id') + "'",
              '-created',
              1,
              0,
            )
            if (colabList && colabList.length > 0) {
              emailRH = colabList[0].getString('email') || ''
              if (!nomeRH) {
                nomeRH =
                  colabList[0].getString('nome_completo') || colabList[0].getString('nome') || ''
              }
            }
          } catch (_) {}
        }

        if (emailRH && emailRH.indexOf('@') !== -1) {
          let jaExiste = false
          for (let d = 0; d < destinatariosRH.length; d++) {
            if (destinatariosRH[d].email.toLowerCase() === emailRH.toLowerCase()) {
              jaExiste = true
              break
            }
          }
          if (!jaExiste) {
            destinatariosRH.push({
              id: usr.getString('id'),
              email: emailRH.trim(),
              nome: nomeRH || 'Equipe de RH',
            })
          }
        }
      }
    } catch (errUsers) {
      console.log('[on_atestado_create] Erro ao buscar usuários RH:', errUsers)
    }

    if (destinatariosRH.length === 0) {
      console.log(
        '[on_atestado_create] Nenhum usuário RH/Admin com e-mail válido encontrado para tenant ' +
          tenantId,
      )
      return
    }

    // 4. Montar assunto e conteúdo do e-mail institucional
    const assuntoEmail = 'Novo Atestado Enviado — ' + nomeColaborador
    const appUrl = $os.getenv('APP_URL') || 'https://teslarh.com.br'
    const linkAtestados = appUrl + '/atestados'

    // 5. Buscar configuração SMTP do tenant
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
      console.log('[on_atestado_create] Erro ao buscar smtp_config:', errFind)
    }

    const smtpAtivo = smtpRecord && smtpRecord.getBool('ativo')

    // Se SMTP não estiver configurado ou estiver inativo: registrar pendente_envio para cada RH
    if (!smtpAtivo) {
      const motivoInativo = smtpRecord
        ? 'Configuração SMTP inativa'
        : 'Configuração SMTP não cadastrada'

      for (let d = 0; d < destinatariosRH.length; d++) {
        const dest = destinatariosRH[d]

        // Anti-duplicidade no log
        try {
          const logsExistentes = e.app.findRecordsByFilter(
            'email_log',
            "tenant_id = '" +
              tenantId +
              "' && destinatario = '" +
              dest.email +
              "' && evento_ref = '" +
              atestadoId +
              "'",
            '-created',
            1,
            0,
          )
          if (logsExistentes && logsExistentes.length > 0) {
            continue
          }
        } catch (_) {}

        const logRec = new Record(emailLogCol)
        logRec.set('tenant_id', tenantId)
        logRec.set('destinatario', dest.email)
        logRec.set('assunto', assuntoEmail)
        logRec.set('status', 'pendente_envio')
        logRec.set(
          'erro',
          motivoInativo + ' (Novo atestado de ' + nomeColaborador + ' - ' + diasTexto + ')',
        )
        try {
          logRec.set('tipo_evento', 'novo_atestado')
          logRec.set('evento_ref', atestadoId)
        } catch (_) {}

        try {
          e.app.save(logRec)
        } catch (eLog) {
          console.log('[on_atestado_create] Falha ao salvar email_log pendente_envio:', eLog)
        }
      }
      return
    }

    // 6. Configuração SMTP Ativa — Preparar cliente de envio
    const host = smtpRecord.getString('host')
    const porta = smtpRecord.getInt('porta') || 587
    const usuario = smtpRecord.getString('usuario') || ''
    const senha = smtpRecord.getString('senha') || ''
    const remetenteNome = smtpRecord.getString('remetente_nome') || 'Gente e Gestão Tesla'
    const remetenteEmail = smtpRecord.getString('remetente_email') || 'noreply@teslarh.com.br'
    const tls = smtpRecord.getBool('tls')

    const mailerClient = $mailer.newSmtpClient({
      host: host,
      port: porta,
      username: usuario,
      password: senha,
      tls: tls,
    })

    // Texto plano alternativo
    const textoPlano =
      'Olá, Equipe de RH!\n\n' +
      'Um novo atestado médico foi enviado pelo colaborador e está aguardando homologação.\n\n' +
      'Detalhes do Atestado:\n' +
      '- Colaborador: ' +
      nomeColaborador +
      '\n' +
      '- Cargo: ' +
      cargoColaborador +
      '\n' +
      '- Departamento: ' +
      deptoColaborador +
      '\n' +
      '- Duração do afastamento: ' +
      diasTexto +
      '\n' +
      '- Data de início: ' +
      periodoInicioPtBr +
      '\n' +
      '- Data de envio: ' +
      dataEnvioPtBr +
      '\n\n' +
      'Acesse a plataforma Gente e Gestão Tesla para revisar o anexo e validar o documento:\n' +
      linkAtestados +
      '\n\n' +
      'Atenciosamente,\nGente e Gestão Tesla'

    // 7. Enviar individualmente para cada destinatário de RH do tenant
    for (let d = 0; d < destinatariosRH.length; d++) {
      const dest = destinatariosRH[d]

      // 7.1 Anti-duplicidade: verificar se já existe log para este atestadoId + destinatário
      try {
        const logsExistentes = e.app.findRecordsByFilter(
          'email_log',
          "tenant_id = '" +
            tenantId +
            "' && destinatario = '" +
            dest.email +
            "' && evento_ref = '" +
            atestadoId +
            "'",
          '-created',
          1,
          0,
        )
        if (logsExistentes && logsExistentes.length > 0) {
          // Já processado para este mesmo atestado e destinatário
          continue
        }
      } catch (errAntiSpam) {
        console.log('[on_atestado_create] Aviso anti-spam:', errAntiSpam)
      }

      // 7.2 Montar corpo HTML institucional com Azul Tesla #0D47A1 e tabela zebrada
      const corpoHtml =
        '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' +
        assuntoEmail +
        "</title></head><body style=\"margin:0; padding:0; background-color:#F5F5F5; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#212121; -webkit-font-smoothing: antialiased;\">" +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F5F5F5; padding: 36px 12px;">' +
        '<tr><td align="center">' +
        '<table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius: 12px; overflow:hidden; border: 1px solid #E0E0E0; max-width:600px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">' +
        // Cabeçalho com padrão Tesla (#0D47A1)
        '<tr><td style="background-color:#0D47A1; padding: 22px 32px; text-align: left;">' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
        '<td><span style="color:#ffffff; font-size: 19px; font-weight: 700; letter-spacing: -0.3px;">Gente e Gestão Tesla</span><div style="color:#BBDEFB; font-size: 11px; margin-top: 3px; font-weight: 500;">Plataforma de Gestão de Pessoas & RH</div></td>' +
        '<td align="right"><span style="background-color: rgba(255,255,255,0.18); color: #ffffff; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">Atestados</span></td>' +
        '</tr></table>' +
        '</td></tr>' +
        // Conteúdo
        '<tr><td style="padding: 36px 32px;">' +
        '<p style="margin: 0 0 16px 0; font-size: 15px; color: #374151;">Olá, <strong>' +
        (dest.nome || 'Equipe de RH') +
        '</strong>!</p>' +
        '<h2 style="margin: 0 0 14px 0; font-size: 19px; font-weight: 700; color:#0D47A1; line-height: 1.3;">' +
        'Novo Atestado Médico Recebido' +
        '</h2>' +
        '<p style="font-size: 14px; color: #616161; margin: 0 0 20px 0; line-height: 1.5;">' +
        'O colaborador <strong>' +
        nomeColaborador +
        '</strong> enviou um novo comprovante de atestado/licença médica pelo portal. O documento está aguardando análise e homologação do RH.' +
        '</p>' +
        // Tabela zebrada de informações do atestado
        '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden; border-collapse: separate;">' +
        '<tr style="background-color: #FAFAFA;"><td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #757575; text-transform: uppercase; width: 35%;">Colaborador</td><td style="padding: 10px 14px; font-size: 13.5px; font-weight: 600; color: #212121;">' +
        nomeColaborador +
        '</td></tr>' +
        '<tr style="background-color: #FFFFFF;"><td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #757575; text-transform: uppercase; border-top: 1px solid #EEEEEE;">Departamento</td><td style="padding: 10px 14px; font-size: 13.5px; color: #424242; border-top: 1px solid #EEEEEE;">' +
        deptoColaborador +
        '</td></tr>' +
        '<tr style="background-color: #FAFAFA;"><td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #757575; text-transform: uppercase; border-top: 1px solid #EEEEEE;">Cargo / Função</td><td style="padding: 10px 14px; font-size: 13.5px; color: #424242; border-top: 1px solid #EEEEEE;">' +
        cargoColaborador +
        '</td></tr>' +
        '<tr style="background-color: #FFFFFF;"><td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #757575; text-transform: uppercase; border-top: 1px solid #EEEEEE;">Duração</td><td style="padding: 10px 14px; font-size: 13.5px; font-weight: 700; color: #0D47A1; border-top: 1px solid #EEEEEE;">' +
        diasTexto +
        '</td></tr>' +
        '<tr style="background-color: #FAFAFA;"><td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #757575; text-transform: uppercase; border-top: 1px solid #EEEEEE;">Início do Afastamento</td><td style="padding: 10px 14px; font-size: 13.5px; color: #424242; border-top: 1px solid #EEEEEE;">' +
        periodoInicioPtBr +
        '</td></tr>' +
        '<tr style="background-color: #FFFFFF;"><td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #757575; text-transform: uppercase; border-top: 1px solid #EEEEEE;">Data de Envio</td><td style="padding: 10px 14px; font-size: 13.5px; color: #424242; border-top: 1px solid #EEEEEE;">' +
        dataEnvioPtBr +
        '</td></tr>' +
        '<tr style="background-color: #FAFAFA;"><td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #757575; text-transform: uppercase; border-top: 1px solid #EEEEEE;">Status Inicial</td><td style="padding: 10px 14px; font-size: 12px; border-top: 1px solid #EEEEEE;"><span style="background-color: #FEF3C7; color: #92400E; padding: 3px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">Recebido</span></td></tr>' +
        '</table>' +
        // Botão de ação com link direto para /atestados
        '<div style="margin: 28px 0 10px 0; text-align: center;">' +
        '<a href="' +
        linkAtestados +
        '" style="background-color: #0D47A1; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px; box-shadow: 0 2px 4px rgba(13,71,161,0.25);">Acessar Painel de Atestados</a>' +
        '</div>' +
        '</td></tr>' +
        // Rodapé Institucional
        '<tr><td style="background-color:#FAFAFA; border-top: 1px solid #EEEEEE; padding: 22px 32px; text-align: center;">' +
        '<p style="margin:0 0 6px 0; font-size: 12px; font-weight: 700; color:#0D47A1;">Gente e Gestão Tesla</p>' +
        '<p style="margin:0 0 4px 0; font-size: 11px; color:#757575;">Notificação automática institucional enviada à equipe de Recursos Humanos.</p>' +
        '<p style="margin:0; font-size: 10px; color:#9E9E9E;">Por favor, não responda diretamente a este e-mail corporativo.</p>' +
        '</td></tr>' +
        '</table></td></tr></table></body></html>'

      try {
        const msg = new MailerMessage({
          from: {
            address: remetenteEmail,
            name: remetenteNome,
          },
          to: [
            {
              address: dest.email,
              name: dest.nome || dest.email,
            },
          ],
          subject: assuntoEmail,
          html: corpoHtml,
          text: textoPlano,
        })

        mailerClient.send(msg)

        // Registrar sucesso no email_log
        const logRec = new Record(emailLogCol)
        logRec.set('tenant_id', tenantId)
        logRec.set('destinatario', dest.email)
        logRec.set('assunto', assuntoEmail)
        logRec.set('status', 'enviado')
        logRec.set('erro', '')
        try {
          logRec.set('tipo_evento', 'novo_atestado')
          logRec.set('evento_ref', atestadoId)
        } catch (_) {}
        e.app.save(logRec)

        console.log(
          '[on_atestado_create] E-mail enviado com sucesso para RH: ' +
            dest.email +
            ' (atestado: ' +
            atestadoId +
            ')',
        )
      } catch (errEnvio) {
        const erroMsg = errEnvio && errEnvio.message ? errEnvio.message : String(errEnvio)
        console.log('[on_atestado_create] Erro no envio SMTP para ' + dest.email + ':', erroMsg)

        // Registrar falha no email_log
        try {
          const logRec = new Record(emailLogCol)
          logRec.set('tenant_id', tenantId)
          logRec.set('destinatario', dest.email)
          logRec.set('assunto', assuntoEmail)
          logRec.set('status', 'falha')
          logRec.set('erro', erroMsg)
          try {
            logRec.set('tipo_evento', 'novo_atestado')
            logRec.set('evento_ref', atestadoId)
          } catch (_) {}
          e.app.save(logRec)
        } catch (_) {}
      }
    }
  } catch (errGeral) {
    console.log('[on_atestado_create] Erro geral no processamento de e-mail do atestado:', errGeral)
  }
}, 'atestado')
