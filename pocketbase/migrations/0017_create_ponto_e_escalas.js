migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    // 1. Coleção escala_trabalho
    // (id, tenant_id, nome, horario_inicio, horario_fim, dias_semana)
    if (!app.hasTable('escala_trabalho')) {
      const escalaCol = new Collection({
        name: 'escala_trabalho',
        type: 'base',
        // RLS:
        // Leitura para todos os usuários autenticados do mesmo tenant
        listRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        viewRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        // Escrita: Exclusiva para RH e Admin
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
            name: 'nome',
            type: 'text',
            required: true,
          },
          {
            name: 'horario_inicio',
            type: 'text',
            required: true,
          },
          {
            name: 'horario_fim',
            type: 'text',
            required: true,
          },
          {
            name: 'dias_semana',
            type: 'text',
            required: true,
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
          'CREATE INDEX idx_escala_tenant ON escala_trabalho (tenant_id)',
          'CREATE INDEX idx_escala_nome ON escala_trabalho (nome)',
        ],
      })
      app.save(escalaCol)
    }

    // 2. Coleção colaborador_escala
    // (id, tenant_id, colaborador_id, escala_id, data_inicio, data_fim)
    if (!app.hasTable('colaborador_escala')) {
      const escalaCol = app.findCollectionByNameOrId('escala_trabalho')

      const colabEscalaCol = new Collection({
        name: 'colaborador_escala',
        type: 'base',
        // RLS:
        // Leitura para usuários do mesmo tenant (colaborador vê o seu, gestor vê o de sua equipe, rh/admin veem todos)
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'gestor')",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'gestor')",
        // Escrita: Exclusiva para RH e Admin
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
            name: 'escala_id',
            type: 'relation',
            collectionId: escalaCol.id,
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
            name: 'data_fim',
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
          'CREATE INDEX idx_colab_escala_tenant ON colaborador_escala (tenant_id)',
          'CREATE INDEX idx_colab_escala_colab ON colaborador_escala (colaborador_id)',
          'CREATE INDEX idx_colab_escala_escala ON colaborador_escala (escala_id)',
        ],
      })
      app.save(colabEscalaCol)
    }

    // 3. Coleção registro_ponto
    // (id, tenant_id, colaborador_id, data_hora, tipo)
    // tipo: 'entrada', 'saida_almoco', 'volta_almoco', 'saida'
    if (!app.hasTable('registro_ponto')) {
      const pontoCol = new Collection({
        name: 'registro_ponto',
        type: 'base',
        // RLS:
        // Colaborador vê apenas seu ponto (colaborador_id.user_id = @request.auth.id)
        // Gestor vê ponto da sua equipe (gestor no mesmo tenant, equipe filtrada por departamento ou direto)
        // RH e Admin veem todos do tenant
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'gestor')",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'gestor')",
        // Criação de registro: Colaborador bate seu próprio ponto (ou RH/Admin podem registrar)
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
        // Atualização e Exclusão: Apenas RH e Admin
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
            name: 'data_hora',
            type: 'date',
            required: true,
          },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['entrada', 'saida_almoco', 'volta_almoco', 'saida'],
            maxSelect: 1,
          },
          {
            name: 'origem',
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
          'CREATE INDEX idx_ponto_tenant ON registro_ponto (tenant_id)',
          'CREATE INDEX idx_ponto_colab ON registro_ponto (colaborador_id)',
          'CREATE INDEX idx_ponto_data_hora ON registro_ponto (data_hora)',
          'CREATE INDEX idx_ponto_tipo ON registro_ponto (tipo)',
        ],
      })
      app.save(pontoCol)
    }
  },
  (app) => {
    try {
      const pontoCol = app.findCollectionByNameOrId('registro_ponto')
      app.delete(pontoCol)
    } catch (_) {}

    try {
      const colabEscalaCol = app.findCollectionByNameOrId('colaborador_escala')
      app.delete(colabEscalaCol)
    } catch (_) {}

    try {
      const escalaCol = app.findCollectionByNameOrId('escala_trabalho')
      app.delete(escalaCol)
    } catch (_) {}
  },
)
