migrate(
  (app) => {
    const colabCol = app.findCollectionByNameOrId('colaborador')
    const tenantCol = app.findCollectionByNameOrId('tenant')

    // Buscar tenant padrão da Tesla
    let tenantRecord = null
    try {
      tenantRecord = app.findFirstRecordByData('tenant', 'cnpj', '43.494.615/0001-24')
    } catch (_) {
      try {
        const tenants = app.findRecordsByFilter('tenant', '', 'created', 1, 0)
        if (tenants.length > 0) tenantRecord = tenants[0]
      } catch (_) {}
    }

    if (!tenantRecord) return

    // Verificar se Alex Oliveira já existe
    try {
      app.findFirstRecordByData('colaborador', 'cpf', '384.512.988-04')
      return // Já existe
    } catch (_) {}

    try {
      app.findFirstRecordByData('colaborador', 'nome', 'Alex Oliveira')
      return // Já existe
    } catch (_) {}

    const colab = new Record(colabCol)
    colab.set('tenant_id', tenantRecord.id)
    colab.set('nome', 'Alex Oliveira')
    colab.set('nome_completo', 'Alex Ornelles de Oliveira')
    colab.set('cpf', '384.512.988-04')
    colab.set('cargo', 'Supervisor(a) de Expedição')
    colab.set('departamento', 'Expedição')
    colab.set('data_admissao', '2024-10-03 00:00:00.000Z')
    colab.set('status', 'ativo')
    colab.set('email', 'alex.oliveira@teslarh.com.br')
    colab.set('local_trabalho', 'Matriz - São Paulo')
    colab.set('jornada', '44h/semana')

    app.save(colab)
  },
  (app) => {
    try {
      const colab = app.findFirstRecordByData('colaborador', 'cpf', '384.512.988-04')
      app.delete(colab)
    } catch (_) {}
  },
)
