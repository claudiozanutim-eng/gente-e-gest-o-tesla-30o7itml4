migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    // 1. Tabela lancamento_periodico
    // (id, tenant_id, colaborador_id, descritivo, quantidade, periodicidade, data_recorrencia, data_inicio_vigencia, data_fim_vigencia)
    // - quantidade: valor em reais (decimal)
    // - periodicidade: 'mensal', 'quinzenal', 'semanal'
    // - data_recorrencia: dia do mês em que o lançamento se repete (ex: 5 = todo dia 5)
    // - vigência: período de validade (início obrigatório, fim opcional)
    if (!app.hasTable('lancamento_periodico')) {
      const lancamentoPeriodicoCol = new Collection({
        name: 'lancamento_periodico',
        type: 'base',
        // RLS:
        // Colaborador vê apenas seus lançamentos; RH e Admin veem todos do tenant
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        // Escrita exclusiva para RH e Admin do mesmo tenant
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
            name: 'descritivo',
            type: 'text',
            required: true,
          },
          {
            name: 'quantidade',
            type: 'number',
            required: true,
          },
          {
            name: 'periodicidade',
            type: 'select',
            required: true,
            values: ['mensal', 'quinzenal', 'semanal'],
            maxSelect: 1,
          },
          {
            name: 'data_recorrencia',
            type: 'number',
            required: true,
            min: 1,
            max: 31,
            onlyInt: true,
          },
          {
            name: 'data_inicio_vigencia',
            type: 'date',
            required: true,
          },
          {
            name: 'data_fim_vigencia',
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
          'CREATE INDEX idx_lanc_per_tenant ON lancamento_periodico (tenant_id)',
          'CREATE INDEX idx_lanc_per_colab ON lancamento_periodico (colaborador_id)',
          'CREATE INDEX idx_lanc_per_vig_ini ON lancamento_periodico (data_inicio_vigencia)',
          'CREATE INDEX idx_lanc_per_vig_fim ON lancamento_periodico (data_fim_vigencia)',
        ],
      })
      app.save(lancamentoPeriodicoCol)
    }

    // 2. Tabela lancamento_pontual
    // (id, tenant_id, colaborador_id, descritivo, quantidade, data, comentario)
    // - quantidade: em reais, pode ser positivo (= provento) ou negativo (= desconto)
    if (!app.hasTable('lancamento_pontual')) {
      const lancamentoPontualCol = new Collection({
        name: 'lancamento_pontual',
        type: 'base',
        // RLS:
        // Colaborador vê apenas seus lançamentos; RH e Admin veem todos do tenant
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        // Escrita exclusiva para RH e Admin do mesmo tenant
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
            name: 'descritivo',
            type: 'text',
            required: true,
          },
          {
            name: 'quantidade',
            type: 'number',
            required: true,
          },
          {
            name: 'data',
            type: 'date',
            required: true,
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
          'CREATE INDEX idx_lanc_pont_tenant ON lancamento_pontual (tenant_id)',
          'CREATE INDEX idx_lanc_pont_colab ON lancamento_pontual (colaborador_id)',
          'CREATE INDEX idx_lanc_pont_data ON lancamento_pontual (data)',
        ],
      })
      app.save(lancamentoPontualCol)
    }
  },
  (app) => {
    try {
      const lancamentoPontualCol = app.findCollectionByNameOrId('lancamento_pontual')
      app.delete(lancamentoPontualCol)
    } catch (_) {}

    try {
      const lancamentoPeriodicoCol = app.findCollectionByNameOrId('lancamento_periodico')
      app.delete(lancamentoPeriodicoCol)
    } catch (_) {}
  },
)
