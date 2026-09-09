migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const tenantId = tenantCol.id

    // 1. Create 'comunicado' collection
    const comunicadoCol = new Collection({
      name: 'comunicado',
      type: 'base',
      // Access rules (RLS): each tenant sees only its own records
      listRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
      viewRule: "@request.auth.id != '' && tenant_id = @request.auth.tenant_id",
      // Only RH and Admin can create, update, delete
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
          collectionId: tenantId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          values: ['RH', 'Empresa', 'Qualidade', 'Segurança', 'Benefícios'],
          maxSelect: 1,
        },
        {
          name: 'titulo',
          type: 'text',
          required: true,
        },
        {
          name: 'conteudo',
          type: 'text',
          required: true,
        },
        {
          name: 'segmentacao_tipo',
          type: 'select',
          required: true,
          values: ['todos', 'setor', 'funcao', 'gestores'],
          maxSelect: 1,
        },
        {
          name: 'segmentacao_valor',
          type: 'text',
          required: false,
        },
        {
          name: 'data_publicacao',
          type: 'date',
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_comunicado_tenant ON comunicado (tenant_id)',
        'CREATE INDEX idx_comunicado_categoria ON comunicado (categoria)',
        'CREATE INDEX idx_comunicado_segmentacao ON comunicado (segmentacao_tipo)',
        'CREATE INDEX idx_comunicado_data ON comunicado (data_publicacao DESC)',
      ],
    })

    app.save(comunicadoCol)

    // 2. Seed example comunicados for Tesla RH Ltda covering all 5 categories & segmentation types
    let tenantRecord
    try {
      tenantRecord = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')
    } catch (_) {
      return
    }

    const tId = tenantRecord.id

    const seedComunicado = (
      categoria,
      titulo,
      conteudo,
      segmentacaoTipo,
      segmentacaoValor,
      dataPublicacao,
    ) => {
      try {
        app.findFirstRecordByData('comunicado', 'titulo', titulo)
      } catch (_) {
        const record = new Record(comunicadoCol)
        record.set('tenant_id', tId)
        record.set('categoria', categoria)
        record.set('titulo', titulo)
        record.set('conteudo', conteudo)
        record.set('segmentacao_tipo', segmentacaoTipo)
        record.set('segmentacao_valor', segmentacaoValor || '')
        record.set('data_publicacao', dataPublicacao)
        app.save(record)
      }
    }

    // Category 1: Empresa | segmentacao: 'todos'
    seedComunicado(
      'Empresa',
      'Resultados do 1º Trimestre e Metas de Crescimento',
      'Apresentamos com orgulho os resultados corporativos deste trimestre. Superamos em 18% as metas de novos clientes e mantivemos índice de satisfação acima de 95%. Obrigado a todo o time pelo comprometimento.',
      'todos',
      '',
      '2026-04-10 09:00:00.000Z',
    )

    // Category 2: RH | segmentacao: 'todos'
    seedComunicado(
      'RH',
      'Atualização do Calendário de Feriados e Pontes 2026',
      'Informamos o calendário oficial de feriados nacionais, estaduais e dias pontes aprovados pela diretoria para o ano vigente. Consulte no portal ou no mural de avisos.',
      'todos',
      '',
      '2026-04-08 14:30:00.000Z',
    )

    // Category 3: Benefícios | segmentacao: 'todos'
    seedComunicado(
      'Benefícios',
      'Novo Plano Odontológico e Extensão de Cobertura de Saúde',
      'Temos o prazer de anunciar que o plano odontológico agora contempla cobertura ortodôntica integral para todos os colaboradores e dependentes diretos sem custo adicional.',
      'todos',
      '',
      '2026-04-05 11:15:00.000Z',
    )

    // Category 4: Segurança | segmentacao: 'todos'
    seedComunicado(
      'Segurança',
      'Semana Interna de Prevenção de Acidentes do Trabalho (SIPAT)',
      'Estão abertas as inscrições para as palestras e oficinas da SIPAT 2026. Os temas deste ano incluem ergonomia no trabalho híbrido e saúde mental corporativa.',
      'todos',
      '',
      '2026-04-03 10:00:00.000Z',
    )

    // Category 5: Qualidade | segmentacao: 'todos'
    seedComunicado(
      'Qualidade',
      'Certificação ISO 9001: Auditoria de Recertificação Concluída',
      'Concluímos com nota máxima a auditoria externa da ISO 9001. Parabenizamos todos os departamentos pela conformidade dos processos e foco contínuo na excelência.',
      'todos',
      '',
      '2026-03-28 16:45:00.000Z',
    )

    // Category 6: Empresa | segmentacao: 'gestores' (apenas gestor, rh, admin devem ver)
    seedComunicado(
      'Empresa',
      'Alinhamento de Liderança: Ciclo de Avaliação de Desempenho 360°',
      'Prezados gestores e líderes, a abertura do comitê de calibração do ciclo 360° ocorrerá na próxima terça-feira às 14h. Por favor, concluam as avaliações de suas equipes até sexta-feira.',
      'gestores',
      '',
      '2026-04-12 08:30:00.000Z',
    )

    // Category 7: RH | segmentacao: 'setor' -> 'Marketing' (Lucas Ferreira e Roberto Almeida veem; TI/Financeiro não)
    seedComunicado(
      'RH',
      'Workshop de Inteligência Artificial para o Time de Marketing',
      'Treinamento imersivo exclusivo para a equipe de Marketing sobre automação e geração de conteúdo em campanhas multicanais. Início na próxima quinta-feira no auditório central.',
      'setor',
      'Marketing',
      '2026-04-11 13:00:00.000Z',
    )

    // Category 8: Qualidade | segmentacao: 'setor' -> 'TI' (Thiago Ramos vê; Lucas do Marketing não vê)
    seedComunicado(
      'Qualidade',
      'Janela de Manutenção Programada e Migração de Infraestrutura',
      'Aviso ao setor de TI: realizaremos neste sábado a migração dos clusters de banco de dados para nova região de alta disponibilidade. Favor seguir o checklist de contingência.',
      'setor',
      'TI',
      '2026-04-07 18:00:00.000Z',
    )

    // Category 9: Benefícios | segmentacao: 'funcao' -> 'Analista de Marketing Pleno' (apenas essa função)
    seedComunicado(
      'Benefícios',
      'Programa de Certificações e Reembolso Educacional para Analistas',
      'Lembramos que analistas contam com subsídio de até 80% para cursos livres e certificações técnicas reconhecidas pelo setor de Gente e Gestão.',
      'funcao',
      'Analista de Marketing Pleno',
      '2026-04-02 09:30:00.000Z',
    )
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('comunicado')
      app.delete(col)
    } catch (_) {}
  },
)
