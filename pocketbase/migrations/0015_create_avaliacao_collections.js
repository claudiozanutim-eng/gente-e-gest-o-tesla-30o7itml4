migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    // 1. Coleção ciclo_avaliacao (id, tenant_id, nome, data_inicio, data_fim, status, created, updated)
    // status: 'pendente', 'em_andamento', 'concluido'
    if (!app.hasTable('ciclo_avaliacao')) {
      const cicloCol = new Collection({
        name: 'ciclo_avaliacao',
        type: 'base',
        // RLS:
        // Todos os usuários autenticados do mesmo tenant podem ver ciclos
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
            name: 'data_inicio',
            type: 'date',
            required: true,
          },
          {
            name: 'data_fim',
            type: 'date',
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'em_andamento', 'concluido'],
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
          'CREATE INDEX idx_ciclo_tenant ON ciclo_avaliacao (tenant_id)',
          'CREATE INDEX idx_ciclo_status ON ciclo_avaliacao (status)',
        ],
      })
      app.save(cicloCol)
    }

    // 2. Coleção competencia (id, tenant_id, nome, tipo, peso, created, updated)
    // tipo: 'geral' (aplicável a todos) ou 'especifica' (por cargo/departamento)
    if (!app.hasTable('competencia')) {
      const compCol = new Collection({
        name: 'competencia',
        type: 'base',
        // RLS: Leitura para todos do tenant; RH/Admin criam e editam
        listRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        viewRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
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
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['geral', 'especifica'],
            maxSelect: 1,
          },
          {
            name: 'peso',
            type: 'number',
            required: false,
          },
          {
            name: 'descricao',
            type: 'text',
            required: false,
          },
          {
            name: 'nota_esperada',
            type: 'number',
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
          'CREATE INDEX idx_comp_tenant ON competencia (tenant_id)',
          'CREATE INDEX idx_comp_tipo ON competencia (tipo)',
        ],
      })
      app.save(compCol)
    }

    // 3. Coleção avaliacao (id, ciclo_id, colaborador_id, avaliador_id, tipo_avaliador, peso, status, feedback, created, updated)
    // tipo_avaliador: 'principal' ou 'apoio'
    if (!app.hasTable('avaliacao')) {
      const cicloCol = app.findCollectionByNameOrId('ciclo_avaliacao')

      const avalCol = new Collection({
        name: 'avaliacao',
        type: 'base',
        // RLS:
        // Colaborador vê suas próprias avaliações (quando concluídas ou em que ele é colaborador_id)
        // Avaliador (gestor/apoio) vê avaliações em que é avaliador_id
        // RH e Admin veem todas do tenant
        listRule:
          "@request.auth.id != '' && ciclo_id.tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || avaliador_id.user_id = @request.auth.id || colaborador_id.user_id = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && ciclo_id.tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || avaliador_id.user_id = @request.auth.id || colaborador_id.user_id = @request.auth.id)",
        createRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || avaliador_id.user_id = @request.auth.id)",
        updateRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || avaliador_id.user_id = @request.auth.id)",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
        fields: [
          {
            name: 'ciclo_id',
            type: 'relation',
            collectionId: cicloCol.id,
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
            name: 'avaliador_id',
            type: 'relation',
            collectionId: colaboradorCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'tipo_avaliador',
            type: 'select',
            required: true,
            values: ['principal', 'apoio'],
            maxSelect: 1,
          },
          {
            name: 'peso',
            type: 'number',
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'concluida'],
            maxSelect: 1,
          },
          {
            name: 'comentario',
            type: 'text',
            required: false,
          },
          {
            name: 'nota_final',
            type: 'number',
            required: false,
          },
          {
            name: 'data_avaliacao',
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
          'CREATE INDEX idx_aval_ciclo ON avaliacao (ciclo_id)',
          'CREATE INDEX idx_aval_colab ON avaliacao (colaborador_id)',
          'CREATE INDEX idx_aval_avaliador ON avaliacao (avaliador_id)',
          'CREATE INDEX idx_aval_status ON avaliacao (status)',
        ],
      })
      app.save(avalCol)
    }

    // 4. Coleção nota_competencia (id, avaliacao_id, competencia_id, nota, comentario, created, updated)
    // nota em escala de 1 a 5 com uma casa decimal (ex.: 3.5)
    if (!app.hasTable('nota_competencia')) {
      const avalCol = app.findCollectionByNameOrId('avaliacao')
      const compCol = app.findCollectionByNameOrId('competencia')

      const notaCol = new Collection({
        name: 'nota_competencia',
        type: 'base',
        // RLS:
        // Colaborador visualiza notas de suas avaliações
        // Avaliador visualiza e atualiza notas das avaliações que ele conduz
        // RH e Admin visualizam e gerenciam todas
        listRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || avaliacao_id.avaliador_id.user_id = @request.auth.id || avaliacao_id.colaborador_id.user_id = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || avaliacao_id.avaliador_id.user_id = @request.auth.id || avaliacao_id.colaborador_id.user_id = @request.auth.id)",
        createRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || avaliacao_id.avaliador_id.user_id = @request.auth.id)",
        updateRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || avaliacao_id.avaliador_id.user_id = @request.auth.id)",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || avaliacao_id.avaliador_id.user_id = @request.auth.id)",
        fields: [
          {
            name: 'avaliacao_id',
            type: 'relation',
            collectionId: avalCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'competencia_id',
            type: 'relation',
            collectionId: compCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'nota',
            type: 'number',
            required: true,
            min: 1,
            max: 5,
          },
          {
            name: 'comentario',
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
          'CREATE INDEX idx_nota_aval ON nota_competencia (avaliacao_id)',
          'CREATE INDEX idx_nota_comp ON nota_competencia (competencia_id)',
        ],
      })
      app.save(notaCol)
    }
  },
  (app) => {
    try {
      const notaCol = app.findCollectionByNameOrId('nota_competencia')
      app.delete(notaCol)
    } catch (_) {}

    try {
      const avalCol = app.findCollectionByNameOrId('avaliacao')
      app.delete(avalCol)
    } catch (_) {}

    try {
      const compCol = app.findCollectionByNameOrId('competencia')
      app.delete(compCol)
    } catch (_) {}

    try {
      const cicloCol = app.findCollectionByNameOrId('ciclo_avaliacao')
      app.delete(cicloCol)
    } catch (_) {}
  },
)
