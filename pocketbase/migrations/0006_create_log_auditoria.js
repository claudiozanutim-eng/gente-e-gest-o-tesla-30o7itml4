migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const tenantId = tenantCol.id

    // Criar coleção log_auditoria
    // campos: tenant_id, user_id, acao, entidade, entidade_id, dados_json, data_hora
    if (!app.hasTable('log_auditoria')) {
      const auditCol = new Collection({
        name: 'log_auditoria',
        type: 'base',
        // RLS: Leitura apenas para RH e Admin do mesmo tenant
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
        // Escrita: usuários autenticados RH ou Admin do tenant
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
        updateRule: null, // Logs de auditoria são imutáveis
        deleteRule: null, // Logs de auditoria não devem ser apagados por usuários
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            collectionId: tenantId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'user_id',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            required: true,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'acao', type: 'text', required: true },
          { name: 'entidade', type: 'text', required: true },
          { name: 'entidade_id', type: 'text', required: true },
          { name: 'dados_json', type: 'json', required: false },
          { name: 'data_hora', type: 'date', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_audit_tenant ON log_auditoria (tenant_id)',
          'CREATE INDEX idx_audit_user ON log_auditoria (user_id)',
          'CREATE INDEX idx_audit_entidade ON log_auditoria (entidade, entidade_id)',
          'CREATE INDEX idx_audit_data ON log_auditoria (data_hora)',
        ],
      })
      app.save(auditCol)
    }

    // Opcional: seed de 1 ou 2 registros iniciais de auditoria para demonstração
    try {
      const auditCol = app.findCollectionByNameOrId('log_auditoria')
      const rhUser = app.findAuthRecordByEmail('_pb_users_auth_', 'mariana.silva@teslarh.com.br')
      const lucas = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')

      const logRecord = new Record(auditCol)
      logRecord.set('tenant_id', tenantId)
      logRecord.set('user_id', rhUser.id)
      logRecord.set('acao', 'visualizacao_ficha')
      logRecord.set('entidade', 'colaborador')
      logRecord.set('entidade_id', lucas.id)
      logRecord.set('dados_json', {
        usuario_nome: 'Mariana Silva',
        usuario_email: 'mariana.silva@teslarh.com.br',
        usuario_perfil: 'rh',
        colaborador_nome: 'Lucas Ferreira',
        colaborador_cargo: 'Analista de Marketing Pleno',
        origem: 'Base de Colaboradores',
      })
      logRecord.set('data_hora', new Date().toISOString())
      app.save(logRecord)
    } catch (_) {}
  },
  (app) => {
    try {
      const auditCol = app.findCollectionByNameOrId('log_auditoria')
      app.delete(auditCol)
    } catch (_) {}
  },
)
