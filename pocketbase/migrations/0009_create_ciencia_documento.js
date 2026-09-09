migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const documentoCol = app.findCollectionByNameOrId('documento')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    // Criar coleção ciencia_documento
    // RLS:
    // list/view: mesmo tenant && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')
    // create: mesmo tenant && (@request.auth.id != '' && colaborador_id.user_id = @request.auth.id)
    // update: rh/admin do mesmo tenant (ou colaborador próprio)
    // delete: rh/admin do mesmo tenant
    const cienciaCol = new Collection({
      name: 'ciencia_documento',
      type: 'base',
      listRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
      viewRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
      createRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && colaborador_id.user_id = @request.auth.id",
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
          name: 'documento_id',
          type: 'relation',
          collectionId: documentoCol.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'colaborador_id',
          type: 'relation',
          collectionId: colaboradorCol.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'versao_ciente', type: 'text' },
        { name: 'data_hora', type: 'date' },
        { name: 'ip_origem', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ciencia_tenant ON ciencia_documento (tenant_id)',
        'CREATE INDEX idx_ciencia_documento ON ciencia_documento (documento_id)',
        'CREATE INDEX idx_ciencia_colaborador ON ciencia_documento (colaborador_id)',
        'CREATE INDEX idx_ciencia_doc_colab ON ciencia_documento (documento_id, colaborador_id)',
      ],
    })

    app.save(cienciaCol)
  },
  (app) => {
    try {
      const cienciaCol = app.findCollectionByNameOrId('ciencia_documento')
      app.delete(cienciaCol)
    } catch (_) {}
  },
)
