migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const comunicadoCol = app.findCollectionByNameOrId('comunicado')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Adicionar campos 'fixado' e 'exige_confirmacao' à coleção comunicado (se não existirem)
    let modified = false
    if (!comunicadoCol.fields.getByName('fixado')) {
      comunicadoCol.fields.add(
        new BoolField({
          name: 'fixado',
          required: false,
        }),
      )
      modified = true
    }

    if (!comunicadoCol.fields.getByName('exige_confirmacao')) {
      comunicadoCol.fields.add(
        new BoolField({
          name: 'exige_confirmacao',
          required: false,
        }),
      )
      modified = true
    }

    if (modified) {
      app.save(comunicadoCol)
    }

    // 2. Criar coleção comunicado_leitura para controle de confirmações de leitura
    if (!app.hasTable('comunicado_leitura')) {
      const leituraCol = new Collection({
        name: 'comunicado_leitura',
        type: 'base',
        // Visualização e listagem: usuários autenticados do mesmo tenant
        listRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        viewRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        // Criação: usuário só pode confirmar por si mesmo no seu tenant
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && usuario_id = @request.auth.id",
        // Atualização: superuser ou ninguém (confirmação é imutável)
        updateRule: null,
        // Exclusão: rh, admin_rh, admin ou o próprio usuário
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'rh' || usuario_id = @request.auth.id)",
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
            name: 'comunicado_id',
            type: 'relation',
            collectionId: comunicadoCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'usuario_id',
            type: 'relation',
            collectionId: usersCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'lido_em',
            type: 'date',
            required: false,
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
          'CREATE INDEX idx_comun_leit_tenant ON comunicado_leitura (tenant_id)',
          'CREATE INDEX idx_comun_leit_comunicado ON comunicado_leitura (comunicado_id)',
          'CREATE INDEX idx_comun_leit_usuario ON comunicado_leitura (usuario_id)',
          'CREATE UNIQUE INDEX idx_comun_leit_unique ON comunicado_leitura (comunicado_id, usuario_id)',
        ],
      })
      app.save(leituraCol)
    }
  },
  (app) => {
    try {
      const leituraCol = app.findCollectionByNameOrId('comunicado_leitura')
      app.delete(leituraCol)
    } catch (_) {}

    try {
      const comunicadoCol = app.findCollectionByNameOrId('comunicado')
      const fixadoField = comunicadoCol.fields.getByName('fixado')
      if (fixadoField) {
        comunicadoCol.fields.removeByName('fixado')
      }
      const exigeField = comunicadoCol.fields.getByName('exige_confirmacao')
      if (exigeField) {
        comunicadoCol.fields.removeByName('exige_confirmacao')
      }
      app.save(comunicadoCol)
    } catch (_) {}
  },
)
