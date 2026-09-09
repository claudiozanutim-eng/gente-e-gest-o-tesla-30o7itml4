migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const categoriaCol = app.findCollectionByNameOrId('categoria_documento')
    const documentoCol = app.findCollectionByNameOrId('documento')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    // 1. Obter tenant "Tesla RH Ltda"
    let tenantRecord
    try {
      tenantRecord = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')
    } catch (_) {
      try {
        const tenants = app.findRecordsByFilter('tenant', '', '-created', 1, 0)
        if (tenants.length > 0) tenantRecord = tenants[0]
      } catch (_) {}
    }

    if (!tenantRecord) return
    const tenantId = tenantRecord.id

    // 2. Obter colaborador Lucas Ferreira
    let lucasColab
    try {
      lucasColab = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')
    } catch (_) {}

    // 3. Categorias padrão
    const categoriasPadrao = [
      'Documentos Pessoais',
      'Documentos Trabalhistas',
      'Remuneração',
      'Saúde e Segurança',
    ]

    const categoriaMap = {}

    for (const catNome of categoriasPadrao) {
      let catRec
      try {
        const found = app.findRecordsByFilter(
          'categoria_documento',
          `tenant_id = "${tenantId}" && nome = "${catNome}"`,
          '-created',
          1,
          0,
        )
        if (found.length > 0) {
          catRec = found[0]
        }
      } catch (_) {}

      if (!catRec) {
        catRec = new Record(categoriaCol)
        catRec.set('tenant_id', tenantId)
        catRec.set('nome', catNome)
        app.save(catRec)
      }
      categoriaMap[catNome] = catRec.id
    }

    // 4. Documentos de exemplo
    // Helper para salvar documento de seed
    const seedDoc = (dados) => {
      try {
        const exists = app.findRecordsByFilter(
          'documento',
          `tenant_id = "${tenantId}" && nome = "${dados.nome}"`,
          '-created',
          1,
          0,
        )
        if (exists.length > 0) return exists[0]
      } catch (_) {}

      const doc = new Record(documentoCol)
      doc.set('tenant_id', tenantId)
      doc.set('categoria_id', dados.categoria_id)
      if (dados.colaborador_id) doc.set('colaborador_id', dados.colaborador_id)
      doc.set('nome', dados.nome)
      doc.set('versao', dados.versao || '1.0')
      doc.set('obrigatorio', Boolean(dados.obrigatorio))
      doc.set('data_publicacao', dados.data_publicacao || new Date().toISOString())
      if (dados.arquivo_url) doc.set('arquivo_url', dados.arquivo_url)
      app.save(doc)
      return doc
    }

    // Documento obrigatório corporativo em "Documentos Trabalhistas"
    seedDoc({
      nome: 'Manual de Conduta e Ética Profissional',
      categoria_id: categoriaMap['Documentos Trabalhistas'],
      versao: '2.0',
      obrigatorio: true,
      data_publicacao: '2024-01-15 09:00:00.000Z',
      arquivo_url: '',
    })

    // Documento corporativo em "Documentos Trabalhistas"
    seedDoc({
      nome: 'Acordo Coletivo de Trabalho 2024/2025',
      categoria_id: categoriaMap['Documentos Trabalhistas'],
      versao: '1.0',
      obrigatorio: false,
      data_publicacao: '2024-02-01 10:00:00.000Z',
      arquivo_url: '',
    })

    // Documentos em "Remuneração"
    seedDoc({
      nome: 'Política de Benefícios e Remuneração Variável',
      categoria_id: categoriaMap['Remuneração'],
      versao: '1.2',
      obrigatorio: false,
      data_publicacao: '2024-01-10 14:00:00.000Z',
      arquivo_url: '',
    })

    // Documento obrigatório em "Saúde e Segurança"
    seedDoc({
      nome: 'Guia de Ergonomia e Segurança no Trabalho (NR-17)',
      categoria_id: categoriaMap['Saúde e Segurança'],
      versao: '1.0',
      obrigatorio: true,
      data_publicacao: '2024-03-01 08:30:00.000Z',
      arquivo_url: '',
    })

    // Documentos Pessoais do colaborador Lucas Ferreira (se encontrado)
    if (lucasColab) {
      seedDoc({
        nome: 'RG e CPF - Lucas Ferreira.pdf',
        categoria_id: categoriaMap['Documentos Pessoais'],
        colaborador_id: lucasColab.id,
        versao: '1.0',
        obrigatorio: false,
        data_publicacao: '2023-03-15 11:20:00.000Z',
        arquivo_url: '',
      })

      seedDoc({
        nome: 'Comprovante de Residência - Lucas Ferreira.pdf',
        categoria_id: categoriaMap['Documentos Pessoais'],
        colaborador_id: lucasColab.id,
        versao: '1.0',
        obrigatorio: false,
        data_publicacao: '2023-03-15 11:25:00.000Z',
        arquivo_url: '',
      })

      seedDoc({
        nome: 'CNH Digital - Lucas Ferreira.pdf',
        categoria_id: categoriaMap['Documentos Pessoais'],
        colaborador_id: lucasColab.id,
        versao: '1.0',
        obrigatorio: false,
        data_publicacao: '2023-04-02 16:45:00.000Z',
        arquivo_url: '',
      })
    }
  },
  (app) => {
    // down logic if needed
  },
)
