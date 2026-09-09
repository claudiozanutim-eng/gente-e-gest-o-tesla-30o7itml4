migrate(
  (app) => {
    // 1. Obter tenant principal ("Tesla RH Ltda")
    let tenant
    try {
      tenant = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')
    } catch (_) {
      try {
        const records = app.findRecordsByFilter('tenant', "status = 'ativo'", '', 1, 0)
        if (records.length > 0) tenant = records[0]
      } catch (_) {}
    }

    if (!tenant) return

    const tenantId = tenant.id

    // 2. Localizar colaboradores essenciais
    // Lucas Ferreira (colaborador avaliado)
    let lucas, roberto, mariana, claudio, beatriz, thiago
    try {
      lucas = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')
    } catch (_) {}

    // Roberto Almeida (gestor - avaliador principal)
    try {
      roberto = app.findFirstRecordByData('colaborador', 'cpf', '193.482.019-12')
    } catch (_) {}

    // Mariana Silva (RH - avaliador apoio)
    try {
      mariana = app.findFirstRecordByData('colaborador', 'cpf', '392.184.726-55')
    } catch (_) {}

    // Cláudio Zanutim (Diretor/Admin - avaliador apoio opcional)
    try {
      claudio = app.findFirstRecordByData('colaborador', 'cpf', '049.281.938-71')
    } catch (_) {}

    // Beatriz Souza (Analista Financeiro)
    try {
      beatriz = app.findFirstRecordByData('colaborador', 'cpf', '512.930.129-88')
    } catch (_) {}

    // Thiago Ramos (Engenheiro de Software)
    try {
      thiago = app.findFirstRecordByData('colaborador', 'cpf', '671.203.491-30')
    } catch (_) {}

    if (!lucas || !roberto || !mariana) return

    const cicloCol = app.findCollectionByNameOrId('ciclo_avaliacao')
    const compCol = app.findCollectionByNameOrId('competencia')
    const avalCol = app.findCollectionByNameOrId('avaliacao')
    const notaCol = app.findCollectionByNameOrId('nota_competencia')

    // 3. Cadastrar Competências Gerais e Específicas
    const competenciasData = [
      {
        nome: 'Comunicação Assertiva e Feedback',
        tipo: 'geral',
        peso: 20,
        nota_esperada: 4.0,
        descricao:
          'Capacidade de transmitir ideias com clareza, objetividade e empatia entre times.',
      },
      {
        nome: 'Trabalho em Equipe e Colaboração',
        tipo: 'geral',
        peso: 20,
        nota_esperada: 4.0,
        descricao: 'Atuação integrada, respeito à diversidade de opiniões e apoio mútuo.',
      },
      {
        nome: 'Foco em Resultados e Entrega de Valor',
        tipo: 'geral',
        peso: 25,
        nota_esperada: 4.0,
        descricao: 'Compromisso com prazos, metas corporativas e superação de expectativas.',
      },
      {
        nome: 'Resolução de Problemas e Proatividade',
        tipo: 'especifica',
        peso: 20,
        nota_esperada: 3.8,
        descricao:
          'Agilidade diagnóstica para encontrar soluções práticas para desafios cotidianos.',
      },
      {
        nome: 'Inovação e Melhoria Contínua',
        tipo: 'especifica',
        peso: 15,
        nota_esperada: 3.5,
        descricao: 'Disposição para propor melhorias em processos e adoção de novas tecnologias.',
      },
    ]

    const competenciasMap = {}
    for (const item of competenciasData) {
      let compRec
      try {
        const existing = app.findRecordsByFilter(
          'competencia',
          `tenant_id = '${tenantId}' && nome = '${item.nome}'`,
          '',
          1,
          0,
        )
        if (existing.length > 0) {
          compRec = existing[0]
        }
      } catch (_) {}

      if (!compRec) {
        compRec = new Record(compCol)
        compRec.set('tenant_id', tenantId)
        compRec.set('nome', item.nome)
        compRec.set('tipo', item.tipo)
        compRec.set('peso', item.peso)
        compRec.set('nota_esperada', item.nota_esperada)
        compRec.set('descricao', item.descricao)
        app.save(compRec)
      }
      competenciasMap[item.nome] = compRec
    }

    // 4. Criar Ciclo Concluído: "Ciclo 2025.2 — Avaliação Semestral de Desempenho"
    let cicloConcluido
    try {
      const existing = app.findRecordsByFilter(
        'ciclo_avaliacao',
        `tenant_id = '${tenantId}' && nome = 'Ciclo 2025.2 — Avaliação Semestral de Desempenho'`,
        '',
        1,
        0,
      )
      if (existing.length > 0) {
        cicloConcluido = existing[0]
      }
    } catch (_) {}

    if (!cicloConcluido) {
      cicloConcluido = new Record(cicloCol)
      cicloConcluido.set('tenant_id', tenantId)
      cicloConcluido.set('nome', 'Ciclo 2025.2 — Avaliação Semestral de Desempenho')
      cicloConcluido.set('data_inicio', '2025-07-01 00:00:00.000Z')
      cicloConcluido.set('data_fim', '2025-12-15 00:00:00.000Z')
      cicloConcluido.set('status', 'concluido')
      app.save(cicloConcluido)
    }

    // 5. Criar Ciclo Em Andamento: "Ciclo 2026.1 — Avaliação Anual de Metas & Competências"
    let cicloEmAndamento
    try {
      const existing = app.findRecordsByFilter(
        'ciclo_avaliacao',
        `tenant_id = '${tenantId}' && nome = 'Ciclo 2026.1 — Avaliação Anual de Metas & Competências'`,
        '',
        1,
        0,
      )
      if (existing.length > 0) {
        cicloEmAndamento = existing[0]
      }
    } catch (_) {}

    if (!cicloEmAndamento) {
      cicloEmAndamento = new Record(cicloCol)
      cicloEmAndamento.set('tenant_id', tenantId)
      cicloEmAndamento.set('nome', 'Ciclo 2026.1 — Avaliação Anual de Metas & Competências')
      cicloEmAndamento.set('data_inicio', '2026-01-10 00:00:00.000Z')
      cicloEmAndamento.set('data_fim', '2026-06-30 00:00:00.000Z')
      cicloEmAndamento.set('status', 'em_andamento')
      app.save(cicloEmAndamento)
    }

    // 6. Popular Avaliações do Ciclo Concluído (demonstração completa para Lucas Ferreira)
    // Avaliador Principal: Roberto Almeida (Gestor) - Peso 60%
    // Avaliador Apoio 1: Mariana Silva (RH) - Peso 20%
    // Avaliador Apoio 2: Cláudio Zanutim (Diretor) - Peso 20% (soma apoios = 40% ou 30% conforme spec: Principal 60%, Apoio 1 15%, Apoio 2 15% -> 30% somado)
    // De acordo com o spec de exemplo do usuário:
    // "Principal (nota 4.0 × 0.60) + Apoio 1 (5.0 × 0.15) + Apoio 2 (3.0 × 0.15) = 3.60" (com 2 apoios de 15% cada = 30% somado)
    let avalLucasPrincipal
    try {
      const existing = app.findRecordsByFilter(
        'avaliacao',
        `ciclo_id = '${cicloConcluido.id}' && colaborador_id = '${lucas.id}' && avaliador_id = '${roberto.id}'`,
        '',
        1,
        0,
      )
      if (existing.length > 0) avalLucasPrincipal = existing[0]
    } catch (_) {}

    if (!avalLucasPrincipal) {
      avalLucasPrincipal = new Record(avalCol)
      avalLucasPrincipal.set('ciclo_id', cicloConcluido.id)
      avalLucasPrincipal.set('colaborador_id', lucas.id)
      avalLucasPrincipal.set('avaliador_id', roberto.id)
      avalLucasPrincipal.set('tipo_avaliador', 'principal')
      avalLucasPrincipal.set('peso', 0.6) // 60%
      avalLucasPrincipal.set('status', 'concluida')
      avalLucasPrincipal.set('nota_final', 4.0)
      avalLucasPrincipal.set('data_avaliacao', '2025-11-20 00:00:00.000Z')
      avalLucasPrincipal.set(
        'comentario',
        'Lucas demonstrou excelente liderança técnica nas campanhas e grande alinhamento com os objetivos da equipe de Marketing.',
      )
      app.save(avalLucasPrincipal)

      // Notas por competência do Gestor Roberto para Lucas (Média = 4.0)
      const notasPrincipal = [
        { comp: 'Comunicação Assertiva e Feedback', nota: 4.2 },
        { comp: 'Trabalho em Equipe e Colaboração', nota: 4.0 },
        { comp: 'Foco em Resultados e Entrega de Valor', nota: 4.5 },
        { comp: 'Resolução de Problemas e Proatividade', nota: 3.8 },
        { comp: 'Inovação e Melhoria Contínua', nota: 3.5 },
      ]
      for (const n of notasPrincipal) {
        const c = competenciasMap[n.comp]
        if (c) {
          const recNota = new Record(notaCol)
          recNota.set('avaliacao_id', avalLucasPrincipal.id)
          recNota.set('competencia_id', c.id)
          recNota.set('nota', n.nota)
          recNota.set('comentario', 'Excelente desempenho demonstrado no período avaliado.')
          app.save(recNota)
        }
      }
    }

    // Avaliador Apoio 1: Mariana Silva (RH) - Peso 15% (Média 4.6)
    let avalLucasApoio1
    try {
      const existing = app.findRecordsByFilter(
        'avaliacao',
        `ciclo_id = '${cicloConcluido.id}' && colaborador_id = '${lucas.id}' && avaliador_id = '${mariana.id}'`,
        '',
        1,
        0,
      )
      if (existing.length > 0) avalLucasApoio1 = existing[0]
    } catch (_) {}

    if (!avalLucasApoio1) {
      avalLucasApoio1 = new Record(avalCol)
      avalLucasApoio1.set('ciclo_id', cicloConcluido.id)
      avalLucasApoio1.set('colaborador_id', lucas.id)
      avalLucasApoio1.set('avaliador_id', mariana.id)
      avalLucasApoio1.set('tipo_avaliador', 'apoio')
      avalLucasApoio1.set('peso', 0.15) // 15%
      avalLucasApoio1.set('status', 'concluida')
      avalLucasApoio1.set('nota_final', 4.6)
      avalLucasApoio1.set('data_avaliacao', '2025-11-22 00:00:00.000Z')
      avalLucasApoio1.set(
        'comentario',
        'Muito pontual e prestativo com as rotinas do Gente e Gestão, sempre colaborativo nos eventos internos.',
      )
      app.save(avalLucasApoio1)

      const notasApoio1 = [
        { comp: 'Comunicação Assertiva e Feedback', nota: 4.5 },
        { comp: 'Trabalho em Equipe e Colaboração', nota: 4.8 },
        { comp: 'Foco em Resultados e Entrega de Valor', nota: 4.7 },
        { comp: 'Resolução de Problemas e Proatividade', nota: 4.5 },
        { comp: 'Inovação e Melhoria Contínua', nota: 4.5 },
      ]
      for (const n of notasApoio1) {
        const c = competenciasMap[n.comp]
        if (c) {
          const recNota = new Record(notaCol)
          recNota.set('avaliacao_id', avalLucasApoio1.id)
          recNota.set('competencia_id', c.id)
          recNota.set('nota', n.nota)
          recNota.set('comentario', 'Visão comportamental consistente com a cultura da empresa.')
          app.save(recNota)
        }
      }
    }

    // Avaliador Apoio 2: Cláudio Zanutim (Diretor) - Peso 15% (Média 3.8)
    if (claudio) {
      let avalLucasApoio2
      try {
        const existing = app.findRecordsByFilter(
          'avaliacao',
          `ciclo_id = '${cicloConcluido.id}' && colaborador_id = '${lucas.id}' && avaliador_id = '${claudio.id}'`,
          '',
          1,
          0,
        )
        if (existing.length > 0) avalLucasApoio2 = existing[0]
      } catch (_) {}

      if (!avalLucasApoio2) {
        avalLucasApoio2 = new Record(avalCol)
        avalLucasApoio2.set('ciclo_id', cicloConcluido.id)
        avalLucasApoio2.set('colaborador_id', lucas.id)
        avalLucasApoio2.set('avaliador_id', claudio.id)
        avalLucasApoio2.set('tipo_avaliador', 'apoio')
        avalLucasApoio2.set('peso', 0.15) // 15%
        avalLucasApoio2.set('status', 'concluida')
        avalLucasApoio2.set('nota_final', 3.8)
        avalLucasApoio2.set('data_avaliacao', '2025-11-25 00:00:00.000Z')
        avalLucasApoio2.set(
          'comentario',
          'Colaborador com grande potencial estratégico e bom foco nas métricas executivas.',
        )
        app.save(avalLucasApoio2)

        const notasApoio2 = [
          { comp: 'Comunicação Assertiva e Feedback', nota: 3.8 },
          { comp: 'Trabalho em Equipe e Colaboração', nota: 4.0 },
          { comp: 'Foco em Resultados e Entrega de Valor', nota: 4.2 },
          { comp: 'Resolução de Problemas e Proatividade', nota: 3.5 },
          { comp: 'Inovação e Melhoria Contínua', nota: 3.5 },
        ]
        for (const n of notasApoio2) {
          const c = competenciasMap[n.comp]
          if (c) {
            const recNota = new Record(notaCol)
            recNota.set('avaliacao_id', avalLucasApoio2.id)
            recNota.set('competencia_id', c.id)
            recNota.set('nota', n.nota)
            app.save(recNota)
          }
        }
      }
    }

    // Avaliação no Ciclo Concluído para Beatriz Souza (Financeiro)
    if (beatriz) {
      let avalBeatriz
      try {
        const existing = app.findRecordsByFilter(
          'avaliacao',
          `ciclo_id = '${cicloConcluido.id}' && colaborador_id = '${beatriz.id}'`,
          '',
          1,
          0,
        )
        if (existing.length > 0) avalBeatriz = existing[0]
      } catch (_) {}

      if (!avalBeatriz) {
        avalBeatriz = new Record(avalCol)
        avalBeatriz.set('ciclo_id', cicloConcluido.id)
        avalBeatriz.set('colaborador_id', beatriz.id)
        avalBeatriz.set('avaliador_id', roberto.id)
        avalBeatriz.set('tipo_avaliador', 'principal')
        avalBeatriz.set('peso', 0.7)
        avalBeatriz.set('status', 'concluida')
        avalBeatriz.set('nota_final', 4.4)
        avalBeatriz.set('data_avaliacao', '2025-11-28 00:00:00.000Z')
        avalBeatriz.set(
          'comentario',
          'Excelente acurácia nas análises financeiras e orçamentos corporativos.',
        )
        app.save(avalBeatriz)

        for (const cName of Object.keys(competenciasMap)) {
          const c = competenciasMap[cName]
          const recNota = new Record(notaCol)
          recNota.set('avaliacao_id', avalBeatriz.id)
          recNota.set('competencia_id', c.id)
          recNota.set('nota', 4.4)
          app.save(recNota)
        }
      }
    }

    // 7. Popular Avaliações no Ciclo Em Andamento (Pendentes de avaliação para a tela "Minha Equipe")
    // Roberto Almeida avalia Lucas Ferreira (Pendente)
    let avalLucasPendente
    try {
      const existing = app.findRecordsByFilter(
        'avaliacao',
        `ciclo_id = '${cicloEmAndamento.id}' && colaborador_id = '${lucas.id}' && avaliador_id = '${roberto.id}'`,
        '',
        1,
        0,
      )
      if (existing.length > 0) avalLucasPendente = existing[0]
    } catch (_) {}

    if (!avalLucasPendente) {
      avalLucasPendente = new Record(avalCol)
      avalLucasPendente.set('ciclo_id', cicloEmAndamento.id)
      avalLucasPendente.set('colaborador_id', lucas.id)
      avalLucasPendente.set('avaliador_id', roberto.id)
      avalLucasPendente.set('tipo_avaliador', 'principal')
      avalLucasPendente.set('peso', 0.6)
      avalLucasPendente.set('status', 'pendente')
      app.save(avalLucasPendente)
    }

    // Apoio Mariana Silva para Lucas no ciclo em andamento (Pendente)
    let avalMarianaPendente
    try {
      const existing = app.findRecordsByFilter(
        'avaliacao',
        `ciclo_id = '${cicloEmAndamento.id}' && colaborador_id = '${lucas.id}' && avaliador_id = '${mariana.id}'`,
        '',
        1,
        0,
      )
      if (existing.length > 0) avalMarianaPendente = existing[0]
    } catch (_) {}

    if (!avalMarianaPendente) {
      avalMarianaPendente = new Record(avalCol)
      avalMarianaPendente.set('ciclo_id', cicloEmAndamento.id)
      avalMarianaPendente.set('colaborador_id', lucas.id)
      avalMarianaPendente.set('avaliador_id', mariana.id)
      avalMarianaPendente.set('tipo_avaliador', 'apoio')
      avalMarianaPendente.set('peso', 0.3)
      avalMarianaPendente.set('status', 'pendente')
      app.save(avalMarianaPendente)
    }

    // Roberto Almeida avalia Thiago Ramos (TI) no ciclo em andamento (Pendente)
    if (thiago) {
      let avalThiagoPendente
      try {
        const existing = app.findRecordsByFilter(
          'avaliacao',
          `ciclo_id = '${cicloEmAndamento.id}' && colaborador_id = '${thiago.id}' && avaliador_id = '${roberto.id}'`,
          '',
          1,
          0,
        )
        if (existing.length > 0) avalThiagoPendente = existing[0]
      } catch (_) {}

      if (!avalThiagoPendente) {
        avalThiagoPendente = new Record(avalCol)
        avalThiagoPendente.set('ciclo_id', cicloEmAndamento.id)
        avalThiagoPendente.set('colaborador_id', thiago.id)
        avalThiagoPendente.set('avaliador_id', roberto.id)
        avalThiagoPendente.set('tipo_avaliador', 'principal')
        avalThiagoPendente.set('peso', 0.7)
        avalThiagoPendente.set('status', 'pendente')
        app.save(avalThiagoPendente)
      }
    }
  },
  (app) => {
    // Reverter seeds de avaliação se necessário
  },
)
