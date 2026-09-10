migrate(
  (app) => {
    // 1. Campo status em 'comunicado': 'ativo' | 'arquivado' (default 'ativo')
    const comunicadoCol = app.findCollectionByNameOrId('comunicado')
    if (!comunicadoCol.fields.getByName('status')) {
      comunicadoCol.fields.add(
        new SelectField({
          name: 'status',
          required: false,
          values: ['ativo', 'arquivado'],
          maxSelect: 1,
        }),
      )
      app.save(comunicadoCol)
    }

    // Preenche registros existentes de comunicado como 'ativo' se estiver vazio
    app
      .db()
      .newQuery("UPDATE comunicado SET status = 'ativo' WHERE status IS NULL OR status = ''")
      .execute()

    // 2. Campos em 'tenant': endereco, telefone, regime_tributario
    const tenantCol = app.findCollectionByNameOrId('tenant')
    let tenantModified = false

    if (!tenantCol.fields.getByName('endereco')) {
      tenantCol.fields.add(new TextField({ name: 'endereco', required: false }))
      tenantModified = true
    }
    if (!tenantCol.fields.getByName('telefone')) {
      tenantCol.fields.add(new TextField({ name: 'telefone', required: false }))
      tenantModified = true
    }
    if (!tenantCol.fields.getByName('regime_tributario')) {
      tenantCol.fields.add(
        new SelectField({
          name: 'regime_tributario',
          required: false,
          values: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'],
          maxSelect: 1,
        }),
      )
      tenantModified = true
    }
    if (tenantModified) {
      app.save(tenantCol)
    }

    // Preenche dados padrão no tenant Tesla RH Ltda
    try {
      const teslaTenant = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')
      let changed = false
      if (!teslaTenant.getString('endereco')) {
        teslaTenant.set(
          'endereco',
          'Av. Paulista, 1578, 14º Andar - Bela Vista, São Paulo - SP, CEP 01310-200',
        )
        changed = true
      }
      if (!teslaTenant.getString('telefone')) {
        teslaTenant.set('telefone', '(11) 3254-8900')
        changed = true
      }
      if (!teslaTenant.getString('regime_tributario')) {
        teslaTenant.set('regime_tributario', 'Lucro Real')
        changed = true
      }
      if (changed) {
        app.save(teslaTenant)
      }
    } catch (_) {}

    // 3. Campo 'ativo' (bool) em 'users' para soft-delete / desativação
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('ativo')) {
      usersCol.fields.add(
        new BoolField({
          name: 'ativo',
          required: false,
        }),
      )
      app.save(usersCol)
    }

    // Preenche usuários existentes como ativo = 1 (true)
    app.db().newQuery('UPDATE users SET ativo = 1 WHERE ativo IS NULL').execute()

    // 4. Seed de algumas solicitações de alteração adicionais para testar fluxo de aprovação/rejeição
    try {
      const solCol = app.findCollectionByNameOrId('solicitacao_alteracao')
      const teslaTenant = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')
      const lucas = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')

      // Seed 1: Alteração de Endereço (Pendente)
      try {
        app.findFirstRecordByData('solicitacao_alteracao', 'campo', 'Endereço')
      } catch (_) {
        const sol1 = new Record(solCol)
        sol1.set('colaborador_id', lucas.id)
        sol1.set('tenant_id', teslaTenant.id)
        sol1.set('campo', 'Endereço')
        sol1.set(
          'valor_antigo',
          'Av. Paulista, 1578, Apto 82 - Bela Vista, São Paulo - SP, 01310-200',
        )
        sol1.set('valor_novo', 'Rua Augusta, 1200, Apto 45 - Consolação, São Paulo - SP, 01304-001')
        sol1.set('status', 'pendente')
        sol1.set('data_solicitacao', '2026-04-14 14:00:00.000Z')
        app.save(sol1)
      }

      // Seed 2: Alteração de Chave PIX (Pendente)
      try {
        app.findFirstRecordByData('solicitacao_alteracao', 'campo', 'Chave PIX')
      } catch (_) {
        const sol2 = new Record(solCol)
        sol2.set('colaborador_id', lucas.id)
        sol2.set('tenant_id', teslaTenant.id)
        sol2.set('campo', 'Chave PIX')
        sol2.set('valor_antigo', 'lucas.ferreira@teslarh.com.br')
        sol2.set('valor_novo', '(11) 98765-4321')
        sol2.set('status', 'pendente')
        sol2.set('data_solicitacao', '2026-04-15 09:30:00.000Z')
        app.save(sol2)
      }
    } catch (_) {}

    // 5. Seed de logs de auditoria iniciais para demonstração da nova tela de logs
    try {
      const auditCol = app.findCollectionByNameOrId('log_auditoria')
      const teslaTenant = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')
      const adminUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'claudio.zanutim@iceduc.com.br',
      )
      const rhUser = app.findAuthRecordByEmail('_pb_users_auth_', 'mariana.silva@teslarh.com.br')
      const lucas = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')

      const countLogs = app.countRecords('log_auditoria')
      if (countLogs < 2) {
        // Log 1: Atualização cadastral prévia
        const l1 = new Record(auditCol)
        l1.set('tenant_id', teslaTenant.id)
        l1.set('user_id', rhUser.id)
        l1.set('acao', 'aprovacao_alteracao')
        l1.set('entidade', 'colaborador')
        l1.set('entidade_id', lucas.id)
        l1.set('dados_json', {
          campo: 'telefone',
          valor_antigo: '(11) 98123-0000',
          valor_novo: '(11) 98765-4321',
          responsavel: 'Mariana Silva',
          cargo: 'Especialista em Gente e Gestão',
        })
        l1.set('data_hora', '2026-04-12 11:00:00.000Z')
        app.save(l1)

        // Log 2: Publicação de comunicado
        const l2 = new Record(auditCol)
        l2.set('tenant_id', teslaTenant.id)
        l2.set('user_id', adminUser.id)
        l2.set('acao', 'publicacao_comunicado')
        l2.set('entidade', 'comunicado')
        l2.set('entidade_id', 'general')
        l2.set('dados_json', {
          titulo: 'Atualização do Calendário de Feriados e Pontes 2026',
          categoria: 'RH',
          segmentacao: 'todos',
          autor: 'Cláudio Zanutim',
        })
        l2.set('data_hora', '2026-04-08 14:35:00.000Z')
        app.save(l2)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const comunicadoCol = app.findCollectionByNameOrId('comunicado')
      const statusField = comunicadoCol.fields.getByName('status')
      if (statusField) {
        comunicadoCol.fields.remove(statusField)
        app.save(comunicadoCol)
      }
    } catch (_) {}

    try {
      const tenantCol = app.findCollectionByNameOrId('tenant')
      const f1 = tenantCol.fields.getByName('endereco')
      if (f1) tenantCol.fields.remove(f1)
      const f2 = tenantCol.fields.getByName('telefone')
      if (f2) tenantCol.fields.remove(f2)
      const f3 = tenantCol.fields.getByName('regime_tributario')
      if (f3) tenantCol.fields.remove(f3)
      app.save(tenantCol)
    } catch (_) {}

    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const ativoField = usersCol.fields.getByName('ativo')
      if (ativoField) {
        usersCol.fields.remove(ativoField)
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
