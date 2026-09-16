migrate(
  (app) => {
    // Obter referências das coleções relacionadas
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const tenantCol = app.findCollectionByNameOrId('tenant')

    // Criar a coleção permissao_usuario
    // Regras de acesso isoladas por tenant:
    // list/view: membros autenticados do tenant que sejam admin_rh ou admin, ou o próprio usuário para carregar suas próprias permissões
    // create/update/delete: admin_rh ou admin do tenant
    const collection = new Collection({
      name: 'permissao_usuario',
      type: 'base',
      listRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (user_id = @request.auth.id || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
      viewRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (user_id = @request.auth.id || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
      createRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
      updateRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
      deleteRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: usersCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'flags_json',
          type: 'json',
          required: false,
          maxSize: 524288,
        },
        {
          name: 'atualizado_por',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          maxSelect: 1,
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
        'CREATE UNIQUE INDEX idx_perm_user_tenant ON permissao_usuario (tenant_id, user_id)',
        'CREATE INDEX idx_perm_user_user ON permissao_usuario (user_id)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('permissao_usuario')
      app.delete(collection)
    } catch (_) {}
  },
)
