migrate(
  (app) => {
    // 1. Obter colaborador Lucas Ferreira
    let lucasColab
    try {
      lucasColab = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')
    } catch (_) {}

    if (!lucasColab) return
    const tenantId = lucasColab.getString('tenant_id')

    // 2. Obter documento "Guia de Ergonomia e Segurança no Trabalho (NR-17)"
    let docErgonomia
    try {
      const docs = app.findRecordsByFilter(
        'documento',
        `tenant_id = "${tenantId}" && nome ~ "Ergonomia"`,
        '-created',
        1,
        0,
      )
      if (docs.length > 0) docErgonomia = docs[0]
    } catch (_) {}

    if (!docErgonomia) return

    // 3. Verificar se já existe ciência para o Lucas neste documento
    const cienciaCol = app.findCollectionByNameOrId('ciencia_documento')
    try {
      const existentes = app.findRecordsByFilter(
        'ciencia_documento',
        `documento_id = "${docErgonomia.id}" && colaborador_id = "${lucasColab.id}"`,
        '-created',
        1,
        0,
      )
      if (existentes.length > 0) return
    } catch (_) {}

    // 4. Criar registro de ciência de demonstração
    const ciencia = new Record(cienciaCol)
    ciencia.set('tenant_id', tenantId)
    ciencia.set('documento_id', docErgonomia.id)
    ciencia.set('colaborador_id', lucasColab.id)
    ciencia.set('versao_ciente', docErgonomia.getString('versao') || '1.0')
    ciencia.set('data_hora', '2024-03-05 14:32:00.000Z')
    ciencia.set('ip_origem', '187.54.120.45')
    app.save(ciencia)
  },
  (app) => {
    // down logic if needed
  },
)
