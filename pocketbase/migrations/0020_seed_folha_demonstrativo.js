migrate(
  (app) => {
    // 1. Obter tenant principal (Tesla RH Ltda)
    let tenantRecord
    try {
      tenantRecord = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')
    } catch (_) {
      tenantRecord = app.findFirstRecordByData('tenant', 'status', 'ativo')
    }
    const tenantId = tenantRecord.id

    // 2. Obter colaboradores principais
    let lucasColab, robertoColab, marianaColab, thiagoColab
    try {
      lucasColab = app.findFirstRecordByData(
        'colaborador',
        'email',
        'lucas.ferreira@teslarh.com.br',
      )
    } catch (_) {
      try {
        lucasColab = app.findFirstRecordByData('colaborador', 'nome', 'Lucas Ferreira')
      } catch (_) {}
    }

    try {
      robertoColab = app.findFirstRecordByData('colaborador', 'nome', 'Roberto Almeida')
    } catch (_) {}

    try {
      marianaColab = app.findFirstRecordByData('colaborador', 'nome', 'Mariana Silva')
    } catch (_) {}

    try {
      thiagoColab = app.findFirstRecordByData('colaborador', 'nome', 'Thiago Ramos')
    } catch (_) {}

    const perCol = app.findCollectionByNameOrId('lancamento_periodico')
    const pontCol = app.findCollectionByNameOrId('lancamento_pontual')

    // Helper para criar lançamento periódico caso não exista com o mesmo descritivo para o colaborador
    const criarPeriodico = (
      colab,
      descritivo,
      qtd,
      periodicidade,
      recorrenciaDia,
      vigIni,
      vigFim,
    ) => {
      if (!colab) return
      try {
        const existente = app.findRecordsByFilter(
          'lancamento_periodico',
          `colaborador_id = '${colab.id}' && descritivo = '${descritivo}'`,
          '-created',
          1,
          0,
        )
        if (existente && existente.length > 0) return
      } catch (_) {}

      const r = new Record(perCol)
      r.set('tenant_id', tenantId)
      r.set('colaborador_id', colab.id)
      r.set('descritivo', descritivo)
      r.set('quantidade', qtd)
      r.set('periodicidade', periodicidade)
      r.set('data_recorrencia', recorrenciaDia)
      r.set('data_inicio_vigencia', vigIni)
      if (vigFim) {
        r.set('data_fim_vigencia', vigFim)
      }
      app.save(r)
    }

    // Helper para criar lançamento pontual caso não exista com mesma data e descritivo
    const criarPontual = (colab, descritivo, qtd, dataStr, comentario) => {
      if (!colab) return
      try {
        const existente = app.findRecordsByFilter(
          'lancamento_pontual',
          `colaborador_id = '${colab.id}' && descritivo = '${descritivo}' && data = '${dataStr}'`,
          '-created',
          1,
          0,
        )
        if (existente && existente.length > 0) return
      } catch (_) {}

      const r = new Record(pontCol)
      r.set('tenant_id', tenantId)
      r.set('colaborador_id', colab.id)
      r.set('descritivo', descritivo)
      r.set('quantidade', qtd)
      r.set('data', dataStr)
      if (comentario) {
        r.set('comentario', comentario)
      }
      app.save(r)
    }

    // 3. SEED PARA LUCAS FERREIRA (Analista de Marketing)
    if (lucasColab) {
      // 3.1 Periódicos Ativos:
      // Remuneração mensal: R$ 6.200,00 (dia 5 de cada mês, vigente desde 2024-01-01)
      criarPeriodico(
        lucasColab,
        'Remuneração Mensal',
        6200.0,
        'mensal',
        5,
        '2024-01-01 00:00:00.000Z',
        null,
      )

      // Adiantamento Salarial: R$ 2.480,00 (dia 20 de cada mês, vigente desde 2024-01-01)
      criarPeriodico(
        lucasColab,
        'Adiantamento Salarial (40%)',
        2480.0,
        'mensal',
        20,
        '2024-01-01 00:00:00.000Z',
        null,
      )

      // Vale Transporte (desconto): -R$ 372,00 (dia 5 de cada mês, vigente desde 2024-01-01)
      criarPeriodico(
        lucasColab,
        'Vale Transporte (desconto 6%)',
        -372.0,
        'mensal',
        5,
        '2024-01-01 00:00:00.000Z',
        null,
      )

      // 3.2 Periódico com VIGÊNCIA ENCERRADA (requisito explícito do usuário para demonstrar regra de validação)
      // "Ajuda de Custo Home Office Temporária": R$ 350,00, vigente de 2025-01-01 a 2025-12-31
      criarPeriodico(
        lucasColab,
        'Ajuda de Custo Home Office (Encerrada)',
        350.0,
        'mensal',
        10,
        '2025-01-01 00:00:00.000Z',
        '2025-12-31 23:59:59.000Z',
      )

      // 3.3 Lançamentos Pontuais do Mês Atual (Setembro 2026) e Mês Anterior (Agosto 2026)
      // Mês Atual (Setembro/2026):
      // Provento pontual: Horas Noturnas (R$ 480,00) em 2026-09-04
      criarPontual(
        lucasColab,
        'Horas Noturnas - Campanha Q3',
        480.0,
        '2026-09-04 00:00:00.000Z',
        '16 horas noturnas durante fechamento de campanha',
      )
      // Provento pontual: Auxílio-Alimentação Extraordinário (R$ 250,00) em 2026-09-05
      criarPontual(
        lucasColab,
        'Auxílio-Alimentação Extraordinário',
        250.0,
        '2026-09-05 00:00:00.000Z',
        'Cota especial de alimentação para sprint presencial',
      )
      // Desconto pontual: Desconto por Falta Injustificada (-R$ 206,67) em 2026-09-08
      criarPontual(
        lucasColab,
        'Desconto por Falta',
        -206.67,
        '2026-09-08 00:00:00.000Z',
        '1 dia de falta sem apresentação tempestiva de atestado',
      )

      // Mês Anterior (Agosto/2026):
      // Provento: Comissão por Conversão de Leads (R$ 1.150,00) em 2026-08-20
      criarPontual(
        lucasColab,
        'Comissão de Performance',
        1150.0,
        '2026-08-20 00:00:00.000Z',
        'Atingimento de 125% da meta de leads qualificados no mês de Julho',
      )
      // Desconto: Coparticipação Plano de Saúde (-R$ 145,50) em 2026-08-15
      criarPontual(
        lucasColab,
        'Coparticipação Plano de Saúde',
        -145.5,
        '2026-08-15 00:00:00.000Z',
        'Consultas eletivas e exames realizados em Julho/2026',
      )
    }

    // 4. SEED PARA ROBERTO ALMEIDA (Gerente de Marketing)
    if (robertoColab) {
      criarPeriodico(
        robertoColab,
        'Remuneração Mensal',
        14500.0,
        'mensal',
        5,
        '2023-01-01 00:00:00.000Z',
        null,
      )
      criarPeriodico(
        robertoColab,
        'Gratificação de Função',
        2500.0,
        'mensal',
        5,
        '2023-01-01 00:00:00.000Z',
        null,
      )
      criarPeriodico(
        robertoColab,
        'Desconto Seguro Vida Executivo',
        -180.0,
        'mensal',
        5,
        '2023-01-01 00:00:00.000Z',
        null,
      )
      criarPontual(
        robertoColab,
        'Bônus Trimestral Q2',
        4000.0,
        '2026-08-10 00:00:00.000Z',
        'Atingimento de OKRs de crescimento de vendas do Q2',
      )
    }

    // 5. SEED PARA MARIANA SILVA (Especialista em RH)
    if (marianaColab) {
      criarPeriodico(
        marianaColab,
        'Remuneração Mensal',
        8800.0,
        'mensal',
        5,
        '2024-01-01 00:00:00.000Z',
        null,
      )
      criarPeriodico(
        marianaColab,
        'Vale Refeição (Coparticipação)',
        -120.0,
        'mensal',
        5,
        '2024-01-01 00:00:00.000Z',
        null,
      )
      criarPontual(
        marianaColab,
        'Reembolso de Curso - Gestão Ágil',
        650.0,
        '2026-09-02 00:00:00.000Z',
        'Reembolso de capacitação aprovado pela diretoria',
      )
    }

    // 6. SEED PARA THIAGO RAMOS (Engenheiro de Software)
    if (thiagoColab) {
      criarPeriodico(
        thiagoColab,
        'Remuneração Mensal',
        9500.0,
        'mensal',
        5,
        '2024-06-01 00:00:00.000Z',
        null,
      )
      criarPeriodico(
        thiagoColab,
        'Auxílio Conectividade',
        200.0,
        'mensal',
        5,
        '2024-06-01 00:00:00.000Z',
        null,
      )
      criarPontual(
        thiagoColab,
        'Sobreaviso Plantão TI',
        800.0,
        '2026-09-06 00:00:00.000Z',
        'Final de semana de plantão para migração de servidores',
      )
    }
  },
  (app) => {
    // Reverter seed é opcional
  },
)
