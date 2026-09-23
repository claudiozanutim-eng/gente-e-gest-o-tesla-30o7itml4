/**
 * Job Agendado (Cron Diário) do Digest de RH.
 * Horário: 08:00 (America/Sao_Paulo => 11:00 UTC) -> cron '0 11 * * *'.
 *
 * Cada tenant recebe um único e-mail consolidado para seus gestores de RH (perfil 'rh', 'admin_rh', 'admin').
 * O digest traz:
 * 1. Solicitações de alteração cadastral pendentes
 * 2. Confirmações de leitura de comunicados obrigatórios em aberto (% adesão)
 * 3. Pendências documentais corporativas (colaboradores ativos sem ciência na versão vigente)
 * 4. Solicitações de férias pendentes de aprovação
 * 5. Atestados médicos pendentes de análise/validação
 * 6. Solicitações de compensação de banco de horas pendentes
 * 7. Alertas orçamentários da folha (competência atual)
 *
 * Regras:
 * - Anti-duplicidade: idempotência por tenant + data (YYYY-MM-DD), salvo em email_log com evento_ref = "digest_YYYY-MM-DD".
 * - Se não houver pendências, não envia e-mail vazio.
 * - Se o tenant não tiver SMTP ativo, registra em email_log como 'pendente_envio' para auditoria completa.
 *
 * NOTA DE ARQUITETURA JSVM: Todo o código está estritamente inline dentro da callback
 * para evitar qualquer ReferenceError entre VMs.
 */

