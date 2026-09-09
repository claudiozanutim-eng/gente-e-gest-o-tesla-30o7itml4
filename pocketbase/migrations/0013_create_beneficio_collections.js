migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    // 1. Coleção beneficio (id, tenant_id, tipo, descricao, created, updated)
    // tipo: 'vt', 'vr', 'va', 'plano_saude', 'seguro_vida', 'plano_odonto'
    if (!app.hasTable('beneficio')) {
      const beneficioCol = new Collection({
        name: 'beneficio',
        type: 'base',
        // RLS:
        // Leitura: Todos os colaboradores autenticados do tenant veem os benefícios disponíveis
        listRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        viewRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        // Escrita: Exclusiva para RH e Admin do tenant
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
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['vt', 'vr', 'va', 'plano_saude', 'seguro_vida', 'plano_odonto'],
            maxSelect: 1,
          },
          {
            name: 'descricao',
            type: 'text',
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
          'CREATE INDEX idx_beneficio_tenant ON beneficio (tenant_id)',
          'CREATE INDEX idx_beneficio_tipo ON beneficio (tipo)',
        ],
      })
      app.save(beneficioCol)
    }

    // 2. Coleção colaborador_beneficio (id, tenant_id, colaborador_id, beneficio_id, valor, detalhes_json, created, updated)
    if (!app.hasTable('colaborador_beneficio')) {
      const beneficioCol = app.findCollectionByNameOrId('beneficio')

      const colabBeneficioCol = new Collection({
        name: 'colaborador_beneficio',
        type: 'base',
        // RLS:
        // Colaborador vê apenas seus próprios benefícios do seu tenant
        // RH e Admin veem todos os benefícios vinculados do tenant
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        // Escrita: Exclusiva para RH e Admin do tenant
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
          {
            name: 'colaborador_id',
            type: 'relation',
            collectionId: colaboradorCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'beneficio_id',
            type: 'relation',
            collectionId: beneficioCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'valor',
            type: 'number',
            required: false,
          },
          {
            name: 'detalhes_json',
            type: 'json',
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
          'CREATE INDEX idx_colab_ben_tenant ON colaborador_beneficio (tenant_id)',
          'CREATE INDEX idx_colab_ben_colab ON colaborador_beneficio (colaborador_id)',
          'CREATE INDEX idx_colab_ben_ben ON colaborador_beneficio (beneficio_id)',
        ],
      })
      app.save(colabBeneficioCol)
    }
  },
  (app) => {
    try {
      const colabBeneficioCol = app.findCollectionByNameOrId('colaborador_beneficio')
      app.delete(colabBeneficioCol)
    } catch (_) {}

    try {
      const beneficioCol = app.findCollectionByNameOrId('beneficio')
      app.delete(beneficioCol)
    } catch (_) {}
  },
)
