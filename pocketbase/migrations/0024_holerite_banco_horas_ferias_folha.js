migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    // 1. Coleção holerite_registro
    // (tenant_id, colaborador_id, competencia, total_proventos, total_descontos, total_liquido, codigo_verificacao, data_emissao)
    // RLS:
    // - colaborador lê apenas os seus
    // - rh/admin_rh/admin leem todos do tenant
    // - criação permitida para colaborador (ao emitir) ou rh/admin_rh/admin
    if (!app.hasTable('holerite_registro')) {
      const holeriteCol = new Collection({
        name: 'holerite_registro',
        type: 'base',
        listRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || " +
          'colaborador_id.user_id = @request.auth.id' +
          ')',
        viewRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || " +
          'colaborador_id.user_id = @request.auth.id' +
          ')',
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || " +
          'colaborador_id.user_id = @request.auth.id' +
          ')',
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
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
            name: 'competencia',
            type: 'text',
            required: true,
          },
          {
            name: 'total_proventos',
            type: 'number',
            required: true,
          },
          {
            name: 'total_descontos',
            type: 'number',
            required: true,
          },
          {
            name: 'total_liquido',
            type: 'number',
            required: true,
          },
          {
            name: 'codigo_verificacao',
            type: 'text',
            required: true,
          },
          {
            name: 'data_emissao',
            type: 'date',
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
          'CREATE INDEX idx_holerite_tenant ON holerite_registro (tenant_id)',
          'CREATE INDEX idx_holerite_colab ON holerite_registro (colaborador_id)',
          'CREATE INDEX idx_holerite_comp ON holerite_registro (competencia)',
          'CREATE INDEX idx_holerite_codigo ON holerite_registro (codigo_verificacao)',
        ],
      })
      app.save(holeriteCol)
    }

    // 2. Coleção banco_horas_fechamento
    // (tenant_id, colaborador_id, competencia "AAAA-MM", horas_trabalhadas_ms, horas_escaladas_ms, saldo_ms, horas_credito_ms, horas_debito_ms, status 'fechado', data_fechamento, comentario_rh)
    // RLS:
    // - colaborador lê apenas os seus
    // - gestor lê da equipe (mesmo departamento)
    // - rh/admin_rh/admin leem e criam do tenant
    if (!app.hasTable('banco_horas_fechamento')) {
      const bhCol = new Collection({
        name: 'banco_horas_fechamento',
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
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (" +
          "@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')",
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
            name: 'competencia',
            type: 'text',
            required: true,
          },
          {
            name: 'horas_trabalhadas_ms',
            type: 'number',
            required: true,
          },
          {
            name: 'horas_escaladas_ms',
            type: 'number',
            required: true,
          },
          {
            name: 'saldo_ms',
            type: 'number',
            required: true,
          },
          {
            name: 'horas_credito_ms',
            type: 'number',
            required: true,
          },
          {
            name: 'horas_debito_ms',
            type: 'number',
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['fechado'],
            maxSelect: 1,
          },
          {
            name: 'data_fechamento',
            type: 'date',
            required: true,
          },
          {
            name: 'comentario_rh',
            type: 'text',
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
          'CREATE INDEX idx_bh_tenant ON banco_horas_fechamento (tenant_id)',
          'CREATE INDEX idx_bh_colab ON banco_horas_fechamento (colaborador_id)',
          'CREATE INDEX idx_bh_comp ON banco_horas_fechamento (competencia)',
          'CREATE UNIQUE INDEX idx_bh_colab_comp ON banco_horas_fechamento (colaborador_id, competencia)',
        ],
      })
      app.save(bhCol)
    }

    // 3. Ajustar campos na coleção lancamento_pontual:
    // Adicionar origem_automatica (bool) e solicitacao_ferias_id (relation opcional ou text)
    const pontualCol = app.findCollectionByNameOrId('lancamento_pontual')
    if (!pontualCol.fields.getByName('origem_automatica')) {
      pontualCol.fields.add(
        new BoolField({
          name: 'origem_automatica',
        }),
      )
    }
    if (!pontualCol.fields.getByName('solicitacao_ferias_id')) {
      pontualCol.fields.add(
        new TextField({
          name: 'solicitacao_ferias_id',
        }),
      )
    }
    // RLS de lancamento_pontual: garantir que rh também possa criar se necessário,
    // ou mantendo admin_rh e admin. Permitir rh criar também para flexibilidade do módulo:
    pontualCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    pontualCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    pontualCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(pontualCol)

    // 4. Seed/migração para solicitações de férias JÁ APROVADAS existentes:
    // Gerar lançamentos na folha caso ainda não existam
    try {
      const feriasCol = app.findCollectionByNameOrId('solicitacao_ferias')
      const aprovadas = app.findRecordsByFilter(
        'solicitacao_ferias',
        "status = 'aprovada'",
        '-created',
        100,
        0,
      )

      for (let i = 0; i < aprovadas.length; i++) {
        const sol = aprovadas[i]
        const colabId = sol.getString('colaborador_id')
        const tenantId = sol.getString('tenant_id')
        const solId = sol.id
        const dataInicioStr = sol.getString('data_inicio') // ex: '2026-09-05 00:00:00.000Z'
        const comp = dataInicioStr.slice(0, 7) // '2026-09'

        // Verificar se já existe lançamento para essa solicitação
        const existentes = app.findRecordsByFilter(
          'lancamento_pontual',
          `solicitacao_ferias_id = '${solId}'`,
          '-created',
          10,
          0,
        )

        if (existentes.length === 0) {
          // Buscar remuneração mensal do colaborador para cálculo
          let salarioMensal = 0
          try {
            const periodicos = app.findRecordsByFilter(
              'lancamento_periodico',
              `colaborador_id = '${colabId}' && descritivo ~ 'Remuneração'`,
              '-created',
              1,
              0,
            )
            if (periodicos.length > 0) {
              salarioMensal = periodicos[0].getFloat('quantidade')
            }
          } catch (_) {}

          const dias = sol.getInt('dias') || 0
          // Valor proporcional das férias: (salário / 30) * dias + 1/3 constitucional
          const valorDiaria = salarioMensal > 0 ? salarioMensal / 30 : 0
          const valorFeriasBase = valorDiaria * dias
          const tercoConstitucional = valorFeriasBase / 3
          const valorTotalFerias = Math.round((valorFeriasBase + tercoConstitucional) * 100) / 100

          const lancFerias = new Record(pontualCol)
          lancFerias.set('tenant_id', tenantId)
          lancFerias.set('colaborador_id', colabId)
          lancFerias.set('descritivo', `Férias — ${comp}`)
          lancFerias.set('quantidade', valorTotalFerias)
          lancFerias.set('data', dataInicioStr)
          lancFerias.set('origem_automatica', true)
          lancFerias.set('solicitacao_ferias_id', solId)
          lancFerias.set(
            'comentario',
            `Gerado automaticamente pela aprovação de férias (${dias} dias: ${dataInicioStr.slice(0, 10)} a ${sol.getString('data_fim').slice(0, 10)})`,
          )
          app.save(lancFerias)

          // Se houver abono pecuniário (venda de 10 ou 20 dias)
          const temAbono = sol.getBool('abono_pecuniario') || sol.getBool('vender_20_dias')
          if (temAbono) {
            // Abono de 10 dias + 1/3 constitucional
            const diasAbono = sol.getBool('vender_20_dias') ? 20 : 10
            const valorAbonoBase = valorDiaria * diasAbono
            const tercoAbono = valorAbonoBase / 3
            const valorTotalAbono = Math.round((valorAbonoBase + tercoAbono) * 100) / 100

            const lancAbono = new Record(pontualCol)
            lancAbono.set('tenant_id', tenantId)
            lancAbono.set('colaborador_id', colabId)
            lancAbono.set('descritivo', 'Abono Pecuniário de Férias')
            lancAbono.set('quantidade', valorTotalAbono)
            lancAbono.set('data', dataInicioStr)
            lancAbono.set('origem_automatica', true)
            lancAbono.set('solicitacao_ferias_id', solId)
            lancAbono.set(
              'comentario',
              `Gerado automaticamente pela aprovação de abono pecuniário (${diasAbono} dias)`,
            )
            app.save(lancAbono)
          }
        }
      }
    } catch (e) {
      console.log('Aviso ao semear lançamentos de férias aprovadas:', e)
    }
  },
  (app) => {
    try {
      const bhCol = app.findCollectionByNameOrId('banco_horas_fechamento')
      app.delete(bhCol)
    } catch (_) {}

    try {
      const holeriteCol = app.findCollectionByNameOrId('holerite_registro')
      app.delete(holeriteCol)
    } catch (_) {}
  },
)
