migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!app.hasTable('onboarding_gestor')) {
      const onboardingCol = new Collection({
        name: 'onboarding_gestor',
        type: 'base',
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          'gestor_user_id = @request.auth.id || ' +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin'" +
          ')',
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          'gestor_user_id = @request.auth.id || ' +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin'" +
          ')',
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          'gestor_user_id = @request.auth.id || ' +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin'" +
          ')',
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          'gestor_user_id = @request.auth.id || ' +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin'" +
          ')',
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin'" +
          ')',
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
            name: 'gestor_user_id',
            type: 'relation',
            collectionId: usersCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'etapa',
            type: 'number',
            required: true,
            min: 1,
            max: 5,
          },
          {
            name: 'concluida',
            type: 'bool',
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
          'CREATE INDEX idx_onboarding_tenant ON onboarding_gestor (tenant_id)',
          'CREATE INDEX idx_onboarding_gestor_user ON onboarding_gestor (gestor_user_id)',
          'CREATE UNIQUE INDEX idx_onboarding_gestor_etapa ON onboarding_gestor (gestor_user_id, etapa)',
        ],
      })
      app.save(onboardingCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('onboarding_gestor')
      app.delete(col)
    } catch (_) {}
  },
)
