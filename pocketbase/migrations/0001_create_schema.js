migrate(
  (app) => {
    // 1. Update _pb_users_auth_ to add perfil and tenant relation
    // Wait, let's first create tenant collection, then add fields to users
    const tenantCol = new Collection({
      name: 'tenant',
      type: 'base',
      listRule: "@request.auth.id != '' && @request.auth.tenant_id = id",
      viewRule: "@request.auth.id != '' && @request.auth.tenant_id = id",
      createRule: null, // created by setup/seeds or superuser
      updateRule:
        "@request.auth.id != '' && @request.auth.tenant_id = id && @request.auth.perfil = 'admin'",
      deleteRule: null,
      fields: [
        { name: 'razao_social', type: 'text', required: true },
        { name: 'cnpj', type: 'text', required: true },
        {
          name: 'plano',
          type: 'select',
          required: true,
          values: ['basico', 'pro', 'enterprise'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'inativo', 'suspenso'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_tenant_cnpj ON tenant (cnpj)',
        'CREATE INDEX idx_tenant_status ON tenant (status)',
      ],
    })
    app.save(tenantCol)

    // 2. Add tenant_id and perfil to users collection (_pb_users_auth_)
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const tenantId = tenantCol.id

    if (!usersCol.fields.getByName('tenant_id')) {
      usersCol.fields.add(
        new RelationField({
          name: 'tenant_id',
          collectionId: tenantId,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }

    if (!usersCol.fields.getByName('perfil')) {
      usersCol.fields.add(
        new SelectField({
          name: 'perfil',
          required: true,
          values: ['colaborador', 'gestor', 'rh', 'admin'],
          maxSelect: 1,
        }),
      )
    }

    // Update users access rules:
    // - list: auth users in the same tenant
    // - view: auth users in the same tenant or self
    // - update: admin of the same tenant OR self
    usersCol.listRule = "@request.auth.id != '' && tenant_id = @request.auth.tenant_id"
    usersCol.viewRule =
      "@request.auth.id != '' && (tenant_id = @request.auth.tenant_id || id = @request.auth.id)"
    usersCol.updateRule =
      "@request.auth.id != '' && ((tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin') || id = @request.auth.id)"
    usersCol.createRule = "@request.auth.id != '' && @request.auth.perfil = 'admin'"
    usersCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'"

    app.save(usersCol)

    // 3. Create colaborador collection
    const colaboradorCol = new Collection({
      name: 'colaborador',
      type: 'base',
      // SELECT: tenant_id equals auth tenant_id
      listRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
      viewRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
      // INSERT: rh or admin of same tenant
      createRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
      // UPDATE: rh or admin of same tenant, or collaborator updating their own record
      updateRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || user_id = @request.auth.id)",
      // DELETE: rh or admin of same tenant
      deleteRule:
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'tenant_id',
          type: 'relation',
          collectionId: tenantId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'cpf', type: 'text', required: true },
        { name: 'cargo', type: 'text' },
        { name: 'departamento', type: 'text' },
        { name: 'data_admissao', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'inativo'],
          maxSelect: 1,
        },
        { name: 'foto_url', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_colaborador_cpf ON colaborador (cpf)',
        'CREATE INDEX idx_colaborador_tenant ON colaborador (tenant_id)',
        'CREATE INDEX idx_colaborador_status ON colaborador (status)',
        'CREATE INDEX idx_colaborador_depto ON colaborador (departamento)',
      ],
    })
    app.save(colaboradorCol)
  },
  (app) => {
    try {
      const colab = app.findCollectionByNameOrId('colaborador')
      app.delete(colab)
    } catch (_) {}
    try {
      const tenant = app.findCollectionByNameOrId('tenant')
      app.delete(tenant)
    } catch (_) {}
  },
)
