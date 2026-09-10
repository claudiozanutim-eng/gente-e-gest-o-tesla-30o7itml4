migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const escalaCol = app.findCollectionByNameOrId('escala_trabalho')

    // 1. Coleção smtp_config
    // Regras: apenas admin do tenant lê/escreve
    if (!app.hasTable('smtp_config')) {
      const smtpCol = new Collection({
        name: 'smtp_config',
        type: 'base',
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'",
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'",
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'",
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'",
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
            name: 'host',
            type: 'text',
            required: true,
          },
          {
            name: 'porta',
            type: 'number',
            required: true,
          },
          {
            name: 'usuario',
            type: 'text',
            required: false,
          },
          {
            name: 'senha',
            type: 'text',
            required: false,
          },
          {
            name: 'remetente_nome',
            type: 'text',
            required: true,
          },
          {
            name: 'remetente_email',
            type: 'text',
            required: true,
          },
          {
            name: 'ativo',
            type: 'bool',
          },
          {
            name: 'tls',
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
          'CREATE INDEX idx_smtp_tenant ON smtp_config (tenant_id)',
          'CREATE INDEX idx_smtp_ativo ON smtp_config (ativo)',
        ],
      })
      app.save(smtpCol)
    }

    // 2. Coleção email_log
    // Regras: apenas admin do tenant lê/escreve
    if (!app.hasTable('email_log')) {
      const emailLogCol = new Collection({
        name: 'email_log',
        type: 'base',
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'",
        createRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'",
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'",
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
            name: 'destinatario',
            type: 'text',
            required: true,
          },
          {
            name: 'assunto',
            type: 'text',
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['enviado', 'falha', 'pendente_envio'],
            maxSelect: 1,
          },
          {
            name: 'erro',
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
          'CREATE INDEX idx_email_log_tenant ON email_log (tenant_id)',
          'CREATE INDEX idx_email_log_status ON email_log (status)',
          'CREATE INDEX idx_email_log_created ON email_log (created DESC)',
        ],
      })
      app.save(emailLogCol)
    }

    // 3. Estender escala_trabalho com campos para escalas especiais (12x36, revezamento)
    // tipo: 'semanal' | 'especial'
    // modelo_especial: '12x36' | 'revezamento'
    // ciclo_dias: int
    // ciclo_dias_trabalho: int
    try {
      const escalaColObj = app.findCollectionByNameOrId('escala_trabalho')
      let modified = false

      const hasTipo = escalaColObj.fields.find((f) => f.name === 'tipo')
      if (!hasTipo) {
        escalaColObj.fields.add(
          new SelectField({
            name: 'tipo',
            values: ['semanal', 'especial'],
            maxSelect: 1,
          }),
        )
        modified = true
      }

      const hasModelo = escalaColObj.fields.find((f) => f.name === 'modelo_especial')
      if (!hasModelo) {
        escalaColObj.fields.add(
          new SelectField({
            name: 'modelo_especial',
            values: ['12x36', 'revezamento'],
            maxSelect: 1,
          }),
        )
        modified = true
      }

      const hasCicloDias = escalaColObj.fields.find((f) => f.name === 'ciclo_dias')
      if (!hasCicloDias) {
        escalaColObj.fields.add(
          new NumberField({
            name: 'ciclo_dias',
          }),
        )
        modified = true
      }

      const hasCicloTrab = escalaColObj.fields.find((f) => f.name === 'ciclo_dias_trabalho')
      if (!hasCicloTrab) {
        escalaColObj.fields.add(
          new NumberField({
            name: 'ciclo_dias_trabalho',
          }),
        )
        modified = true
      }

      if (modified) {
        app.save(escalaColObj)
      }
    } catch (e) {
      console.log('Aviso ao adicionar campos especiais em escala_trabalho:', e)
    }

    // 4. Coleção departamento_escala
    // (tenant_id, departamento, escala_id, data_inicio, data_fim opcional)
    // Regras: RH, Admin RH e Admin podem gerenciar; gestor/colaborador podem consultar
    if (!app.hasTable('departamento_escala')) {
      const depEscalaCol = new Collection({
        name: 'departamento_escala',
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
          'CREATE INDEX idx_dep_escala_tenant ON departamento_escala (tenant_id)',
          'CREATE INDEX idx_dep_escala_dep ON departamento_escala (departamento)',
          'CREATE INDEX idx_dep_escala_dt_ini ON departamento_escala (data_inicio)',
        ],
      })
      app.save(depEscalaCol)
    }
  },
  (app) => {
    try {
      const depEscalaCol = app.findCollectionByNameOrId('departamento_escala')
      app.delete(depEscalaCol)
    } catch (_) {}

    try {
      const emailLogCol = app.findCollectionByNameOrId('email_log')
      app.delete(emailLogCol)
    } catch (_) {}

    try {
      const smtpCol = app.findCollectionByNameOrId('smtp_config')
      app.delete(smtpCol)
    } catch (_) {}
  },
)
