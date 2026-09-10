migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const colabCol = app.findCollectionByNameOrId('colaborador')

    // 1. Coleção pesquisa_clima
    // Regras de acesso:
    // list/view: qualquer usuário autenticado do mesmo tenant
    // create/update/delete: rh, admin_rh, admin do mesmo tenant
    if (!app.hasTable('pesquisa_clima')) {
      const pesquisaCol = new Collection({
        name: 'pesquisa_clima',
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
            name: 'pergunta',
            type: 'text',
            required: true,
          },
          {
            name: 'escala',
            type: 'select',
            required: true,
            values: ['1-5', '1-10', 'estrelas'],
            maxSelect: 1,
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
            values: ['ativa', 'encerrada', 'rascunho'],
            maxSelect: 1,
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
          'CREATE INDEX idx_pesquisa_tenant ON pesquisa_clima (tenant_id)',
          'CREATE INDEX idx_pesquisa_status ON pesquisa_clima (status)',
          'CREATE INDEX idx_pesquisa_inicio_fim ON pesquisa_clima (data_inicio, data_fim)',
        ],
      })
      app.save(pesquisaCol)
    }

    // 2. Coleção pesquisa_clima_resposta
    // Regras de acesso por linha:
    // list/view: colaborador vê apenas a própria resposta OU rh/admin_rh/admin do tenant leem tudo
    // create: usuário autenticado do tenant
    // update: colaborador pode atualizar a própria resposta OU rh/admin_rh/admin
    // delete: admin_rh / admin
    if (!app.hasTable('pesquisa_clima_resposta')) {
      const pesquisaCol = app.findCollectionByNameOrId('pesquisa_clima')
      const respostaCol = new Collection({
        name: 'pesquisa_clima_resposta',
        type: 'base',
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          'colaborador_id.user_id = @request.auth.id || ' +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          'colaborador_id.user_id = @request.auth.id || ' +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
        createRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          'colaborador_id.user_id = @request.auth.id || ' +
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
            name: 'pesquisa_id',
            type: 'relation',
            collectionId: pesquisaCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'colaborador_id',
            type: 'relation',
            collectionId: colabCol.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'nota',
            type: 'number',
            required: true,
            min: 1,
            max: 10,
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
          'CREATE INDEX idx_resp_tenant ON pesquisa_clima_resposta (tenant_id)',
          'CREATE INDEX idx_resp_pesquisa ON pesquisa_clima_resposta (pesquisa_id)',
          'CREATE INDEX idx_resp_colaborador ON pesquisa_clima_resposta (colaborador_id)',
          'CREATE UNIQUE INDEX idx_resp_pesquisa_colab ON pesquisa_clima_resposta (pesquisa_id, colaborador_id)',
        ],
      })
      app.save(respostaCol)
    }

    // 3. Seed idempotente de uma pesquisa de exemplo ativa com respostas de teste
    try {
      const tenants = app.findRecordsByFilter('tenant', "status = 'ativo'", 'created', 1, 0)
      if (tenants && tenants.length > 0) {
        const tenantId = tenants[0].id
        const pesquisaCol = app.findCollectionByNameOrId('pesquisa_clima')
        const respostaCol = app.findCollectionByNameOrId('pesquisa_clima_resposta')

        let adminUser = null
        try {
          adminUser = app.findFirstRecordByData('users', 'email', 'claudio.zanutim@iceduc.com.br')
        } catch (_) {}

        // Verificar se já existe a pesquisa de clima de exemplo
        let pesquisaRecord = null
        try {
          pesquisaRecord = app.findFirstRecordByData(
            'pesquisa_clima',
            'pergunta',
            'Como você avalia seu ambiente de trabalho na Tesla Mecatrônica?',
          )
        } catch (_) {
          const hoje = new Date()
          const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
          const dataFim = new Date(
            hoje.getFullYear(),
            hoje.getMonth() + 1,
            0,
            23,
            59,
            59,
          ).toISOString()

          const p = new Record(pesquisaCol)
          p.set('tenant_id', tenantId)
          p.set('pergunta', 'Como você avalia seu ambiente de trabalho na Tesla Mecatrônica?')
          p.set('escala', '1-5')
          p.set('data_inicio', dataInicio)
          p.set('data_fim', dataFim)
          p.set('status', 'ativa')
          if (adminUser) {
            p.set('criado_por', adminUser.id)
          }
          app.save(p)
          pesquisaRecord = p
        }

        // Semear algumas respostas de colaboradores de amostra
        if (pesquisaRecord) {
          const colabs = app.findRecordsByFilter(
            'colaborador',
            `tenant_id = '${tenantId}'`,
            'created',
            5,
            0,
          )
          const respostasExemplo = [
            {
              nota: 5,
              comentario: 'Excelente clima organizacional, suporte técnico e foco em inovação.',
            },
            { nota: 4, comentario: 'Ambiente muito colaborativo e ótima liderança imediata.' },
            { nota: 5, comentario: 'Estrutura mecatrônica de ponta e equipe muito unida.' },
          ]

          for (let i = 0; i < Math.min(colabs.length, respostasExemplo.length); i++) {
            const colab = colabs[i]
            const resp = respostasExemplo[i]
            try {
              app.findFirstRecordByData('pesquisa_clima_resposta', 'colaborador_id', colab.id)
            } catch (_) {
              const r = new Record(respostaCol)
              r.set('tenant_id', tenantId)
              r.set('pesquisa_id', pesquisaRecord.id)
              r.set('colaborador_id', colab.id)
              r.set('nota', resp.nota)
              r.set('comentario', resp.comentario)
              app.save(r)
            }
          }
        }
      }
    } catch (errSeed) {
      console.log('Aviso ao semear pesquisa de clima de exemplo:', errSeed)
    }
  },
  (app) => {
    try {
      const respostaCol = app.findCollectionByNameOrId('pesquisa_clima_resposta')
      app.delete(respostaCol)
    } catch (_) {}

    try {
      const pesquisaCol = app.findCollectionByNameOrId('pesquisa_clima')
      app.delete(pesquisaCol)
    } catch (_) {}
  },
)
