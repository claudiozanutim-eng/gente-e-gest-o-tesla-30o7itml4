migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Coleção meta_cobertura_departamento
    // Regras: leitura para todos da empresa (autenticado do mesmo tenant),
    // escrita apenas rh, admin_rh e admin.
    if (!app.hasTable('meta_cobertura_departamento')) {
      const metaCobCol = new Collection({
        name: 'meta_cobertura_departamento',
        type: 'base',
        listRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        viewRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
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
            name: 'departamento',
            type: 'text',
            required: true,
          },
          {
            name: 'meta_percentual',
            type: 'number',
            required: true,
            min: 0,
            max: 100,
          },
          {
            name: 'atualizado_por',
            type: 'relation',
            collectionId: usersCol.id,
            required: false,
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
          'CREATE INDEX idx_meta_cob_tenant ON meta_cobertura_departamento (tenant_id)',
          'CREATE INDEX idx_meta_cob_depto ON meta_cobertura_departamento (departamento)',
          'CREATE UNIQUE INDEX idx_meta_cob_tenant_depto ON meta_cobertura_departamento (tenant_id, departamento)',
        ],
      })
      app.save(metaCobCol)
    }

    // 2. Coleção orcamento_folha
    // Regras: leitura e escrita para admin_rh e admin do mesmo tenant
    if (!app.hasTable('orcamento_folha')) {
      const orcamentoCol = new Collection({
        name: 'orcamento_folha',
        type: 'base',
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
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
            name: 'ano',
            type: 'number',
            required: true,
            min: 2000,
            max: 2100,
          },
          {
            name: 'mes',
            type: 'number',
            required: true,
            min: 1,
            max: 12,
          },
          {
            name: 'competencia',
            type: 'text',
            required: true, // ex: "2026-09"
          },
          {
            name: 'valor_orcado_folha',
            type: 'number',
            required: true,
            min: 0,
          },
          {
            name: 'valor_orcado_banco_horas',
            type: 'number',
            required: false,
            min: 0,
          },
          {
            name: 'observacao',
            type: 'text',
            required: false,
          },
          {
            name: 'criado_por',
            type: 'relation',
            collectionId: usersCol.id,
            required: false,
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
          'CREATE INDEX idx_orcamento_tenant ON orcamento_folha (tenant_id)',
          'CREATE INDEX idx_orcamento_comp ON orcamento_folha (competencia)',
          'CREATE UNIQUE INDEX idx_orcamento_tenant_comp ON orcamento_folha (tenant_id, competencia)',
        ],
      })
      app.save(orcamentoCol)
    }

    // 3. Seeder de exemplo para tenant existente
    try {
      const tenants = app.findRecordsByFilter('tenant', "status = 'ativo'", 'created', 1, 0)
      if (tenants && tenants.length > 0) {
        const tenantId = tenants[0].id
        const metaCobCol = app.findCollectionByNameOrId('meta_cobertura_departamento')
        const orcCol = app.findCollectionByNameOrId('orcamento_folha')

        // Metas default: Marketing 70%, Recursos Humanos 75%, Financeiro 80%, TI 70%
        const metasIniciais = [
          { depto: 'Marketing', meta: 70 },
          { depto: 'Recursos Humanos', meta: 75 },
          { depto: 'Financeiro', meta: 80 },
          { depto: 'TI', meta: 70 },
        ]

        for (const item of metasIniciais) {
          try {
            app.findFirstRecordByData('meta_cobertura_departamento', 'departamento', item.depto)
          } catch (_) {
            const rec = new Record(metaCobCol)
            rec.set('tenant_id', tenantId)
            rec.set('departamento', item.depto)
            rec.set('meta_percentual', item.meta)
            app.save(rec)
          }
        }

        // Orçamentos para os meses ao redor do ano atual (2026/2027)
        const orcamentosIniciais = [
          { ano: 2026, mes: 7, valor: 45000, banco: 0 },
          { ano: 2026, mes: 8, valor: 45000, banco: 0 },
          { ano: 2026, mes: 9, valor: 48000, banco: 500 },
          { ano: 2026, mes: 10, valor: 48000, banco: 500 },
          { ano: 2026, mes: 11, valor: 50000, banco: 800 },
          { ano: 2026, mes: 12, valor: 65000, banco: 1000 },
        ]

        for (const o of orcamentosIniciais) {
          const comp = `${o.ano}-${String(o.mes).padStart(2, '0')}`
          try {
            app.findFirstRecordByData('orcamento_folha', 'competencia', comp)
          } catch (_) {
            const rec = new Record(orcCol)
            rec.set('tenant_id', tenantId)
            rec.set('ano', o.ano)
            rec.set('mes', o.mes)
            rec.set('competencia', comp)
            rec.set('valor_orcado_folha', o.valor)
            rec.set('valor_orcado_banco_horas', o.banco)
            rec.set('observacao', 'Orçamento planejado no ciclo anual da diretoria.')
            app.save(rec)
          }
        }
      }
    } catch (e) {
      console.log('Aviso ao semear metas de cobertura ou orçamentos:', e)
    }
  },
  (app) => {
    try {
      const orcCol = app.findCollectionByNameOrId('orcamento_folha')
      app.delete(orcCol)
    } catch (_) {}

    try {
      const metaCobCol = app.findCollectionByNameOrId('meta_cobertura_departamento')
      app.delete(metaCobCol)
    } catch (_) {}
  },
)
