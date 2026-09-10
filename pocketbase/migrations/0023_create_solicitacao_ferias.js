migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    if (!app.hasTable('solicitacao_ferias')) {
      const feriasCol = new Collection({
        name: 'solicitacao_ferias',
        type: 'base',
        // RLS:
        // - Colaborador cria e vê apenas as próprias
        // - Gestor vê as solicitações da equipe (mesmo departamento) ou as próprias
        // - RH, Admin RH e Admin Geral leem e atualizam todas do tenant
        // - Aprovação/atualização restrita a gestor, rh, admin_rh e admin
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || " +
          'colaborador_id.user_id = @request.auth.id || ' +
          "(@request.auth.perfil = 'gestor' && colaborador_id.departamento != '' && colaborador_id.departamento = @request.auth.colaborador_via_user_id.departamento)" +
          ')',
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || " +
          'colaborador_id.user_id = @request.auth.id || ' +
          "(@request.auth.perfil = 'gestor' && colaborador_id.departamento != '' && colaborador_id.departamento = @request.auth.colaborador_via_user_id.departamento)" +
          ')',
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || " +
          'colaborador_id.user_id = @request.auth.id' +
          ')',
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || " +
          "(@request.auth.perfil = 'gestor' && colaborador_id.departamento = @request.auth.colaborador_via_user_id.departamento) || " +
          "(colaborador_id.user_id = @request.auth.id && status = 'cancelada')" +
          ')',
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
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
            name: 'dias',
            type: 'number',
            required: true,
            min: 1,
            max: 30,
            onlyInt: true,
          },
          {
            name: 'abono_pecuniario',
            type: 'bool',
          },
          {
            name: 'vender_20_dias',
            type: 'bool',
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'aprovada', 'rejeitada', 'cancelada'],
            maxSelect: 1,
          },
          {
            name: 'comentario_gestor',
            type: 'text',
          },
          {
            name: 'data_solicitacao',
            type: 'date',
          },
          {
            name: 'data_resposta',
            type: 'date',
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
          'CREATE INDEX idx_ferias_tenant ON solicitacao_ferias (tenant_id)',
          'CREATE INDEX idx_ferias_colab ON solicitacao_ferias (colaborador_id)',
          'CREATE INDEX idx_ferias_status ON solicitacao_ferias (status)',
          'CREATE INDEX idx_ferias_data_inicio ON solicitacao_ferias (data_inicio)',
        ],
      })
      app.save(feriasCol)
    }

    // Seeds de teste para solicitacao_ferias:
    // 1. Uma pendente do Lucas Ferreira (Marketing) para Roberto Almeida aprovar
    // 2. Uma aprovada cobrindo dias no mês atual (ex: Thiago Ramos em TI) para o espelho de ponto mostrar "Férias"
    try {
      const feriasCol = app.findCollectionByNameOrId('solicitacao_ferias')
      const teslaTenant = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')

      const lucas = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')
      const thiago = app.findFirstRecordByData('colaborador', 'cpf', '671.203.491-30')

      // Verificar se já existe seed para o Lucas
      try {
        app.findFirstRecordByData('solicitacao_ferias', 'colaborador_id', lucas.id)
      } catch (_) {
        // Criar solicitação pendente do Lucas
        const hoje = new Date()
        const inicioLucas = new Date(hoje)
        inicioLucas.setDate(inicioLucas.getDate() + 35)
        const fimLucas = new Date(inicioLucas)
        fimLucas.setDate(fimLucas.getDate() + 19)

        const solLucas = new Record(feriasCol)
        solLucas.set('tenant_id', teslaTenant.id)
        solLucas.set('colaborador_id', lucas.id)
        solLucas.set('data_inicio', inicioLucas.toISOString().slice(0, 10) + ' 00:00:00.000Z')
        solLucas.set('data_fim', fimLucas.toISOString().slice(0, 10) + ' 00:00:00.000Z')
        solLucas.set('dias', 20)
        solLucas.set('abono_pecuniario', true)
        solLucas.set('vender_20_dias', false)
        solLucas.set('status', 'pendente')
        solLucas.set('data_solicitacao', hoje.toISOString().slice(0, 10) + ' 10:00:00.000Z')
        app.save(solLucas)
      }

      // Verificar se já existe seed para o Thiago
      try {
        app.findFirstRecordByData('solicitacao_ferias', 'colaborador_id', thiago.id)
      } catch (_) {
        // Criar solicitação aprovada do Thiago cobrindo dias no mês atual
        const hoje = new Date()
        // Cobrir por exemplo do dia 5 ao dia 15 deste mês
        const inicioThiago = new Date(hoje.getFullYear(), hoje.getMonth(), 5)
        const fimThiago = new Date(hoje.getFullYear(), hoje.getMonth(), 14)

        const solThiago = new Record(feriasCol)
        solThiago.set('tenant_id', teslaTenant.id)
        solThiago.set('colaborador_id', thiago.id)
        solThiago.set('data_inicio', inicioThiago.toISOString().slice(0, 10) + ' 00:00:00.000Z')
        solThiago.set('data_fim', fimThiago.toISOString().slice(0, 10) + ' 00:00:00.000Z')
        solThiago.set('dias', 10)
        solThiago.set('abono_pecuniario', false)
        solThiago.set('vender_20_dias', false)
        solThiago.set('status', 'aprovada')
        solThiago.set(
          'comentario_gestor',
          'Férias regulares aprovadas conforme programação anual da equipe de TI.',
        )
        solThiago.set(
          'data_solicitacao',
          new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 10) +
            ' 09:00:00.000Z',
        )
        solThiago.set(
          'data_resposta',
          new Date(hoje.getFullYear(), hoje.getMonth() - 1, 5).toISOString().slice(0, 10) +
            ' 14:30:00.000Z',
        )
        app.save(solThiago)
      }
    } catch (seedErr) {
      console.log('Aviso ao semear solicitacao_ferias:', seedErr)
    }
  },
  (app) => {
    try {
      const feriasCol = app.findCollectionByNameOrId('solicitacao_ferias')
      app.delete(feriasCol)
    } catch (_) {}
  },
)