cronAdd('digest_diario_rh', '0 11 * * *', () => {
  console.log('[Cron] Iniciando execução do Digest Diário para o RH...')

  // Data de referência no fuso de São Paulo (UTC-3)
  const agora = new Date()
  const utcMs = agora.getTime() + agora.getTimezoneOffset() * 60000
  const spOffsetMs = -3 * 3600000
  const spDate = new Date(utcMs + spOffsetMs)

  const ano = spDate.getFullYear()
  const mes = String(spDate.getMonth() + 1).padStart(2, '0')
  const dia = String(spDate.getDate()).padStart(2, '0')
  const dataHojeIso = ano + '-' + mes + '-' + dia
  const dataHojePtBr = dia + '/' + mes + '/' + ano
  const eventoRefId = 'digest_' + dataHojeIso

  const emailLogCol = $app.findCollectionByNameOrId('email_log')

  // Buscar todos os tenants ativos
  let tenants = []
  try {
    tenants = $app.findRecordsByFilter('tenant', "status = 'ativo'", '-created', 100, 0)
  } catch (errTenants) {
    console.log('[Cron Digest] Erro ao buscar tenants ativos:', errTenants)
    return
  }

  for (let tIdx = 0; tIdx < tenants.length; tIdx++) {
    const tenant = tenants[tIdx]
    const tenantId = tenant.getString('id')
    const tenantNome = tenant.getString('razao_social') || 'Tesla Mecatrônica'

    // 1. Checagem de idempotência diária
    try {
      const logsHoje = $app.findRecordsByFilter(
        'email_log',
        "tenant_id = '" +
          tenantId +
          "' && tipo_evento = 'digest_diario' && evento_ref = '" +
          eventoRefId +
          "' && status = 'enviado'",
        '-created',
        1,
        0,
      )
      if (logsHoje && logsHoje.length > 0) {
        console.log('[Cron Digest] Digest já enviado hoje para tenant ' + tenantId)
        continue
      }
    } catch (errCheck) {
      console.log('[Cron Digest] Aviso checagem idempotência:', errCheck)
    }

    // 2. Destinatários de RH do tenant
    const destinatarios = []
    try {
      const usersRh = $app.findRecordsByFilter(
        'users',
        "tenant_id = '" +
          tenantId +
          "' && ativo = true && (perfil = 'rh' || perfil = 'admin_rh' || perfil = 'admin')",
        '-created',
        50,
        0,
      )

      for (let u = 0; u < usersRh.length; u++) {
        const usr = usersRh[u]
        let em = usr.getString('email') || ''
        let nm = usr.getString('name') || ''

        if (!em) {
          try {
            const colabList = $app.findRecordsByFilter(
              'colaborador',
              "user_id = '" + usr.getString('id') + "'",
              '-created',
              1,
              0,
            )
            if (colabList && colabList.length > 0) {
              em = colabList[0].getString('email') || ''
              if (!nm) {
                nm = colabList[0].getString('nome_completo') || colabList[0].getString('nome') || ''
              }
            }
          } catch (_) {}
        }

        if (em && em.indexOf('@') !== -1) {
          let jaExiste = false
          for (let d = 0; d < destinatarios.length; d++) {
            if (destinatarios[d].email === em) {
              jaExiste = true
              break
            }
          }
          if (!jaExiste) {
            destinatarios.push({ email: em, nome: nm || 'Equipe de RH' })
          }
        }
      }
    } catch (errUsers) {
      console.log('[Cron Digest] Erro ao buscar usuarios RH:', errUsers)
    }

    if (destinatarios.length === 0) {
      console.log('[Cron Digest] Sem destinatários RH para tenant ' + tenantId)
      continue
    }

    // 3. Coleta de pendências reais

    // 3.1. Alterações cadastrais pendentes
    let alteracoesPendentes = []
    try {
      const solics = $app.findRecordsByFilter(
        'solicitacao_alteracao',
        "tenant_id = '" + tenantId + "' && status = 'pendente'",
        '-created',
        25,
        0,
      )
      for (let s = 0; s < solics.length; s++) {
        const item = solics[s]
        let colabNome = 'Colaborador'
        const colabId = item.getString('colaborador_id')
        if (colabId) {
          try {
            const cRec = $app.findRecordById('colaborador', colabId)
            if (cRec) {
              colabNome = cRec.getString('nome_completo') || cRec.getString('nome') || colabNome
            }
          } catch (_) {}
        }
        let dtSolic = item.getString('data_solicitacao') || item.getString('created') || ''
        if (dtSolic && dtSolic.length >= 10) {
          const parts = dtSolic.slice(0, 10).split('-')
          if (parts.length === 3) {
            dtSolic = parts[2] + '/' + parts[1] + '/' + parts[0]
          }
        }
        alteracoesPendentes.push({
          colaborador: colabNome,
          campo: item.getString('campo') || 'Dados cadastrais',
          data: dtSolic,
        })
      }
    } catch (errAlt) {
      console.log('[Cron Digest] Erro alteracoes:', errAlt)
    }

    // 3.2. Férias pendentes
    let feriasPendentes = []
    try {
      const ferias = $app.findRecordsByFilter(
        'solicitacao_ferias',
        "tenant_id = '" + tenantId + "' && status = 'pendente'",
        '-data_solicitacao',
        20,
        0,
      )
      for (let f = 0; f < ferias.length; f++) {
        const fr = ferias[f]
        let colabNome = 'Colaborador'
        const colabId = fr.getString('colaborador_id')
        if (colabId) {
          try {
            const cRec = $app.findRecordById('colaborador', colabId)
            if (cRec) {
              colabNome = cRec.getString('nome_completo') || cRec.getString('nome') || colabNome
            }
          } catch (_) {}
        }

        let dtIni = fr.getString('data_inicio') || ''
        let dtFim = fr.getString('data_fim') || ''
        if (dtIni.length >= 10) {
          const p = dtIni.slice(0, 10).split('-')
          dtIni = p[2] + '/' + p[1] + '/' + p[0]
        }
        if (dtFim.length >= 10) {
          const p = dtFim.slice(0, 10).split('-')
          dtFim = p[2] + '/' + p[1] + '/' + p[0]
        }

        feriasPendentes.push({
          colaborador: colabNome,
          dias: fr.getInt('dias') || 0,
          periodo: dtIni + ' até ' + dtFim,
          abono: fr.getBool('abono_pecuniario'),
        })
      }
    } catch (errFerias) {
      console.log('[Cron Digest] Erro ferias:', errFerias)
    }

    // 3.3. Atestados médicos pendentes
    let atestadosPendentes = []
    try {
      const atests = $app.findRecordsByFilter(
        'atestado',
        "tenant_id = '" + tenantId + "' && (status = 'recebido' || status = 'em_analise')",
        '-data_envio',
        20,
        0,
      )
      for (let a = 0; a < atests.length; a++) {
        const at = atests[a]
        let colabNome = 'Colaborador'
        const colabId = at.getString('colaborador_id')
        if (colabId) {
          try {
            const cRec = $app.findRecordById('colaborador', colabId)
            if (cRec) {
              colabNome = cRec.getString('nome_completo') || cRec.getString('nome') || colabNome
            }
          } catch (_) {}
        }
        let dtEnv = at.getString('data_envio') || at.getString('created') || ''
        if (dtEnv.length >= 10) {
          const p = dtEnv.slice(0, 10).split('-')
          dtEnv = p[2] + '/' + p[1] + '/' + p[0]
        }
        atestadosPendentes.push({
          colaborador: colabNome,
          dias: at.getInt('qtd_dias') || 1,
          dataEnvio: dtEnv,
          status: at.getString('status') === 'em_analise' ? 'Em análise' : 'Recebido',
        })
      }
    } catch (errAtest) {
      console.log('[Cron Digest] Erro atestados:', errAtest)
    }

    // 3.4. Compensação de Banco de Horas pendente
    let compensacoesPendentes = []
    try {
      const comps = $app.findRecordsByFilter(
        'compensacao_banco_horas',
        "tenant_id = '" + tenantId + "' && status = 'pendente'",
        '-created',
        15,
        0,
      )
      for (let cp = 0; cp < comps.length; cp++) {
        const cm = comps[cp]
        let colabNome = 'Colaborador'
        const colabId = cm.getString('colaborador_id')
        if (colabId) {
          try {
            const cRec = $app.findRecordById('colaborador', colabId)
            if (cRec) {
              colabNome = cRec.getString('nome_completo') || cRec.getString('nome') || colabNome
            }
          } catch (_) {}
        }
        let dtComp = cm.getString('data_compensacao') || ''
        if (dtComp.length >= 10) {
          const p = dtComp.slice(0, 10).split('-')
          dtComp = p[2] + '/' + p[1] + '/' + p[0]
        }
        compensacoesPendentes.push({
          colaborador: colabNome,
          horas: cm.getFloat('horas') || 0,
          data: dtComp,
          motivo: cm.getString('motivo') || 'Compensação',
        })
      }
    } catch (errComp) {
      console.log('[Cron Digest] Erro compensacoes:', errComp)
    }

    // 3.5. Comunicados obrigatórios em aberto
    let comunicadosPendentes = []
    try {
      const coms = $app.findRecordsByFilter(
        'comunicado',
        "tenant_id = '" + tenantId + "' && status = 'ativo' && exige_confirmacao = true",
        '-data_publicacao',
        10,
        0,
      )
      if (coms.length > 0) {
        let totalAtivos = 0
        try {
          const cAtivos = $app.findRecordsByFilter(
            'colaborador',
            "tenant_id = '" + tenantId + "' && status = 'ativo'",
            '-created',
            500,
            0,
          )
          totalAtivos = cAtivos.length
        } catch (_) {}

        for (let c = 0; c < coms.length; c++) {
          const com = coms[c]
          const comId = com.getString('id')
          const leituras = $app.findRecordsByFilter(
            'comunicado_leitura',
            "tenant_id = '" + tenantId + "' && comunicado_id = '" + comId + "'",
            '-created',
            500,
            0,
          )
          const totalLidos = leituras.length
          const taxa = totalAtivos > 0 ? Math.round((totalLidos / totalAtivos) * 100) : 100
          if (taxa < 100) {
            comunicadosPendentes.push({
              titulo: com.getString('titulo') || 'Comunicado Geral',
              taxaConfirmacao: taxa,
              pendentesQtd: Math.max(0, totalAtivos - totalLidos),
              totalEsperado: totalAtivos,
            })
          }
        }
      }
    } catch (errCom) {
      console.log('[Cron Digest] Erro comunicados:', errCom)
    }

    // 3.6. Pendências documentais corporativas
    let pendenciasDocumentais = []
    try {
      const docsObrig = $app.findRecordsByFilter(
        'documento',
        "tenant_id = '" + tenantId + "' && obrigatorio = true && colaborador_id = ''",
        '-created',
        20,
        0,
      )
      if (docsObrig.length > 0) {
        const colabsAtivos = $app.findRecordsByFilter(
          'colaborador',
          "tenant_id = '" + tenantId + "' && status = 'ativo'",
          'nome',
          500,
          0,
        )

        for (let d = 0; d < docsObrig.length; d++) {
          const doc = docsObrig[d]
          const docId = doc.getString('id')
          const versao = (doc.getString('versao') || '1.0').trim()

          const ciencias = $app.findRecordsByFilter(
            'ciencia_documento',
            "tenant_id = '" + tenantId + "' && documento_id = '" + docId + "'",
            '-created',
            1000,
            0,
          )

          const cientesIds = {}
          for (let ci = 0; ci < ciencias.length; ci++) {
            const vCiente = (ciencias[ci].getString('versao_ciente') || '').trim()
            if (vCiente === versao) {
              cientesIds[ciencias[ci].getString('colaborador_id')] = true
            }
          }

          let pendentesDoc = 0
          for (let ca = 0; ca < colabsAtivos.length; ca++) {
            if (!cientesIds[colabsAtivos[ca].getString('id')]) {
              pendentesDoc++
            }
          }

          if (pendentesDoc > 0) {
            pendenciasDocumentais.push({
              documento: doc.getString('nome') || 'Documento Institucional',
              versao: versao,
              totalPendentes: pendentesDoc,
              totalAtivos: colabsAtivos.length,
            })
          }
        }
      }
    } catch (errDocs) {
      console.log('[Cron Digest] Erro docs:', errDocs)
    }

    // 3.7. Orçamento Ativo
    let avisoOrcamento = null
    try {
      const compAtual = ano + '-' + mes
      const orcs = $app.findRecordsByFilter(
        'orcamento_folha',
        "tenant_id = '" + tenantId + "' && competencia = '" + compAtual + "'",
        '-created',
        1,
        0,
      )
      if (orcs && orcs.length > 0) {
        const o = orcs[0]
        avisoOrcamento = {
          competencia: compAtual,
          folhaOrcada: o.getFloat('valor_orcado_folha') || 0,
          bancoHorasOrcado: o.getFloat('valor_orcado_banco_horas') || 0,
          observacao: o.getString('observacao') || '',
        }
      }
    } catch (errOrc) {
      console.log('[Cron Digest] Erro orcamento:', errOrc)
    }

    const totalGeralPendencias =
      alteracoesPendentes.length +
      feriasPendentes.length +
      atestadosPendentes.length +
      compensacoesPendentes.length +
      comunicadosPendentes.length +
      pendenciasDocumentais.length

    // Se nenhuma pendência, omitir envio por regra de negócio
    if (totalGeralPendencias === 0) {
      console.log(
        '[Cron Digest] Tenant ' + tenantId + ' não possui pendências hoje. Envio ignorado.',
      )
      continue
    }

    // 4. Montar HTML do Digest
    const assuntoEmail = 'Resumo Diário RH — ' + dataHojePtBr

    let secoesHtml = ''

    // Seção Alterações
    if (alteracoesPendentes.length > 0) {
      let linhasAlt = ''
      for (let i = 0; i < alteracoesPendentes.length; i++) {
        const item = alteracoesPendentes[i]
        linhasAlt +=
          '<tr style="border-bottom: 1px solid #EEEEEE;">' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
          item.colaborador +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #0D47A1; font-weight: 500;">' +
          item.campo +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 12px; color: #616161;">' +
          item.data +
          '</td>' +
          '</tr>'
      }

      secoesHtml +=
        '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
        '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
        '<td><strong style="color: #0D47A1; font-size: 14px;">Solicitações de Alteração Cadastral</strong></td>' +
        '<td align="right"><span style="background-color: #FFF3E0; color: #E65100; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #FFE0B2;">' +
        alteracoesPendentes.length +
        ' pendente(s)</span></td>' +
        '</tr></table>' +
        '</div>' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
        '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;">' +
        '<th style="padding: 8px 12px; text-align: left;">Colaborador</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Campo</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Data</th>' +
        '</tr></thead>' +
        '<tbody>' +
        linhasAlt +
        '</tbody>' +
        '</table>' +
        '</div>'
    }

    // Seção Férias
    if (feriasPendentes.length > 0) {
      let linhasFerias = ''
      for (let i = 0; i < feriasPendentes.length; i++) {
        const item = feriasPendentes[i]
        linhasFerias +=
          '<tr style="border-bottom: 1px solid #EEEEEE;">' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
          item.colaborador +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #424242;">' +
          item.periodo +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 12px; color: #0D47A1; font-weight: 700;">' +
          item.dias +
          ' dias' +
          (item.abono ? ' (abono)' : '') +
          '</td>' +
          '</tr>'
      }

      secoesHtml +=
        '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
        '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
        '<td><strong style="color: #0D47A1; font-size: 14px;">Solicitações de Férias Aguardando Aprovação</strong></td>' +
        '<td align="right"><span style="background-color: #E8EEF7; color: #0D47A1; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #BBDEFB;">' +
        feriasPendentes.length +
        ' aguardando</span></td>' +
        '</tr></table>' +
        '</div>' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
        '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;">' +
        '<th style="padding: 8px 12px; text-align: left;">Colaborador</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Período</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Duração</th>' +
        '</tr></thead>' +
        '<tbody>' +
        linhasFerias +
        '</tbody>' +
        '</table>' +
        '</div>'
    }

    // Seção Atestados
    if (atestadosPendentes.length > 0) {
      let linhasAtest = ''
      for (let i = 0; i < atestadosPendentes.length; i++) {
        const item = atestadosPendentes[i]
        linhasAtest +=
          '<tr style="border-bottom: 1px solid #EEEEEE;">' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
          item.colaborador +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #424242;">' +
          item.dias +
          (item.dias === 1 ? ' dia' : ' dias') +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 12px; color: #757575;">' +
          item.dataEnvio +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 12px;"><span style="background-color: #FEF3C7; color: #92400E; padding: 2px 6px; border-radius: 4px; font-weight: 600;">' +
          item.status +
          '</span></td>' +
          '</tr>'
      }

      secoesHtml +=
        '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
        '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
        '<td><strong style="color: #0D47A1; font-size: 14px;">Atestados Médicos Pendentes de Validação</strong></td>' +
        '<td align="right"><span style="background-color: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #FDE68A;">' +
        atestadosPendentes.length +
        ' recebido(s)</span></td>' +
        '</tr></table>' +
        '</div>' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
        '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;">' +
        '<th style="padding: 8px 12px; text-align: left;">Colaborador</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Qtd. Dias</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Enviado em</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Status</th>' +
        '</tr></thead>' +
        '<tbody>' +
        linhasAtest +
        '</tbody>' +
        '</table>' +
        '</div>'
    }

    // Seção Compensações
    if (compensacoesPendentes.length > 0) {
      let linhasComp = ''
      for (let i = 0; i < compensacoesPendentes.length; i++) {
        const item = compensacoesPendentes[i]
        linhasComp +=
          '<tr style="border-bottom: 1px solid #EEEEEE;">' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
          item.colaborador +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #0D47A1; font-weight: 700;">' +
          item.horas +
          'h</td>' +
          '<td style="padding: 10px 12px; font-size: 12px; color: #424242;">' +
          item.data +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 12px; color: #616161;">' +
          item.motivo +
          '</td>' +
          '</tr>'
      }

      secoesHtml +=
        '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
        '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
        '<td><strong style="color: #0D47A1; font-size: 14px;">Compensações de Banco de Horas Pendentes</strong></td>' +
        '<td align="right"><span style="background-color: #E8EEF7; color: #0D47A1; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #BBDEFB;">' +
        compensacoesPendentes.length +
        ' solicitação(ões)</span></td>' +
        '</tr></table>' +
        '</div>' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
        '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;">' +
        '<th style="padding: 8px 12px; text-align: left;">Colaborador</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Horas</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Data</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Motivo</th>' +
        '</tr></thead>' +
        '<tbody>' +
        linhasComp +
        '</tbody>' +
        '</table>' +
        '</div>'
    }

    // Seção Comunicados
    if (comunicadosPendentes.length > 0) {
      let linhasComun = ''
      for (let i = 0; i < comunicadosPendentes.length; i++) {
        const item = comunicadosPendentes[i]
        linhasComun +=
          '<tr style="border-bottom: 1px solid #EEEEEE;">' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
          item.titulo +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #E65100; font-weight: 700;">' +
          item.taxaConfirmacao +
          '%</td>' +
          '<td style="padding: 10px 12px; font-size: 12px; color: #616161;">' +
          item.pendentesQtd +
          ' de ' +
          item.totalEsperado +
          ' restantes</td>' +
          '</tr>'
      }

      secoesHtml +=
        '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
        '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
        '<td><strong style="color: #0D47A1; font-size: 14px;">Confirmações de Comunicados Obrigatórios em Aberto</strong></td>' +
        '<td align="right"><span style="background-color: #FFF3E0; color: #E65100; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #FFE0B2;">' +
        comunicadosPendentes.length +
        ' comunicado(s)</span></td>' +
        '</tr></table>' +
        '</div>' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
        '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;">' +
        '<th style="padding: 8px 12px; text-align: left;">Comunicado</th>' +
        '<th style="padding: 8px 12px; text-align: left;">% Confirmação</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Pendência</th>' +
        '</tr></thead>' +
        '<tbody>' +
        linhasComun +
        '</tbody>' +
        '</table>' +
        '</div>'
    }

    // Seção Documentos
    if (pendenciasDocumentais.length > 0) {
      let linhasDoc = ''
      for (let i = 0; i < pendenciasDocumentais.length; i++) {
        const item = pendenciasDocumentais[i]
        linhasDoc +=
          '<tr style="border-bottom: 1px solid #EEEEEE;">' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
          item.documento +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 12px; color: #757575;">v' +
          item.versao +
          '</td>' +
          '<td style="padding: 10px 12px; font-size: 13px; color: #E65100; font-weight: 700;">' +
          item.totalPendentes +
          ' de ' +
          item.totalAtivos +
          ' ativos sem ciência</td>' +
          '</tr>'
      }

      secoesHtml +=
        '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
        '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
        '<td><strong style="color: #0D47A1; font-size: 14px;">Pendências Documentais Corporativas</strong></td>' +
        '<td align="right"><span style="background-color: #FFF3E0; color: #E65100; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #FFE0B2;">' +
        pendenciasDocumentais.length +
        ' documento(s)</span></td>' +
        '</tr></table>' +
        '</div>' +
        '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
        '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;">' +
        '<th style="padding: 8px 12px; text-align: left;">Documento</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Versão</th>' +
        '<th style="padding: 8px 12px; text-align: left;">Pessoas Pendentes</th>' +
        '</tr></thead>' +
        '<tbody>' +
        linhasDoc +
        '</tbody>' +
        '</table>' +
        '</div>'
    }

    // Seção Orçamento
    if (avisoOrcamento) {
      secoesHtml +=
        '<div style="margin-bottom: 24px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 16px;">' +
        '<div style="font-size: 12px; font-weight: 700; color: #0D47A1; text-transform: uppercase; margin-bottom: 4px;">Aviso de Orçamento da Folha — ' +
        avisoOrcamento.competencia +
        '</div>' +
        '<div style="font-size: 13px; color: #334155;">' +
        'Teto Folha: <strong>R$ ' +
        avisoOrcamento.folhaOrcada.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
        '</strong> | Teto Banco de Horas: <strong>R$ ' +
        avisoOrcamento.bancoHorasOrcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
        '</strong>' +
        (avisoOrcamento.observacao
          ? '<br><span style="font-size: 12px; color: #64748B;">Nota: ' +
            avisoOrcamento.observacao +
            '</span>'
          : '') +
        '</div></div>'
    }

    const resumoBadge =
      '<div style="background-color: #FFF3E0; border-left: 4px solid #E65100; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 22px;">' +
      '<strong style="color: #BF360C; font-size: 14px;">' +
      totalGeralPendencias +
      ' pendência(s) encontrada(s)</strong> no tenant hoje. Veja os detalhes abaixo para priorização da sua equipe.' +
      '</div>'

    const corpoHtml =
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' +
      assuntoEmail +
      "</title></head><body style=\"margin:0; padding:0; background-color:#F5F5F5; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#212121; -webkit-font-smoothing: antialiased;\">" +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F5F5F5; padding: 32px 12px;">' +
      '<tr><td align="center">' +
      '<table width="640" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius: 12px; overflow:hidden; border: 1px solid #E0E0E0; max-width:640px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">' +
      // Header Tesla (#0D47A1)
      '<tr><td style="background-color:#0D47A1; padding: 22px 32px; text-align: left;">' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
      '<td><span style="color:#ffffff; font-size: 19px; font-weight: 700; letter-spacing: -0.3px;">Gente e Gestão Tesla</span><div style="color:#BBDEFB; font-size: 11px; margin-top: 3px; font-weight: 500;">' +
      tenantNome +
      ' — Resumo Diário para Gestão</div></td>' +
      '<td align="right"><span style="background-color: rgba(255,255,255,0.18); color: #ffffff; padding: 5px 12px; border-radius: 14px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Digest Diário</span></td>' +
      '</tr></table>' +
      '</td></tr>' +
      // Corpo
      '<tr><td style="padding: 32px 32px 24px 32px;">' +
      '<p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #212121;">Bom dia, Equipe de RH!</p>' +
      '<p style="margin: 0 0 18px 0; font-size: 13px; color: #757575;">Resumo consolidado de pendências e solicitações operacionais do sistema referente a <strong>' +
      dataHojePtBr +
      '</strong>.</p>' +
      resumoBadge +
      secoesHtml +
      '<div style="text-align: center; margin: 30px 0 10px 0;">' +
      '<a href="' +
      ($os.getenv('APP_URL') || 'https://teslarh.com.br') +
      '/dashboard" style="background-color: #0D47A1; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 6px; font-weight: 700; display: inline-block; font-size: 14px; box-shadow: 0 2px 6px rgba(13,71,161,0.25);">Acessar Painel do RH</a>' +
      '</div>' +
      '</td></tr>' +
      // Rodapé institucional Tesla
      '<tr><td style="background-color:#FAFAFA; border-top: 1px solid #EEEEEE; padding: 22px 32px; text-align: center;">' +
      '<p style="margin:0 0 6px 0; font-size: 12px; font-weight: 700; color:#0D47A1;">Gente e Gestão Tesla</p>' +
      '<p style="margin:0 0 4px 0; font-size: 11px; color:#757575;">Este é o resumo diário automatizado configurado para os gestores e analistas de RH do tenant.</p>' +
      '<p style="margin:0; font-size: 10px; color:#9E9E9E;">Gerado em ' +
      dataHojePtBr +
      ' às 08:00 (America/Sao_Paulo). Anti-duplicação diária ativa.</p>' +
      '</td></tr>' +
      '</table></td></tr></table></body></html>'

    const textoPlano =
      'Bom dia, Equipe de RH!\n\n' +
      'Resumo Diário RH — ' +
      dataHojePtBr +
      '\n' +
      'Total de pendências: ' +
      totalGeralPendencias +
      '\n\n' +
      '- Alterações cadastrais: ' +
      alteracoesPendentes.length +
      '\n' +
      '- Férias aguardando aprovação: ' +
      feriasPendentes.length +
      '\n' +
      '- Atestados médicos para validação: ' +
      atestadosPendentes.length +
      '\n' +
      '- Compensações de banco de horas: ' +
      compensacoesPendentes.length +
      '\n' +
      '- Comunicados com leitura pendente: ' +
      comunicadosPendentes.length +
      '\n' +
      '- Documentos com ciências pendentes: ' +
      pendenciasDocumentais.length +
      '\n\n' +
      'Acesse o sistema Gente e Gestão Tesla para tratar as pendências.'

    // 5. Configuração SMTP do tenant
    let smtpRecord = null
    try {
      const records = $app.findRecordsByFilter(
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
      console.log('[Cron Digest] Erro smtp_config:', errFind)
    }

    // Se SMTP inativo / não cadastrado: salvar em email_log como 'pendente_envio'
    if (!smtpRecord || !smtpRecord.getBool('ativo')) {
      const motivoInativo = smtpRecord
        ? 'Configuração SMTP inativa'
        : 'Configuração SMTP não cadastrada'

      for (let d = 0; d < destinatarios.length; d++) {
        const dest = destinatarios[d]
        const logRec = new Record(emailLogCol)
        logRec.set('tenant_id', tenantId)
        logRec.set('destinatario', dest.email)
        logRec.set('assunto', assuntoEmail)
        logRec.set('status', 'pendente_envio')
        logRec.set(
          'erro',
          motivoInativo + ' (digest diário com ' + totalGeralPendencias + ' itens)',
        )
        try {
          logRec.set('tipo_evento', 'digest_diario')
          logRec.set('evento_ref', eventoRefId)
        } catch (_) {}
        try {
          $app.save(logRec)
        } catch (eLog) {
          console.log('[Cron Digest] Falha ao salvar email_log pendente_envio:', eLog)
        }
      }
      continue
    }

    // 6. Envio Real SMTP
    const host = smtpRecord.getString('host')
    const porta = smtpRecord.getInt('porta') || 587
    const usuario = smtpRecord.getString('usuario') || ''
    const senha = smtpRecord.getString('senha') || ''
    const remetenteNome = smtpRecord.getString('remetente_nome') || 'Gente e Gestão Tesla'
    const remetenteEmail = smtpRecord.getString('remetente_email') || 'noreply@teslarh.com.br'
    const tls = smtpRecord.getBool('tls')

    try {
      const mailerClient = $mailer.newSmtpClient({
        host: host,
        port: porta,
        username: usuario,
        password: senha,
        tls: tls,
      })

      const mailerRecipients = []
      for (let d = 0; d < destinatarios.length; d++) {
        mailerRecipients.push({
          address: destinatarios[d].email,
          name: destinatarios[d].nome || destinatarios[d].email,
        })
      }

      const msg = new MailerMessage({
        from: {
          address: remetenteEmail,
          name: remetenteNome,
        },
        to: mailerRecipients,
        subject: assuntoEmail,
        html: corpoHtml,
        text: textoPlano,
      })

      mailerClient.send(msg)

      for (let d = 0; d < destinatarios.length; d++) {
        const dest = destinatarios[d]
        const logRec = new Record(emailLogCol)
        logRec.set('tenant_id', tenantId)
        logRec.set('destinatario', dest.email)
        logRec.set('assunto', assuntoEmail)
        logRec.set('status', 'enviado')
        logRec.set('erro', '')
        try {
          logRec.set('tipo_evento', 'digest_diario')
          logRec.set('evento_ref', eventoRefId)
        } catch (_) {}
        try {
          $app.save(logRec)
        } catch (_) {}
      }
      console.log(
        '[Cron Digest] Digest diário enviado com sucesso para ' +
          destinatarios.length +
          ' destinatários!',
      )
    } catch (errEnvio) {
      const erroMsg = errEnvio && errEnvio.message ? errEnvio.message : String(errEnvio)
      console.log('[Cron Digest] Erro no envio SMTP do digest:', erroMsg)

      for (let d = 0; d < destinatarios.length; d++) {
        const dest = destinatarios[d]
        const logRec = new Record(emailLogCol)
        logRec.set('tenant_id', tenantId)
        logRec.set('destinatario', dest.email)
        logRec.set('assunto', assuntoEmail)
        logRec.set('status', 'falha')
        logRec.set('erro', erroMsg)
        try {
          logRec.set('tipo_evento', 'digest_diario')
          logRec.set('evento_ref', eventoRefId)
        } catch (_) {}
        try {
          $app.save(logRec)
        } catch (_) {}
      }
    }
  }

  console.log('[Cron Digest] Ciclo diário concluído.')
})

// Endpoint para prévia rápida das métricas do digest diário do tenant
routerAdd('GET', '/backend/v1/tesla/digest-preview', (c) => {
  const auth = c.get('authRecord')
  if (!auth) {
    return c.json(401, { message: 'Não autorizado.' })
  }

  const perfil = auth.getString('perfil')
  if (perfil !== 'admin' && perfil !== 'admin_rh' && perfil !== 'rh') {
    return c.json(403, { message: 'Acesso restrito ao RH e Administradores.' })
  }

  const tenantId = auth.getString('tenant_id')
  if (!tenantId) {
    return c.json(400, { message: 'Tenant não identificado.' })
  }

  try {
    let altCount = 0
    try {
      const alt = c.app.findRecordsByFilter(
        'solicitacao_alteracao',
        "tenant_id = '" + tenantId + "' && status = 'pendente'",
        '',
        100,
        0,
      )
      altCount = alt.length
    } catch (_) {}

    let feriasCount = 0
    try {
      const fr = c.app.findRecordsByFilter(
        'solicitacao_ferias',
        "tenant_id = '" + tenantId + "' && status = 'pendente'",
        '',
        100,
        0,
      )
      feriasCount = fr.length
    } catch (_) {}

    let atestCount = 0
    try {
      const at = c.app.findRecordsByFilter(
        'atestado',
        "tenant_id = '" + tenantId + "' && (status = 'recebido' || status = 'em_analise')",
        '',
        100,
        0,
      )
      atestCount = at.length
    } catch (_) {}

    let compCount = 0
    try {
      const cp = c.app.findRecordsByFilter(
        'compensacao_banco_horas',
        "tenant_id = '" + tenantId + "' && status = 'pendente'",
        '',
        100,
        0,
      )
      compCount = cp.length
    } catch (_) {}

    let comCount = 0
    try {
      const coms = c.app.findRecordsByFilter(
        'comunicado',
        "tenant_id = '" + tenantId + "' && status = 'ativo' && exige_confirmacao = true",
        '',
        20,
        0,
      )
      comCount = coms.length
    } catch (_) {}

    let docCount = 0
    try {
      const docs = c.app.findRecordsByFilter(
        'documento',
        "tenant_id = '" + tenantId + "' && obrigatorio = true && colaborador_id = ''",
        '',
        20,
        0,
      )
      docCount = docs.length
    } catch (_) {}

    const dests = []
    try {
      const uRh = c.app.findRecordsByFilter(
        'users',
        "tenant_id = '" +
          tenantId +
          "' && ativo = true && (perfil = 'rh' || perfil = 'admin_rh' || perfil = 'admin')",
        '',
        50,
        0,
      )
      for (let i = 0; i < uRh.length; i++) {
        const u = uRh[i]
        const em = u.getString('email') || ''
        if (em) {
          dests.push({
            email: em,
            nome: u.getString('name') || '',
            perfil: u.getString('perfil'),
          })
        }
      }
    } catch (_) {}

    const agora = new Date()
    const spDate = new Date(agora.getTime() + agora.getTimezoneOffset() * 60000 - 3 * 3600000)
    const dataHojeIso =
      spDate.getFullYear() +
      '-' +
      String(spDate.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(spDate.getDate()).padStart(2, '0')
    const eventoRefId = 'digest_' + dataHojeIso

    let jaEnviadoHoje = false
    try {
      const l = c.app.findRecordsByFilter(
        'email_log',
        "tenant_id = '" +
          tenantId +
          "' && tipo_evento = 'digest_diario' && evento_ref = '" +
          eventoRefId +
          "' && status = 'enviado'",
        '',
        1,
        0,
      )
      jaEnviadoHoje = l && l.length > 0
    } catch (_) {}

    return c.json(200, {
      dataHoje: dataHojeIso,
      horarioAgendado: '08:00 (America/Sao_Paulo)',
      cronExpression: '0 11 * * *',
      jaEnviadoHoje: jaEnviadoHoje,
      destinatarios: dests,
      metricas: {
        alteracoesCadastrais: altCount,
        feriasPendentes: feriasCount,
        atestadosPendentes: atestCount,
        compensacoesPendentes: compCount,
        comunicadosObrigatorios: comCount,
        documentosObrigatorios: docCount,
        totalGeral: altCount + feriasCount + atestCount + compCount,
      },
    })
  } catch (err) {
    return c.json(500, { message: 'Erro na prévia do digest: ' + String(err) })
  }
})

// Endpoint para disparo manual pelo RH/Admin
routerAdd('POST', '/backend/v1/tesla/digest-manual', (c) => {
  const auth = c.get('authRecord')
  if (!auth) {
    return c.json(401, { message: 'Não autorizado.' })
  }

  const perfil = auth.getString('perfil')
  if (perfil !== 'admin' && perfil !== 'admin_rh' && perfil !== 'rh') {
    return c.json(403, { message: 'Apenas RH ou Administradores podem disparar o resumo diário.' })
  }

  const tenantId = auth.getString('tenant_id')
  if (!tenantId) {
    return c.json(400, { message: 'Tenant não identificado.' })
  }

  let forcarVazio = false
  let ignorarIdempotencia = false
  try {
    const body = c.requestInfo().body
    if (body) {
      if (body.forcarVazio !== undefined) forcarVazio = Boolean(body.forcarVazio)
      if (body.ignorarIdempotencia !== undefined)
        ignorarIdempotencia = Boolean(body.ignorarIdempotencia)
    }
  } catch (_) {}

  const emailLogCol = c.app.findCollectionByNameOrId('email_log')

  const agora = new Date()
  const utcMs = agora.getTime() + agora.getTimezoneOffset() * 60000
  const spOffsetMs = -3 * 3600000
  const spDate = new Date(utcMs + spOffsetMs)

  const ano = spDate.getFullYear()
  const mes = String(spDate.getMonth() + 1).padStart(2, '0')
  const dia = String(spDate.getDate()).padStart(2, '0')
  const dataHojeIso = ano + '-' + mes + '-' + dia
  const dataHojePtBr = dia + '/' + mes + '/' + ano
  const eventoRefId = 'digest_' + dataHojeIso

  let tenantNome = 'Tesla Mecatrônica'
  try {
    const tRec = c.app.findRecordById('tenant', tenantId)
    if (tRec) tenantNome = tRec.getString('razao_social') || tenantNome
  } catch (_) {}

  // Checar idempotencia se não ignorar
  if (!ignorarIdempotencia) {
    try {
      const logsHoje = c.app.findRecordsByFilter(
        'email_log',
        "tenant_id = '" +
          tenantId +
          "' && tipo_evento = 'digest_diario' && evento_ref = '" +
          eventoRefId +
          "' && status = 'enviado'",
        '-created',
        1,
        0,
      )
      if (logsHoje && logsHoje.length > 0) {
        return c.json(200, {
          success: true,
          jaEnviado: true,
          message: 'O digest diário já foi enviado hoje para este tenant.',
        })
      }
    } catch (_) {}
  }

  // Destinatários
  const destinatarios = []
  try {
    const usersRh = c.app.findRecordsByFilter(
      'users',
      "tenant_id = '" +
        tenantId +
        "' && ativo = true && (perfil = 'rh' || perfil = 'admin_rh' || perfil = 'admin')",
      '-created',
      50,
      0,
    )

    for (let u = 0; u < usersRh.length; u++) {
      const usr = usersRh[u]
      let em = usr.getString('email') || ''
      let nm = usr.getString('name') || ''

      if (!em) {
        try {
          const colabList = c.app.findRecordsByFilter(
            'colaborador',
            "user_id = '" + usr.getString('id') + "'",
            '-created',
            1,
            0,
          )
          if (colabList && colabList.length > 0) {
            em = colabList[0].getString('email') || ''
            if (!nm) {
              nm = colabList[0].getString('nome_completo') || colabList[0].getString('nome') || ''
            }
          }
        } catch (_) {}
      }

      if (em && em.indexOf('@') !== -1) {
        let jaExiste = false
        for (let d = 0; d < destinatarios.length; d++) {
          if (destinatarios[d].email === em) {
            jaExiste = true
            break
          }
        }
        if (!jaExiste) {
          destinatarios.push({ email: em, nome: nm || 'Equipe de RH' })
        }
      }
    }
  } catch (errUsers) {
    console.log('Erro ao buscar usuarios RH para digest manual:', errUsers)
  }

  if (destinatarios.length === 0) {
    return c.json(400, {
      success: false,
      message: 'Nenhum usuário ativo com perfil RH / Admin com e-mail cadastrado.',
    })
  }

  // Coleta de pendências
  let alteracoesPendentes = []
  try {
    const solics = c.app.findRecordsByFilter(
      'solicitacao_alteracao',
      "tenant_id = '" + tenantId + "' && status = 'pendente'",
      '-created',
      25,
      0,
    )
    for (let s = 0; s < solics.length; s++) {
      const item = solics[s]
      let colabNome = 'Colaborador'
      const colabId = item.getString('colaborador_id')
      if (colabId) {
        try {
          const cRec = c.app.findRecordById('colaborador', colabId)
          if (cRec)
            colabNome = cRec.getString('nome_completo') || cRec.getString('nome') || colabNome
        } catch (_) {}
      }
      let dtSolic = item.getString('data_solicitacao') || item.getString('created') || ''
      if (dtSolic && dtSolic.length >= 10) {
        const parts = dtSolic.slice(0, 10).split('-')
        if (parts.length === 3) dtSolic = parts[2] + '/' + parts[1] + '/' + parts[0]
      }
      alteracoesPendentes.push({
        colaborador: colabNome,
        campo: item.getString('campo') || 'Dados gerais',
        data: dtSolic,
      })
    }
  } catch (_) {}

  let feriasPendentes = []
  try {
    const ferias = c.app.findRecordsByFilter(
      'solicitacao_ferias',
      "tenant_id = '" + tenantId + "' && status = 'pendente'",
      '-data_solicitacao',
      20,
      0,
    )
    for (let f = 0; f < ferias.length; f++) {
      const fr = ferias[f]
      let colabNome = 'Colaborador'
      const colabId = fr.getString('colaborador_id')
      if (colabId) {
        try {
          const cRec = c.app.findRecordById('colaborador', colabId)
          if (cRec)
            colabNome = cRec.getString('nome_completo') || cRec.getString('nome') || colabNome
        } catch (_) {}
      }
      let dtIni = fr.getString('data_inicio') || ''
      let dtFim = fr.getString('data_fim') || ''
      if (dtIni.length >= 10) {
        const p = dtIni.slice(0, 10).split('-')
        dtIni = p[2] + '/' + p[1] + '/' + p[0]
      }
      if (dtFim.length >= 10) {
        const p = dtFim.slice(0, 10).split('-')
        dtFim = p[2] + '/' + p[1] + '/' + p[0]
      }
      feriasPendentes.push({
        colaborador: colabNome,
        dias: fr.getInt('dias') || 0,
        periodo: dtIni + ' até ' + dtFim,
        abono: fr.getBool('abono_pecuniario'),
      })
    }
  } catch (_) {}

  let atestadosPendentes = []
  try {
    const atests = c.app.findRecordsByFilter(
      'atestado',
      "tenant_id = '" + tenantId + "' && (status = 'recebido' || status = 'em_analise')",
      '-data_envio',
      20,
      0,
    )
    for (let a = 0; a < atests.length; a++) {
      const at = atests[a]
      let colabNome = 'Colaborador'
      const colabId = at.getString('colaborador_id')
      if (colabId) {
        try {
          const cRec = c.app.findRecordById('colaborador', colabId)
          if (cRec)
            colabNome = cRec.getString('nome_completo') || cRec.getString('nome') || colabNome
        } catch (_) {}
      }
      let dtEnv = at.getString('data_envio') || at.getString('created') || ''
      if (dtEnv.length >= 10) {
        const p = dtEnv.slice(0, 10).split('-')
        dtEnv = p[2] + '/' + p[1] + '/' + p[0]
      }
      atestadosPendentes.push({
        colaborador: colabNome,
        dias: at.getInt('qtd_dias') || 1,
        dataEnvio: dtEnv,
        status: at.getString('status') === 'em_analise' ? 'Em análise' : 'Recebido',
      })
    }
  } catch (_) {}

  let compensacoesPendentes = []
  try {
    const comps = c.app.findRecordsByFilter(
      'compensacao_banco_horas',
      "tenant_id = '" + tenantId + "' && status = 'pendente'",
      '-created',
      15,
      0,
    )
    for (let cp = 0; cp < comps.length; cp++) {
      const cm = comps[cp]
      let colabNome = 'Colaborador'
      const colabId = cm.getString('colaborador_id')
      if (colabId) {
        try {
          const cRec = c.app.findRecordById('colaborador', colabId)
          if (cRec)
            colabNome = cRec.getString('nome_completo') || cRec.getString('nome') || colabNome
        } catch (_) {}
      }
      let dtComp = cm.getString('data_compensacao') || ''
      if (dtComp.length >= 10) {
        const p = dtComp.slice(0, 10).split('-')
        dtComp = p[2] + '/' + p[1] + '/' + p[0]
      }
      compensacoesPendentes.push({
        colaborador: colabNome,
        horas: cm.getFloat('horas') || 0,
        data: dtComp,
        motivo: cm.getString('motivo') || 'Compensação',
      })
    }
  } catch (_) {}

  let comunicadosPendentes = []
  try {
    const coms = c.app.findRecordsByFilter(
      'comunicado',
      "tenant_id = '" + tenantId + "' && status = 'ativo' && exige_confirmacao = true",
      '-data_publicacao',
      10,
      0,
    )
    if (coms.length > 0) {
      let totalAtivos = 0
      try {
        const cAtivos = c.app.findRecordsByFilter(
          'colaborador',
          "tenant_id = '" + tenantId + "' && status = 'ativo'",
          '-created',
          500,
          0,
        )
        totalAtivos = cAtivos.length
      } catch (_) {}

      for (let cm = 0; cm < coms.length; cm++) {
        const com = coms[cm]
        const comId = com.getString('id')
        const leituras = c.app.findRecordsByFilter(
          'comunicado_leitura',
          "tenant_id = '" + tenantId + "' && comunicado_id = '" + comId + "'",
          '-created',
          500,
          0,
        )
        const totalLidos = leituras.length
        const taxa = totalAtivos > 0 ? Math.round((totalLidos / totalAtivos) * 100) : 100
        if (taxa < 100) {
          comunicadosPendentes.push({
            titulo: com.getString('titulo') || 'Comunicado Geral',
            taxaConfirmacao: taxa,
            pendentesQtd: Math.max(0, totalAtivos - totalLidos),
            totalEsperado: totalAtivos,
          })
        }
      }
    }
  } catch (_) {}

  let pendenciasDocumentais = []
  try {
    const docsObrig = c.app.findRecordsByFilter(
      'documento',
      "tenant_id = '" + tenantId + "' && obrigatorio = true && colaborador_id = ''",
      '-created',
      20,
      0,
    )
    if (docsObrig.length > 0) {
      const colabsAtivos = c.app.findRecordsByFilter(
        'colaborador',
        "tenant_id = '" + tenantId + "' && status = 'ativo'",
        'nome',
        500,
        0,
      )

      for (let d = 0; d < docsObrig.length; d++) {
        const doc = docsObrig[d]
        const docId = doc.getString('id')
        const versao = (doc.getString('versao') || '1.0').trim()

        const ciencias = c.app.findRecordsByFilter(
          'ciencia_documento',
          "tenant_id = '" + tenantId + "' && documento_id = '" + docId + "'",
          '-created',
          1000,
          0,
        )

        const cientesIds = {}
        for (let ci = 0; ci < ciencias.length; ci++) {
          const vCiente = (ciencias[ci].getString('versao_ciente') || '').trim()
          if (vCiente === versao) {
            cientesIds[ciencias[ci].getString('colaborador_id')] = true
          }
        }

        let pendentesDoc = 0
        for (let ca = 0; ca < colabsAtivos.length; ca++) {
          if (!cientesIds[colabsAtivos[ca].getString('id')]) pendentesDoc++
        }

        if (pendentesDoc > 0) {
          pendenciasDocumentais.push({
            documento: doc.getString('nome') || 'Documento Institucional',
            versao: versao,
            totalPendentes: pendentesDoc,
            totalAtivos: colabsAtivos.length,
          })
        }
      }
    }
  } catch (_) {}

  let avisoOrcamento = null
  try {
    const compAtual = ano + '-' + mes
    const orcs = c.app.findRecordsByFilter(
      'orcamento_folha',
      "tenant_id = '" + tenantId + "' && competencia = '" + compAtual + "'",
      '-created',
      1,
      0,
    )
    if (orcs && orcs.length > 0) {
      const o = orcs[0]
      avisoOrcamento = {
        competencia: compAtual,
        folhaOrcada: o.getFloat('valor_orcado_folha') || 0,
        bancoHorasOrcado: o.getFloat('valor_orcado_banco_horas') || 0,
        observacao: o.getString('observacao') || '',
      }
    }
  } catch (_) {}

  const totalGeralPendencias =
    alteracoesPendentes.length +
    feriasPendentes.length +
    atestadosPendentes.length +
    compensacoesPendentes.length +
    comunicadosPendentes.length +
    pendenciasDocumentais.length

  if (totalGeralPendencias === 0 && !forcarEnvioVazio) {
    return c.json(200, {
      success: true,
      enviado: false,
      message:
        'Nenhuma pendência operacional encontrada no momento. Envio de e-mail vazio ignorado.',
      totalPendencias: 0,
    })
  }

  // HTML
  const assuntoEmail = 'Resumo Diário RH — ' + dataHojePtBr

  let secoesHtml = ''

  if (alteracoesPendentes.length > 0) {
    let linhasAlt = ''
    for (let i = 0; i < alteracoesPendentes.length; i++) {
      const item = alteracoesPendentes[i]
      linhasAlt +=
        '<tr style="border-bottom: 1px solid #EEEEEE;">' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
        item.colaborador +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #0D47A1; font-weight: 500;">' +
        item.campo +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 12px; color: #616161;">' +
        item.data +
        '</td>' +
        '</tr>'
    }
    secoesHtml +=
      '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
      '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
      '<td><strong style="color: #0D47A1; font-size: 14px;">Solicitações de Alteração Cadastral</strong></td>' +
      '<td align="right"><span style="background-color: #FFF3E0; color: #E65100; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #FFE0B2;">' +
      alteracoesPendentes.length +
      ' pendente(s)</span></td>' +
      '</tr></table>' +
      '</div>' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
      '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;"><th style="padding: 8px 12px; text-align: left;">Colaborador</th><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Data</th></tr></thead>' +
      '<tbody>' +
      linhasAlt +
      '</tbody></table></div>'
  }

  if (feriasPendentes.length > 0) {
    let linhasFerias = ''
    for (let i = 0; i < feriasPendentes.length; i++) {
      const item = feriasPendentes[i]
      linhasFerias +=
        '<tr style="border-bottom: 1px solid #EEEEEE;">' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
        item.colaborador +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #424242;">' +
        item.periodo +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 12px; color: #0D47A1; font-weight: 700;">' +
        item.dias +
        ' dias' +
        (item.abono ? ' (abono)' : '') +
        '</td>' +
        '</tr>'
    }
    secoesHtml +=
      '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
      '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
      '<td><strong style="color: #0D47A1; font-size: 14px;">Solicitações de Férias Aguardando Aprovação</strong></td>' +
      '<td align="right"><span style="background-color: #E8EEF7; color: #0D47A1; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #BBDEFB;">' +
      feriasPendentes.length +
      ' aguardando</span></td>' +
      '</tr></table>' +
      '</div>' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
      '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;"><th style="padding: 8px 12px; text-align: left;">Colaborador</th><th style="padding: 8px 12px; text-align: left;">Período</th><th style="padding: 8px 12px; text-align: left;">Duração</th></tr></thead>' +
      '<tbody>' +
      linhasFerias +
      '</tbody></table></div>'
  }

  if (atestadosPendentes.length > 0) {
    let linhasAtest = ''
    for (let i = 0; i < atestadosPendentes.length; i++) {
      const item = atestadosPendentes[i]
      linhasAtest +=
        '<tr style="border-bottom: 1px solid #EEEEEE;">' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
        item.colaborador +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #424242;">' +
        item.dias +
        (item.dias === 1 ? ' dia' : ' dias') +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 12px; color: #757575;">' +
        item.dataEnvio +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 12px;"><span style="background-color: #FEF3C7; color: #92400E; padding: 2px 6px; border-radius: 4px; font-weight: 600;">' +
        item.status +
        '</span></td>' +
        '</tr>'
    }
    secoesHtml +=
      '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
      '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
      '<td><strong style="color: #0D47A1; font-size: 14px;">Atestados Médicos Pendentes de Validação</strong></td>' +
      '<td align="right"><span style="background-color: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #FDE68A;">' +
      atestadosPendentes.length +
      ' recebido(s)</span></td>' +
      '</tr></table>' +
      '</div>' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
      '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;"><th style="padding: 8px 12px; text-align: left;">Colaborador</th><th style="padding: 8px 12px; text-align: left;">Qtd. Dias</th><th style="padding: 8px 12px; text-align: left;">Enviado em</th><th style="padding: 8px 12px; text-align: left;">Status</th></tr></thead>' +
      '<tbody>' +
      linhasAtest +
      '</tbody></table></div>'
  }

  if (compensacoesPendentes.length > 0) {
    let linhasComp = ''
    for (let i = 0; i < compensacoesPendentes.length; i++) {
      const item = compensacoesPendentes[i]
      linhasComp +=
        '<tr style="border-bottom: 1px solid #EEEEEE;">' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
        item.colaborador +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #0D47A1; font-weight: 700;">' +
        item.horas +
        'h</td>' +
        '<td style="padding: 10px 12px; font-size: 12px; color: #424242;">' +
        item.data +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 12px; color: #616161;">' +
        item.motivo +
        '</td>' +
        '</tr>'
    }
    secoesHtml +=
      '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
      '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
      '<td><strong style="color: #0D47A1; font-size: 14px;">Compensações de Banco de Horas Pendentes</strong></td>' +
      '<td align="right"><span style="background-color: #E8EEF7; color: #0D47A1; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #BBDEFB;">' +
      compensacoesPendentes.length +
      ' solicitação(ões)</span></td>' +
      '</tr></table>' +
      '</div>' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
      '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;"><th style="padding: 8px 12px; text-align: left;">Colaborador</th><th style="padding: 8px 12px; text-align: left;">Horas</th><th style="padding: 8px 12px; text-align: left;">Data</th><th style="padding: 8px 12px; text-align: left;">Motivo</th></tr></thead>' +
      '<tbody>' +
      linhasComp +
      '</tbody></table></div>'
  }

  if (comunicadosPendentes.length > 0) {
    let linhasComun = ''
    for (let i = 0; i < comunicadosPendentes.length; i++) {
      const item = comunicadosPendentes[i]
      linhasComun +=
        '<tr style="border-bottom: 1px solid #EEEEEE;">' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
        item.titulo +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #E65100; font-weight: 700;">' +
        item.taxaConfirmacao +
        '%</td>' +
        '<td style="padding: 10px 12px; font-size: 12px; color: #616161;">' +
        item.pendentesQtd +
        ' de ' +
        item.totalEsperado +
        ' restantes</td>' +
        '</tr>'
    }
    secoesHtml +=
      '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
      '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
      '<td><strong style="color: #0D47A1; font-size: 14px;">Confirmações de Comunicados Obrigatórios em Aberto</strong></td>' +
      '<td align="right"><span style="background-color: #FFF3E0; color: #E65100; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #FFE0B2;">' +
      comunicadosPendentes.length +
      ' comunicado(s)</span></td>' +
      '</tr></table>' +
      '</div>' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
      '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;"><th style="padding: 8px 12px; text-align: left;">Comunicado</th><th style="padding: 8px 12px; text-align: left;">% Confirmação</th><th style="padding: 8px 12px; text-align: left;">Pendência</th></tr></thead>' +
      '<tbody>' +
      linhasComun +
      '</tbody></table></div>'
  }

  if (pendenciasDocumentais.length > 0) {
    let linhasDoc = ''
    for (let i = 0; i < pendenciasDocumentais.length; i++) {
      const item = pendenciasDocumentais[i]
      linhasDoc +=
        '<tr style="border-bottom: 1px solid #EEEEEE;">' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #212121; font-weight: 600;">' +
        item.documento +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 12px; color: #757575;">v' +
        item.versao +
        '</td>' +
        '<td style="padding: 10px 12px; font-size: 13px; color: #E65100; font-weight: 700;">' +
        item.totalPendentes +
        ' de ' +
        item.totalAtivos +
        ' ativos sem ciência</td>' +
        '</tr>'
    }
    secoesHtml +=
      '<div style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">' +
      '<div style="background-color: #F8FAFC; padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
      '<td><strong style="color: #0D47A1; font-size: 14px;">Pendências Documentais Corporativas</strong></td>' +
      '<td align="right"><span style="background-color: #FFF3E0; color: #E65100; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #FFE0B2;">' +
      pendenciasDocumentais.length +
      ' documento(s)</span></td>' +
      '</tr></table>' +
      '</div>' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
      '<thead><tr style="background-color: #FAFAFA; border-bottom: 1px solid #EEEEEE; font-size: 11px; color: #757575; text-transform: uppercase;"><th style="padding: 8px 12px; text-align: left;">Documento</th><th style="padding: 8px 12px; text-align: left;">Versão</th><th style="padding: 8px 12px; text-align: left;">Pessoas Pendentes</th></tr></thead>' +
      '<tbody>' +
      linhasDoc +
      '</tbody></table></div>'
  }

  if (avisoOrcamento) {
    secoesHtml +=
      '<div style="margin-bottom: 24px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 16px;">' +
      '<div style="font-size: 12px; font-weight: 700; color: #0D47A1; text-transform: uppercase; margin-bottom: 4px;">Aviso de Orçamento da Folha — ' +
      avisoOrcamento.competencia +
      '</div>' +
      '<div style="font-size: 13px; color: #334155;">Teto Folha: <strong>R$ ' +
      avisoOrcamento.folhaOrcada.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
      '</strong> | Teto BH: <strong>R$ ' +
      avisoOrcamento.bancoHorasOrcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
      '</strong>' +
      (avisoOrcamento.observacao
        ? '<br><span style="font-size: 12px; color: #64748B;">Nota: ' +
          avisoOrcamento.observacao +
          '</span>'
        : '') +
      '</div></div>'
  }

  if (totalGeralPendencias === 0 && forcarEnvioVazio) {
    secoesHtml =
      '<div style="margin-bottom: 24px; background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 18px; text-align: center;">' +
      '<p style="margin: 0; font-size: 14px; font-weight: 700; color: #166534;">Nenhuma pendência operacional em aberto!</p>' +
      '<p style="margin: 4px 0 0 0; font-size: 12px; color: #15803D;">Todas as alterações, férias, documentos e atestados estão regularizados.</p>' +
      '</div>'
  }

  const resumoBadge =
    totalGeralPendencias > 0
      ? '<div style="background-color: #FFF3E0; border-left: 4px solid #E65100; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 22px;">' +
        '<strong style="color: #BF360C; font-size: 14px;">' +
        totalGeralPendencias +
        ' pendência(s) encontrada(s)</strong> no tenant hoje. Veja os detalhes abaixo para priorização da sua equipe.' +
        '</div>'
      : ''

  const corpoHtml =
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' +
    assuntoEmail +
    "</title></head><body style=\"margin:0; padding:0; background-color:#F5F5F5; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#212121; -webkit-font-smoothing: antialiased;\">" +
    '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F5F5F5; padding: 32px 12px;">' +
    '<tr><td align="center">' +
    '<table width="640" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius: 12px; overflow:hidden; border: 1px solid #E0E0E0; max-width:640px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">' +
    '<tr><td style="background-color:#0D47A1; padding: 22px 32px; text-align: left;">' +
    '<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>' +
    '<td><span style="color:#ffffff; font-size: 19px; font-weight: 700; letter-spacing: -0.3px;">Gente e Gestão Tesla</span><div style="color:#BBDEFB; font-size: 11px; margin-top: 3px; font-weight: 500;">' +
    tenantNome +
    ' — Resumo Diário para Gestão</div></td>' +
    '<td align="right"><span style="background-color: rgba(255,255,255,0.18); color: #ffffff; padding: 5px 12px; border-radius: 14px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Digest Diário</span></td>' +
    '</tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding: 32px 32px 24px 32px;">' +
    '<p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #212121;">Bom dia, Equipe de RH!</p>' +
    '<p style="margin: 0 0 18px 0; font-size: 13px; color: #757575;">Resumo consolidado de pendências e solicitações operacionais do sistema referente a <strong>' +
    dataHojePtBr +
    '</strong>.</p>' +
    resumoBadge +
    secoesHtml +
    '<div style="text-align: center; margin: 30px 0 10px 0;">' +
    '<a href="' +
    ($os.getenv('APP_URL') || 'https://teslarh.com.br') +
    '/dashboard" style="background-color: #0D47A1; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 6px; font-weight: 700; display: inline-block; font-size: 14px; box-shadow: 0 2px 6px rgba(13,71,161,0.25);">Acessar Painel do RH</a>' +
    '</div>' +
    '</td></tr>' +
    '<tr><td style="background-color:#FAFAFA; border-top: 1px solid #EEEEEE; padding: 22px 32px; text-align: center;">' +
    '<p style="margin:0 0 6px 0; font-size: 12px; font-weight: 700; color:#0D47A1;">Gente e Gestão Tesla</p>' +
    '<p style="margin:0 0 4px 0; font-size: 11px; color:#757575;">Este é o resumo diário automatizado configurado para os gestores e analistas de RH do tenant.</p>' +
    '<p style="margin:0; font-size: 10px; color:#9E9E9E;">Gerado em ' +
    dataHojePtBr +
    ' via Gente e Gestão Tesla. Anti-duplicação diária ativa.</p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>'

  const textoPlano =
    'Bom dia, Equipe de RH!\n\n' +
    'Resumo Diário RH — ' +
    dataHojePtBr +
    '\n' +
    'Total de pendências: ' +
    totalGeralPendencias +
    '\n\n' +
    '- Alterações cadastrais: ' +
    alteracoesPendentes.length +
    '\n' +
    '- Férias aguardando: ' +
    feriasPendentes.length +
    '\n' +
    '- Atestados para validação: ' +
    atestadosPendentes.length +
    '\n' +
    '- Compensações de banco de horas: ' +
    compensacoesPendentes.length +
    '\n' +
    '- Comunicados em aberto: ' +
    comunicadosPendentes.length +
    '\n' +
    '- Documentos com pendência: ' +
    pendenciasDocumentais.length +
    '\n\n' +
    'Acesse o sistema Gente e Gestão Tesla para tratar as pendências.'

  // SMTP do tenant
  let smtpRecord = null
  try {
    const records = c.app.findRecordsByFilter(
      'smtp_config',
      "tenant_id = '" + tenantId + "'",
      '-created',
      1,
      0,
    )
    if (records && records.length > 0) smtpRecord = records[0]
  } catch (_) {}

  if (!smtpRecord || !smtpRecord.getBool('ativo')) {
    const motivoInativo = smtpRecord
      ? 'Configuração SMTP inativa'
      : 'Configuração SMTP não cadastrada'

    for (let d = 0; d < destinatarios.length; d++) {
      const dest = destinatarios[d]
      const logRec = new Record(emailLogCol)
      logRec.set('tenant_id', tenantId)
      logRec.set('destinatario', dest.email)
      logRec.set('assunto', assuntoEmail)
      logRec.set('status', 'pendente_envio')
      logRec.set(
        'erro',
        motivoInativo + ' (digest com ' + totalGeralPendencias + ' itens pendentes)',
      )
      try {
        logRec.set('tipo_evento', 'digest_diario')
        logRec.set('evento_ref', eventoRefId)
      } catch (_) {}
      try {
        c.app.save(logRec)
      } catch (_) {}
    }

    return c.json(200, {
      success: true,
      enviado: false,
      status: 'pendente_envio',
      motivo: motivoInativo,
      destinatarios: destinatarios.map((d) => d.email),
      totalPendencias: totalGeralPendencias,
      message:
        'Digest registrado como pendente_envio na auditoria de e-mails (' +
        motivoInativo +
        '). Configure e ative o SMTP na aba Servidor para entrega direta na caixa postal.',
    })
  }

  // Envio SMTP
  const host = smtpRecord.getString('host')
  const porta = smtpRecord.getInt('porta') || 587
  const usuario = smtpRecord.getString('usuario') || ''
  const senha = smtpRecord.getString('senha') || ''
  const remetenteNome = smtpRecord.getString('remetente_nome') || 'Gente e Gestão Tesla'
  const remetenteEmail = smtpRecord.getString('remetente_email') || 'noreply@teslarh.com.br'
  const tls = smtpRecord.getBool('tls')

  try {
    const mailerClient = $mailer.newSmtpClient({
      host: host,
      port: porta,
      username: usuario,
      password: senha,
      tls: tls,
    })

    const mailerRecipients = []
    for (let d = 0; d < destinatarios.length; d++) {
      mailerRecipients.push({
        address: destinatarios[d].email,
        name: destinatarios[d].nome || destinatarios[d].email,
      })
    }

    const msg = new MailerMessage({
      from: {
        address: remetenteEmail,
        name: remetenteNome,
      },
      to: mailerRecipients,
      subject: assuntoEmail,
      html: corpoHtml,
      text: textoPlano,
    })

    mailerClient.send(msg)

    for (let d = 0; d < destinatarios.length; d++) {
      const dest = destinatarios[d]
      const logRec = new Record(emailLogCol)
      logRec.set('tenant_id', tenantId)
      logRec.set('destinatario', dest.email)
      logRec.set('assunto', assuntoEmail)
      logRec.set('status', 'enviado')
      logRec.set('erro', '')
      try {
        logRec.set('tipo_evento', 'digest_diario')
        logRec.set('evento_ref', eventoRefId)
      } catch (_) {}
      try {
        c.app.save(logRec)
      } catch (_) {}
    }

    return c.json(200, {
      success: true,
      enviado: true,
      status: 'enviado',
      destinatarios: destinatarios.map((d) => d.email),
      totalPendencias: totalGeralPendencias,
      message: 'Digest diário enviado com sucesso para ' + destinatarios.length + ' destinatários!',
    })
  } catch (errEnvio) {
    const erroMsg = errEnvio && errEnvio.message ? errEnvio.message : String(errEnvio)

    for (let d = 0; d < destinatarios.length; d++) {
      const dest = destinatarios[d]
      const logRec = new Record(emailLogCol)
      logRec.set('tenant_id', tenantId)
      logRec.set('destinatario', dest.email)
      logRec.set('assunto', assuntoEmail)
      logRec.set('status', 'falha')
      logRec.set('erro', erroMsg)
      try {
        logRec.set('tipo_evento', 'digest_diario')
        logRec.set('evento_ref', eventoRefId)
      } catch (_) {}
      try {
        c.app.save(logRec)
      } catch (_) {}
    }

    return c.json(500, {
      success: false,
      enviado: false,
      status: 'falha',
      message: 'Falha no envio do digest via SMTP: ' + erroMsg,
    })
  }
})
