migrate(
  (app) => {
    const lucas = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')
    const tenantId = lucas.get('tenant_id')
    const dependenteCol = app.findCollectionByNameOrId('dependente')
    const contatoCol = app.findCollectionByNameOrId('contato_emergencia')
    const solicitacaoCol = app.findCollectionByNameOrId('solicitacao_alteracao')

    // Seed dependentes para Lucas
    try {
      app.findFirstRecordByData('dependente', 'nome', 'Beatriz Ferreira dos Santos')
    } catch (_) {
      const dep1 = new Record(dependenteCol)
      dep1.set('colaborador_id', lucas.id)
      dep1.set('tenant_id', tenantId)
      dep1.set('nome', 'Beatriz Ferreira dos Santos')
      dep1.set('parentesco', 'Filha')
      dep1.set('data_nascimento', '2019-05-14 00:00:00.000Z')
      app.save(dep1)
    }

    try {
      app.findFirstRecordByData('dependente', 'nome', 'Camila Rocha dos Santos')
    } catch (_) {
      const dep2 = new Record(dependenteCol)
      dep2.set('colaborador_id', lucas.id)
      dep2.set('tenant_id', tenantId)
      dep2.set('nome', 'Camila Rocha dos Santos')
      dep2.set('parentesco', 'Cônjuge')
      dep2.set('data_nascimento', '1995-11-03 00:00:00.000Z')
      app.save(dep2)
    }

    // Seed contato de emergência para Lucas
    try {
      app.findFirstRecordByData('contato_emergencia', 'nome', 'Camila Rocha dos Santos')
    } catch (_) {
      const contato1 = new Record(contatoCol)
      contato1.set('colaborador_id', lucas.id)
      contato1.set('tenant_id', tenantId)
      contato1.set('nome', 'Camila Rocha dos Santos')
      contato1.set('telefone', '(11) 97654-3210')
      contato1.set('parentesco', 'Esposa')
      app.save(contato1)
    }

    // Seed solicitação de alteração pendente de demonstração
    try {
      app.findFirstRecordByData('solicitacao_alteracao', 'campo', 'Telefone')
    } catch (_) {
      const solic = new Record(solicitacaoCol)
      solic.set('colaborador_id', lucas.id)
      solic.set('tenant_id', tenantId)
      solic.set('campo', 'Telefone')
      solic.set('valor_antigo', '(11) 98123-0000')
      solic.set('valor_novo', '(11) 98765-4321')
      solic.set('status', 'pendente')
      solic.set('data_solicitacao', '2026-04-12 10:30:00.000Z')
      app.save(solic)
    }
  },
  (app) => {
    // down logic
  },
)
