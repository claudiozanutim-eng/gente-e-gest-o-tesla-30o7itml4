migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!app.hasTable('historico_funcao')) {
      const historicoCol = new Collection({
        name: 'historico_funcao',
        type: 'base',
        // RLS:
        // - Usuários autenticados do tenant podem listar e visualizar
        // - Usuários com perfil rh, admin_rh, admin podem criar, editar e deletar
        listRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        viewRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin'" +
          ')',
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin'" +
          ')',
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin'" +
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
            name: 'colaborador_id',
            type: 'relation',
            collectionId: colaboradorCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'cargo',
            type: 'text',
            required: true,
          },
          {
            name: 'departamento',
            type: 'text',
          },
          {
            name: 'data_inicio',
            type: 'date',
            required: true,
          },
          {
            name: 'data_fim',
            type: 'date',
          },
          {
            name: 'origem',
            type: 'select',
            required: true,
            values: ['admissao', 'mudanca', 'promocao', 'transferencia'],
            maxSelect: 1,
          },
          {
            name: 'motivo',
            type: 'text',
          },
          {
            name: 'criado_por',
            type: 'relation',
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
          'CREATE INDEX idx_hist_func_tenant ON historico_funcao (tenant_id)',
          'CREATE INDEX idx_hist_func_colab ON historico_funcao (colaborador_id)',
          'CREATE INDEX idx_hist_func_dt_ini ON historico_funcao (data_inicio)',
        ],
      })
      app.save(historicoCol)
    }

    // Seed demonstrativo do caso de uso descrito pelo usuário:
    // Amauri Aparecido Ramos:
    // data de admissão 16/09/2026 = Assistente; 16/10/2027 = Assistente de Expedição Externo (vigente).
    try {
      const amauri = app.findFirstRecordByData('colaborador', 'cpf', '290.838.128-12')
      const histCol = app.findCollectionByNameOrId('historico_funcao')

      // Verificar se já tem registros
      const registros = app.findRecordsByFilter(
        'historico_funcao',
        `colaborador_id = "${amauri.id}"`,
        'data_inicio',
        10,
        0,
      )

      if (registros.length === 0) {
        // Registro 1: Assistente (admissão 16/09/2026 até 16/10/2027)
        const rec1 = new Record(histCol)
        rec1.set('tenant_id', amauri.getString('tenant_id'))
        rec1.set('colaborador_id', amauri.id)
        rec1.set('cargo', 'Assistente')
        rec1.set('departamento', 'Expedição')
        rec1.set('data_inicio', '2026-09-16 00:00:00.000Z')
        rec1.set('data_fim', '2027-10-16 00:00:00.000Z')
        rec1.set('origem', 'admissao')
        rec1.set('motivo', 'Contratação inicial')
        app.save(rec1)

        // Registro 2: Assistente de Expedição Externo (início 16/10/2027, vigente data_fim nulo)
        const rec2 = new Record(histCol)
        rec2.set('tenant_id', amauri.getString('tenant_id'))
        rec2.set('colaborador_id', amauri.id)
        rec2.set('cargo', 'Assistente de Expedição Externo')
        rec2.set('departamento', 'Expedição')
        rec2.set('data_inicio', '2027-10-16 00:00:00.000Z')
        rec2.set('data_fim', null)
        rec2.set('origem', 'mudanca')
        rec2.set('motivo', 'Mudança de enquadramento funcional')
        app.save(rec2)
      }
    } catch (e) {
      console.log('Aviso ao semear historico_funcao para Amauri:', e)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('historico_funcao')
      app.delete(col)
    } catch (_) {}
  },
)
