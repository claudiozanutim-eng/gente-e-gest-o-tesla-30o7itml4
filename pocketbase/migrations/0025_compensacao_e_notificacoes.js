migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')
    const usersCol = app.findCollectionByNameOrId('users')

    // 1. Atualizar RLS de solicitacao_alteracao para permitir que gestores do mesmo departamento possam listar e visualizar
    try {
      const solAlteracaoCol = app.findCollectionByNameOrId('solicitacao_alteracao')
      solAlteracaoCol.listRule =
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
        "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || " +
        'colaborador_id.user_id = @request.auth.id || ' +
        "(@request.auth.perfil = 'gestor' && colaborador_id.departamento != '' && colaborador_id.departamento = @request.auth.colaborador_via_user_id.departamento)" +
        ')'

      solAlteracaoCol.viewRule =
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
        "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || " +
        'colaborador_id.user_id = @request.auth.id || ' +
        "(@request.auth.perfil = 'gestor' && colaborador_id.departamento != '' && colaborador_id.departamento = @request.auth.colaborador_via_user_id.departamento)" +
        ')'

      solAlteracaoCol.updateRule =
        "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
        "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || " +
        "(@request.auth.perfil = 'gestor' && colaborador_id.departamento != '' && colaborador_id.departamento = @request.auth.colaborador_via_user_id.departamento)" +
        ')'

      app.save(solAlteracaoCol)
    } catch (e) {
      console.log('Aviso ao ajustar RLS de solicitacao_alteracao:', e)
    }

    // 2. Coleção compensacao_banco_horas
    // (tenant_id, colaborador_id, data_compensacao, horas, motivo, status, data_solicitacao, data_resposta, motivo_resposta, aprovado_por)
    if (!app.hasTable('compensacao_banco_horas')) {
      const compCol = new Collection({
        name: 'compensacao_banco_horas',
        type: 'base',
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
          "(@request.auth.perfil = 'gestor' && colaborador_id.departamento != '' && colaborador_id.departamento = @request.auth.colaborador_via_user_id.departamento) || " +
          "(colaborador_id.user_id = @request.auth.id && status = 'recusada')" +
          ')',
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
            name: 'colaborador_id',
            type: 'relation',
            collectionId: colaboradorCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'data_compensacao',
            type: 'date',
            required: true,
          },
          {
            name: 'horas',
            type: 'number',
            required: true,
          },
          {
            name: 'motivo',
            type: 'text',
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'aprovada', 'recusada'],
            maxSelect: 1,
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
            name: 'motivo_resposta',
            type: 'text',
          },
          {
            name: 'aprovado_por',
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
          'CREATE INDEX idx_comp_bh_tenant ON compensacao_banco_horas (tenant_id)',
          'CREATE INDEX idx_comp_bh_colab ON compensacao_banco_horas (colaborador_id)',
          'CREATE INDEX idx_comp_bh_status ON compensacao_banco_horas (status)',
          'CREATE INDEX idx_comp_bh_data ON compensacao_banco_horas (data_compensacao)',
        ],
      })
      app.save(compCol)
    }

    // 3. Coleção notificacao
    // (tenant_id, destinatario_id -> users, tipo, titulo, mensagem, link, lida, created, updated)
    if (!app.hasTable('notificacao')) {
      const notifCol = new Collection({
        name: 'notificacao',
        type: 'base',
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && destinatario_id = @request.auth.id",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && destinatario_id = @request.auth.id",
        createRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && destinatario_id = @request.auth.id",
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && destinatario_id = @request.auth.id",
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
            name: 'destinatario_id',
            type: 'relation',
            collectionId: usersCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: [
              'ferias',
              'compensacao',
              'atestado',
              'holerite',
              'comunicado',
              'cadastro',
              'avaliacao',
              'geral',
            ],
            maxSelect: 1,
          },
          {
            name: 'titulo',
            type: 'text',
            required: true,
          },
          {
            name: 'mensagem',
            type: 'text',
            required: true,
          },
          {
            name: 'link',
            type: 'text',
          },
          {
            name: 'lida',
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
          'CREATE INDEX idx_notif_tenant ON notificacao (tenant_id)',
          'CREATE INDEX idx_notif_destinatario ON notificacao (destinatario_id)',
          'CREATE INDEX idx_notif_lida ON notificacao (lida)',
          'CREATE INDEX idx_notif_created ON notificacao (created DESC)',
        ],
      })
      app.save(notifCol)
    }

    // 4. Seeder inicial de amostra para compensações e notificações (se aplicável)
    try {
      const compCol = app.findCollectionByNameOrId('compensacao_banco_horas')
      const notifCol = app.findCollectionByNameOrId('notificacao')

      // Colaborador Lucas Ferreira
      const colabLucas = app.findFirstRecordByData('colaborador', 'nome', 'Lucas Ferreira')
      const userLucas = app.findFirstRecordByData('users', 'email', 'lucas.ferreira@teslarh.com.br')
      const userRoberto = app.findFirstRecordByData(
        'users',
        'email',
        'roberto.almeida@teslarh.com.br',
      )

      if (colabLucas && userLucas) {
        // Criar uma solicitação de compensação de exemplo pendente
        const existentesComp = app.findRecordsByFilter(
          'compensacao_banco_horas',
          `colaborador_id = '${colabLucas.id}'`,
          '-created',
          1,
          0,
        )

        if (existentesComp.length === 0) {
          const comp1 = new Record(compCol)
          comp1.set('tenant_id', colabLucas.getString('tenant_id'))
          comp1.set('colaborador_id', colabLucas.id)
          comp1.set('data_compensacao', '2026-09-21 00:00:00.000Z')
          comp1.set('horas', 4.0)
          comp1.set('motivo', 'Compensação parcial por consulta médica no período da tarde.')
          comp1.set('status', 'pendente')
          comp1.set('data_solicitacao', new Date().toISOString())
          app.save(comp1)

          // Notificação para o Roberto (gestor) sobre a compensação pendente
          if (userRoberto) {
            const notifGestor = new Record(notifCol)
            notifGestor.set('tenant_id', colabLucas.getString('tenant_id'))
            notifGestor.set('destinatario_id', userRoberto.id)
            notifGestor.set('tipo', 'compensacao')
            notifGestor.set('titulo', 'Nova solicitação de compensação')
            notifGestor.set(
              'mensagem',
              'Lucas Ferreira solicitou 4,0h de compensação de banco de horas para 21/09/2026.',
            )
            notifGestor.set('link', '/portal-gestor')
            notifGestor.set('lida', false)
            app.save(notifGestor)
          }

          // Notificação de boas-vindas / aviso para Lucas
          const notifLucas = new Record(notifCol)
          notifLucas.set('tenant_id', colabLucas.getString('tenant_id'))
          notifLucas.set('destinatario_id', userLucas.id)
          notifLucas.set('tipo', 'holerite')
          notifLucas.set('titulo', 'Demonstrativo de pagamento disponível')
          notifLucas.set(
            'mensagem',
            'Seu demonstrativo financeiro da competência 09/2026 já está disponível para consulta.',
          )
          notifLucas.set('link', '/demonstrativo')
          notifLucas.set('lida', false)
          app.save(notifLucas)
        }
      }
    } catch (errSeed) {
      console.log('Aviso ao semear dados iniciais de compensação e notificação:', errSeed)
    }
  },
  (app) => {
    try {
      const compCol = app.findCollectionByNameOrId('compensacao_banco_horas')
      app.delete(compCol)
    } catch (_) {}

    try {
      const notifCol = app.findCollectionByNameOrId('notificacao')
      app.delete(notifCol)
    } catch (_) {}
  },
)
