migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    if (!app.hasTable('atestado')) {
      const atestadoCol = new Collection({
        name: 'atestado',
        type: 'base',
        // RLS:
        // Colaborador cria e vê APENAS os próprios atestados do seu tenant
        // RH e admin do tenant veem e editam todos os atestados do tenant
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
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
            name: 'colaborador_id',
            type: 'relation',
            collectionId: colaboradorCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'data_inicio',
            type: 'date',
            required: true,
          },
          {
            name: 'qtd_dias',
            type: 'number',
            required: true,
            min: 1,
            onlyInt: true,
          },
          {
            name: 'anexo',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760, // 10MB
            mimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
          },
          {
            name: 'anexo_url',
            type: 'text',
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['recebido', 'em_analise', 'validado', 'necessita_correcao'],
            maxSelect: 1,
          },
          {
            name: 'comentario_rh',
            type: 'text',
          },
          {
            name: 'data_envio',
            type: 'date',
          },
          {
            name: 'data_resposta',
            type: 'date',
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_atestado_tenant ON atestado (tenant_id)',
          'CREATE INDEX idx_atestado_colab ON atestado (colaborador_id)',
          'CREATE INDEX idx_atestado_status ON atestado (status)',
          'CREATE INDEX idx_atestado_data_envio ON atestado (data_envio)',
        ],
      })
      app.save(atestadoCol)
    }
  },
  (app) => {
    try {
      const atestadoCol = app.findCollectionByNameOrId('atestado')
      app.delete(atestadoCol)
    } catch (_) {}
  },
)
