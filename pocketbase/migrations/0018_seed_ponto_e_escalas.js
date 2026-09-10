migrate(
  (app) => {
    // 1. Obter tenant principal
    let tenantRecord
    try {
      tenantRecord = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')
    } catch (_) {
      tenantRecord = app.findFirstRecordByData('tenant', 'status', 'ativo')
    }
    const tenantId = tenantRecord.id

    // 2. Obter colaboradores principais
    let lucasColab, robertoColab, marianaColab, claudioColab, thiagoColab
    try {
      lucasColab = app.findFirstRecordByData(
        'colaborador',
        'email',
        'lucas.ferreira@teslarh.com.br',
      )
    } catch (_) {
      lucasColab = app.findFirstRecordByData('colaborador', 'nome', 'Lucas Ferreira')
    }

    try {
      robertoColab = app.findFirstRecordByData('colaborador', 'nome', 'Roberto Almeida')
    } catch (_) {}

    try {
      marianaColab = app.findFirstRecordByData('colaborador', 'nome', 'Mariana Silva')
    } catch (_) {}

    try {
      claudioColab = app.findFirstRecordByData('colaborador', 'nome', 'Cláudio Zanutim')
    } catch (_) {}

    try {
      thiagoColab = app.findFirstRecordByData('colaborador', 'nome', 'Thiago Ramos')
    } catch (_) {}

    const escalaCol = app.findCollectionByNameOrId('escala_trabalho')
    const colabEscalaCol = app.findCollectionByNameOrId('colaborador_escala')
    const pontoCol = app.findCollectionByNameOrId('registro_ponto')

    // 3. Cadastrar Escalas Padrão de Trabalho
    // Escala 1: "Administrativo 08h–17h" (seg,ter,qua,qui,sex)
    let escalaAdm
    try {
      escalaAdm = app.findFirstRecordByData('escala_trabalho', 'nome', 'Administrativo 08h–17h')
    } catch (_) {
      escalaAdm = new Record(escalaCol)
      escalaAdm.set('tenant_id', tenantId)
      escalaAdm.set('nome', 'Administrativo 08h–17h')
      escalaAdm.set('horario_inicio', '08:00')
      escalaAdm.set('horario_fim', '17:00')
      escalaAdm.set('dias_semana', 'seg,ter,qua,qui,sex')
      app.save(escalaAdm)
    }

    // Escala 2: "Turno Manhã 06h–14h" (seg,ter,qua,qui,sex,sab)
    let escalaManha
    try {
      escalaManha = app.findFirstRecordByData('escala_trabalho', 'nome', 'Turno Manhã 06h–14h')
    } catch (_) {
      escalaManha = new Record(escalaCol)
      escalaManha.set('tenant_id', tenantId)
      escalaManha.set('nome', 'Turno Manhã 06h–14h')
      escalaManha.set('horario_inicio', '06:00')
      escalaManha.set('horario_fim', '14:00')
      escalaManha.set('dias_semana', 'seg,ter,qua,qui,sex,sab')
      app.save(escalaManha)
    }

    // Escala 3: "Comercial 09h–18h" (seg,ter,qua,qui,sex)
    let escalaComercial
    try {
      escalaComercial = app.findFirstRecordByData('escala_trabalho', 'nome', 'Comercial 09h–18h')
    } catch (_) {
      escalaComercial = new Record(escalaCol)
      escalaComercial.set('tenant_id', tenantId)
      escalaComercial.set('nome', 'Comercial 09h–18h')
      escalaComercial.set('horario_inicio', '09:00')
      escalaComercial.set('horario_fim', '18:00')
      escalaComercial.set('dias_semana', 'seg,ter,qua,qui,sex')
      app.save(escalaComercial)
    }

    // 4. Vincular colaboradores a escalas
    const vincular = (colabRecord, escalaRecord, dtInicio, dtFim) => {
      if (!colabRecord || !escalaRecord) return
      try {
        const existente = app.findRecordsByFilter(
          'colaborador_escala',
          `colaborador_id = '${colabRecord.id}' && escala_id = '${escalaRecord.id}'`,
          '-created',
          1,
          0,
        )
        if (existente && existente.length > 0) return
      } catch (_) {}

      const v = new Record(colabEscalaCol)
      v.set('tenant_id', tenantId)
      v.set('colaborador_id', colabRecord.id)
      v.set('escala_id', escalaRecord.id)
      v.set('data_inicio', dtInicio)
      if (dtFim) v.set('data_fim', dtFim)
      app.save(v)
    }

    vincular(lucasColab, escalaAdm, '2026-01-01 00:00:00.000Z')
    vincular(robertoColab, escalaAdm, '2026-01-01 00:00:00.000Z')
    vincular(marianaColab, escalaComercial, '2026-01-01 00:00:00.000Z')
    vincular(claudioColab, escalaComercial, '2026-01-01 00:00:00.000Z')
    if (thiagoColab) {
      vincular(thiagoColab, escalaManha, '2026-01-01 00:00:00.000Z')
    }

    // 5. Popular batidas de ponto dos últimos dias para Lucas Ferreira
    // Simular dias úteis recentes em Setembro 2026 (por exemplo: dias 01, 02, 03, 04, 08, 09)
    // No dia 2026-01-12 ele tem atestado validado (já existente no DB).
    if (lucasColab) {
      const batidasExemplo = [
        // 2026-09-01 (Terça)
        { dh: '2026-09-01 08:02:14.000Z', tipo: 'entrada' },
        { dh: '2026-09-01 12:01:45.000Z', tipo: 'saida_almoco' },
        { dh: '2026-09-01 13:00:10.000Z', tipo: 'volta_almoco' },
        { dh: '2026-09-01 17:05:30.000Z', tipo: 'saida' },

        // 2026-09-02 (Quarta)
        { dh: '2026-09-02 07:58:20.000Z', tipo: 'entrada' },
        { dh: '2026-09-02 12:05:00.000Z', tipo: 'saida_almoco' },
        { dh: '2026-09-02 13:03:15.000Z', tipo: 'volta_almoco' },
        { dh: '2026-09-02 17:01:10.000Z', tipo: 'saida' },

        // 2026-09-03 (Quinta)
        { dh: '2026-09-03 08:14:40.000Z', tipo: 'entrada' }, // ligeiro atraso
        { dh: '2026-09-03 12:00:05.000Z', tipo: 'saida_almoco' },
        { dh: '2026-09-03 13:00:50.000Z', tipo: 'volta_almoco' },
        { dh: '2026-09-03 17:35:20.000Z', tipo: 'saida' }, // hora extra

        // 2026-09-04 (Sexta)
        { dh: '2026-09-04 08:00:10.000Z', tipo: 'entrada' },
        { dh: '2026-09-04 12:02:00.000Z', tipo: 'saida_almoco' },
        { dh: '2026-09-04 13:01:00.000Z', tipo: 'volta_almoco' },
        { dh: '2026-09-04 17:00:45.000Z', tipo: 'saida' },

        // 2026-09-08 (Terça - pós feriado)
        { dh: '2026-09-08 07:59:00.000Z', tipo: 'entrada' },
        { dh: '2026-09-08 12:04:10.000Z', tipo: 'saida_almoco' },
        { dh: '2026-09-08 13:04:30.000Z', tipo: 'volta_almoco' },
        { dh: '2026-09-08 17:02:15.000Z', tipo: 'saida' },

        // 2026-09-09 (Hoje)
        { dh: '2026-09-09 08:01:22.000Z', tipo: 'entrada' },
        { dh: '2026-09-09 12:00:15.000Z', tipo: 'saida_almoco' },
        { dh: '2026-09-09 13:00:00.000Z', tipo: 'volta_almoco' },
      ]

      for (const b of batidasExemplo) {
        try {
          const jaExiste = app.findRecordsByFilter(
            'registro_ponto',
            `colaborador_id = '${lucasColab.id}' && data_hora = '${b.dh}'`,
            '-created',
            1,
            0,
          )
          if (jaExiste && jaExiste.length > 0) continue
        } catch (_) {}

        const rec = new Record(pontoCol)
        rec.set('tenant_id', tenantId)
        rec.set('colaborador_id', lucasColab.id)
        rec.set('data_hora', b.dh)
        rec.set('tipo', b.tipo)
        rec.set('origem', 'web')
        app.save(rec)
      }
    }

    // 6. Popular batida do dia de hoje para outros colaboradores para enriquecer "Gestão de Ponto"
    if (robertoColab) {
      try {
        const rec = new Record(pontoCol)
        rec.set('tenant_id', tenantId)
        rec.set('colaborador_id', robertoColab.id)
        rec.set('data_hora', '2026-09-09 08:05:00.000Z')
        rec.set('tipo', 'entrada')
        rec.set('origem', 'web')
        app.save(rec)
      } catch (_) {}
    }

    if (marianaColab) {
      try {
        const rec = new Record(pontoCol)
        rec.set('tenant_id', tenantId)
        rec.set('colaborador_id', marianaColab.id)
        rec.set('data_hora', '2026-09-09 08:55:00.000Z')
        rec.set('tipo', 'entrada')
        rec.set('origem', 'web')
        app.save(rec)
      } catch (_) {}
    }
  },
  (app) => {
    // Reverter seeds é opcional
  },
)
