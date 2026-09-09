migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    // 1. Criar coleção categoria_documento
    const categoriaCol = new Collection({
      name: 'categoria_documento',
      type: 'base',
      // List/view: usuários autenticados do mesmo tenant
      listRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
      viewRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
      // Create/update/delete: rh ou admin do mesmo tenant
      createRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
      updateRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
      deleteRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          collectionId: tenantCol.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_categoria_doc_tenant ON categoria_documento (tenant_id)',
        'CREATE INDEX idx_categoria_doc_nome ON categoria_documento (nome)',
      ],
    })
    app.save(categoriaCol)

    // 2. Criar coleção documento
    // Regras de acesso:
    // list/view: mesmo tenant && (obrigatorio = true || colaborador_id = '' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')
    // create: mesmo tenant && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)
    // update: mesmo tenant && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)
    // delete: mesmo tenant && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')
    const docCol = new Collection({
      name: 'documento',
      type: 'base',
      listRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id = '' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
      viewRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id = '' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
      createRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
      updateRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
      deleteRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          collectionId: tenantCol.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'categoria_id',
          type: 'relation',
          collectionId: categoriaCol.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'colaborador_id',
          type: 'relation',
          collectionId: colaboradorCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'versao', type: 'text' },
        {
          name: 'arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        },
        { name: 'arquivo_url', type: 'text' },
        { name: 'data_publicacao', type: 'date' },
        { name: 'obrigatorio', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_doc_tenant ON documento (tenant_id)',
        'CREATE INDEX idx_doc_categoria ON documento (categoria_id)',
        'CREATE INDEX idx_doc_colaborador ON documento (colaborador_id)',
        'CREATE INDEX idx_doc_obrigatorio ON documento (obrigatorio)',
      ],
    })
    app.save(docCol)
  },
  (app) => {
    try {
      const docCol = app.findCollectionByNameOrId('documento')
      app.delete(docCol)
    } catch (_) {}
    try {
      const catCol = app.findCollectionByNameOrId('categoria_documento')
      app.delete(catCol)
    } catch (_) {}
  },
)
