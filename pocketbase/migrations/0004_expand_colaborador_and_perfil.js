migrate(
  (app) => {
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')
    const colaboradorId = colaboradorCol.id
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const tenantId = tenantCol.id

    // 1. Expandir coleção colaborador com novos campos se ainda não existirem
    // Campos: nome_completo, rg, titulo_eleitor, cnh, reservista, data_nascimento,
    // estado_civil, endereco, telefone, email, pix, dados_bancarios, nome_pai,
    // nome_mae, raca_cor, sexo, deficiencia, jornada, local_trabalho
    // (nome, cpf, cargo, departamento, data_admissao, status, foto_url já existem)

    if (!colaboradorCol.fields.getByName('nome_completo')) {
      colaboradorCol.fields.add(new TextField({ name: 'nome_completo' }))
    }
    if (!colaboradorCol.fields.getByName('rg')) {
      colaboradorCol.fields.add(new TextField({ name: 'rg' }))
    }
    if (!colaboradorCol.fields.getByName('titulo_eleitor')) {
      colaboradorCol.fields.add(new TextField({ name: 'titulo_eleitor' }))
    }
    if (!colaboradorCol.fields.getByName('cnh')) {
      colaboradorCol.fields.add(new TextField({ name: 'cnh' }))
    }
    if (!colaboradorCol.fields.getByName('reservista')) {
      colaboradorCol.fields.add(new TextField({ name: 'reservista' }))
    }
    if (!colaboradorCol.fields.getByName('data_nascimento')) {
      colaboradorCol.fields.add(new DateField({ name: 'data_nascimento' }))
    }
    if (!colaboradorCol.fields.getByName('estado_civil')) {
      colaboradorCol.fields.add(
        new SelectField({
          name: 'estado_civil',
          values: ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'],
          maxSelect: 1,
        }),
      )
    }
    if (!colaboradorCol.fields.getByName('endereco')) {
      colaboradorCol.fields.add(new TextField({ name: 'endereco' }))
    }
    if (!colaboradorCol.fields.getByName('telefone')) {
      colaboradorCol.fields.add(new TextField({ name: 'telefone' }))
    }
    if (!colaboradorCol.fields.getByName('email')) {
      colaboradorCol.fields.add(new TextField({ name: 'email' }))
    }
    if (!colaboradorCol.fields.getByName('pix')) {
      colaboradorCol.fields.add(new TextField({ name: 'pix' }))
    }
    if (!colaboradorCol.fields.getByName('dados_bancarios')) {
      colaboradorCol.fields.add(new TextField({ name: 'dados_bancarios' }))
    }
    if (!colaboradorCol.fields.getByName('nome_pai')) {
      colaboradorCol.fields.add(new TextField({ name: 'nome_pai' }))
    }
    if (!colaboradorCol.fields.getByName('nome_mae')) {
      colaboradorCol.fields.add(new TextField({ name: 'nome_mae' }))
    }
    if (!colaboradorCol.fields.getByName('raca_cor')) {
      colaboradorCol.fields.add(
        new SelectField({
          name: 'raca_cor',
          values: ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não informado'],
          maxSelect: 1,
        }),
      )
    }
    if (!colaboradorCol.fields.getByName('sexo')) {
      colaboradorCol.fields.add(
        new SelectField({
          name: 'sexo',
          values: ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'],
          maxSelect: 1,
        }),
      )
    }
    if (!colaboradorCol.fields.getByName('deficiencia')) {
      colaboradorCol.fields.add(new TextField({ name: 'deficiencia' }))
    }
    if (!colaboradorCol.fields.getByName('jornada')) {
      colaboradorCol.fields.add(new TextField({ name: 'jornada' }))
    }
    if (!colaboradorCol.fields.getByName('local_trabalho')) {
      colaboradorCol.fields.add(new TextField({ name: 'local_trabalho' }))
    }

    app.save(colaboradorCol)

    // 2. Criar coleção dependente
    // campos: id, colaborador_id (relation), tenant_id (relation), nome, parentesco, data_nascimento
    if (!app.hasTable('dependente')) {
      const dependenteCol = new Collection({
        name: 'dependente',
        type: 'base',
        // RLS: Colaborador vê apenas seus dependentes; RH e Admin veem todos do tenant
        listRule:
          "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')))",
        viewRule:
          "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')))",
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        fields: [
          {
            name: 'colaborador_id',
            type: 'relation',
            collectionId: colaboradorId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'tenant_id',
            type: 'relation',
            collectionId: tenantId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'parentesco', type: 'text', required: true },
          { name: 'data_nascimento', type: 'date', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_dep_colaborador ON dependente (colaborador_id)',
          'CREATE INDEX idx_dep_tenant ON dependente (tenant_id)',
        ],
      })
      app.save(dependenteCol)
    }

    // 3. Criar coleção contato_emergencia
    // campos: id, colaborador_id (relation), tenant_id (relation), nome, telefone, parentesco
    if (!app.hasTable('contato_emergencia')) {
      const contatoCol = new Collection({
        name: 'contato_emergencia',
        type: 'base',
        // RLS: Colaborador vê apenas seus contatos; RH e Admin veem todos do tenant
        listRule:
          "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')))",
        viewRule:
          "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')))",
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)",
        fields: [
          {
            name: 'colaborador_id',
            type: 'relation',
            collectionId: colaboradorId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'tenant_id',
            type: 'relation',
            collectionId: tenantId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'telefone', type: 'text', required: true },
          { name: 'parentesco', type: 'text', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_contato_colaborador ON contato_emergencia (colaborador_id)',
          'CREATE INDEX idx_contato_tenant ON contato_emergencia (tenant_id)',
        ],
      })
      app.save(contatoCol)
    }

    // 4. Criar coleção solicitacao_alteracao
    // campos: id, colaborador_id, tenant_id, campo, valor_antigo, valor_novo, status ('pendente' | 'aprovada' | 'rejeitada'), data_solicitacao, data_resposta, motivo_resposta
    if (!app.hasTable('solicitacao_alteracao')) {
      const solicitacaoCol = new Collection({
        name: 'solicitacao_alteracao',
        type: 'base',
        // RLS: Colaborador vê apenas suas próprias solicitações; RH/Admin veem todas do tenant
        listRule:
          "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')))",
        viewRule:
          "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')))",
        // Colaborador pode criar sua solicitação (ou RH/Admin)
        createRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
        // Update apenas para RH e Admin (aprovar/rejeitar)
        updateRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
        deleteRule:
          "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin')",
        fields: [
          {
            name: 'colaborador_id',
            type: 'relation',
            collectionId: colaboradorId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'tenant_id',
            type: 'relation',
            collectionId: tenantId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'campo', type: 'text', required: true },
          { name: 'valor_antigo', type: 'text', required: false },
          { name: 'valor_novo', type: 'text', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'aprovada', 'rejeitada'],
            maxSelect: 1,
          },
          { name: 'data_solicitacao', type: 'date', required: false },
          { name: 'data_resposta', type: 'date', required: false },
          { name: 'motivo_resposta', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_solic_colaborador ON solicitacao_alteracao (colaborador_id)',
          'CREATE INDEX idx_solic_tenant ON solicitacao_alteracao (tenant_id)',
          'CREATE INDEX idx_solic_status ON solicitacao_alteracao (status)',
        ],
      })
      app.save(solicitacaoCol)
    }

    // 5. Atualizar registro do colaborador Lucas Ferreira com dados completos e realistas
    try {
      const lucas = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')
      lucas.set('nome_completo', 'Lucas Ferreira dos Santos')
      lucas.set('rg', '45.192.830-7 SSP/SP')
      lucas.set('titulo_eleitor', '1892 0382 0141')
      lucas.set('cnh', '05492819201 - B')
      lucas.set('reservista', '08/391.029-4')
      lucas.set('data_nascimento', '1994-08-22 00:00:00.000Z')
      lucas.set('estado_civil', 'Casado(a)')
      lucas.set('endereco', 'Av. Paulista, 1578, Apto 82 - Bela Vista, São Paulo - SP, 01310-200')
      lucas.set('telefone', '(11) 98765-4321')
      lucas.set('email', 'lucas.ferreira@teslarh.com.br')
      lucas.set('pix', 'lucas.ferreira@teslarh.com.br')
      lucas.set('dados_bancarios', 'Banco Itaú (341) | Agência: 1842 | Conta Corrente: 49201-8')
      lucas.set('nome_pai', 'Antônio Carlos dos Santos')
      lucas.set('nome_mae', 'Maria Aparecida Ferreira Santos')
      lucas.set('raca_cor', 'Parda')
      lucas.set('sexo', 'Masculino')
      lucas.set('deficiencia', 'Nenhuma')
      lucas.set('jornada', '44h semanais (Segunda a Sexta, 09h às 18h)')
      lucas.set('local_trabalho', 'Híbrido • Escritório São Paulo - Av. Paulista')
      app.save(lucas)

      const dependenteCol = app.findCollectionByNameOrId('dependente')
      const contatoCol = app.findCollectionByNameOrId('contato_emergencia')
      const solicitacaoCol = app.findCollectionByNameOrId('solicitacao_alteracao')

      // Seed 2 dependentes para Lucas Ferreira se não existirem
      try {
        app.findFirstRecordByData('dependente', 'nome', 'Beatriz Ferreira dos Santos')
      } catch (_) {
        const dep1 = new Record(dependenteCol)
        dep1.set('colaborador_id', lucas.id)
        dep1.set('tenant_id', tenantId)
        dep1.set('nome', 'Beatriz Ferreira dos Santos')
        dep1.set('parentesco', 'Filha')
        dep1.set('data_nascimento', '2019-05-14 00:00:00.000Z')
        app.save(dep1)
      }

      try {
        app.findFirstRecordByData('dependente', 'nome', 'Camila Rocha dos Santos')
      } catch (_) {
        const dep2 = new Record(dependenteCol)
        dep2.set('colaborador_id', lucas.id)
        dep2.set('tenant_id', tenantId)
        dep2.set('nome', 'Camila Rocha dos Santos')
        dep2.set('parentesco', 'Cônjuge')
        dep2.set('data_nascimento', '1995-11-03 00:00:00.000Z')
        app.save(dep2)
      }

      // Seed 1 contato de emergência para Lucas Ferreira
      try {
        app.findFirstRecordByData('contato_emergencia', 'nome', 'Camila Rocha dos Santos')
      } catch (_) {
        const contato1 = new Record(contatoCol)
        contato1.set('colaborador_id', lucas.id)
        contato1.set('tenant_id', tenantId)
        contato1.set('nome', 'Camila Rocha dos Santos')
        contato1.set('telefone', '(11) 97654-3210')
        contato1.set('parentesco', 'Esposa')
        app.save(contato1)
      }

      // Seed 1 solicitação pendente de exemplo para demonstração no perfil
      try {
        app.findFirstRecordByData('solicitacao_alteracao', 'campo', 'Telefone')
      } catch (_) {
        const solic = new Record(solicitacaoCol)
        solic.set('colaborador_id', lucas.id)
        solic.set('tenant_id', tenantId)
        solic.set('campo', 'Telefone')
        solic.set('valor_antigo', '(11) 98123-0000')
        solic.set('valor_novo', '(11) 98765-4321')
        solic.set('status', 'pendente')
        solic.set('data_solicitacao', '2026-04-12 10:30:00.000Z')
        app.save(solic)
      }
    } catch (e) {
      console.log('Aviso ao atualizar Lucas Ferreira:', e)
    }

    // 6. Atualizar também Cláudio Zanutim (admin) com dados complementares para boa experiência
    try {
      const claudio = app.findFirstRecordByData('colaborador', 'cpf', '049.281.938-71')
      claudio.set('nome_completo', 'Cláudio Zanutim')
      claudio.set('rg', '28.491.029-3 SSP/SP')
      claudio.set('data_nascimento', '1982-03-10 00:00:00.000Z')
      claudio.set('estado_civil', 'Casado(a)')
      claudio.set('endereco', 'Rua Oscar Freire, 950 - Jardins, São Paulo - SP, 01426-001')
      claudio.set('telefone', '(11) 99182-3456')
      claudio.set('email', 'claudio.zanutim@iceduc.com.br')
      claudio.set('pix', 'claudio.zanutim@iceduc.com.br')
      claudio.set('dados_bancarios', 'Banco Bradesco (237) | Agência: 0542 | Conta: 18290-3')
      claudio.set('nome_pai', 'José Zanutim')
      claudio.set('nome_mae', 'Helena Zanutim')
      claudio.set('raca_cor', 'Branca')
      claudio.set('sexo', 'Masculino')
      claudio.set('deficiencia', 'Nenhuma')
      claudio.set('jornada', 'Integral / Dedicação Exclusiva')
      claudio.set('local_trabalho', 'Matriz São Paulo - Sede')
      app.save(claudio)
    } catch (_) {}
  },
  (app) => {
    try {
      const s = app.findCollectionByNameOrId('solicitacao_alteracao')
      app.delete(s)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('contato_emergencia')
      app.delete(c)
    } catch (_) {}
    try {
      const d = app.findCollectionByNameOrId('dependente')
      app.delete(d)
    } catch (_) {}
  },
)
