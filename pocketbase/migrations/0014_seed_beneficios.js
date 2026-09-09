migrate(
  (app) => {
    try {
      const beneficioCol = app.findCollectionByNameOrId('beneficio')
      const colabBeneficioCol = app.findCollectionByNameOrId('colaborador_beneficio')
      const tenantCol = app.findCollectionByNameOrId('tenant')
      const lucas = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')

      if (!lucas) {
        console.log('Lucas Ferreira não encontrado para seed de benefícios.')
        return
      }

      const tenantId = lucas.getString('tenant_id') || tenantCol.id

      // 1. Criar os 6 tipos de benefícios para o tenant caso não existam
      const tiposDefinidos = [
        {
          tipo: 'vt',
          descricao:
            'Vale Transporte - Auxílio deslocamento residência/trabalho conforme legislação',
        },
        {
          tipo: 'vr',
          descricao:
            'Vale Refeição - Cartão Flash para alimentação e refeições diárias em restaurantes',
        },
        {
          tipo: 'va',
          descricao: 'Vale Alimentação - Cartão Flash para compras em supermercados e mercearias',
        },
        {
          tipo: 'plano_saude',
          descricao:
            'Plano de Saúde Corporativo Bradesco Saúde - Cobertura Nacional e Hospitais de Referência',
        },
        {
          tipo: 'seguro_vida',
          descricao:
            'Seguro de Vida em Grupo MetLife - Cobertura integral por invalidez ou morte acidental',
        },
        {
          tipo: 'plano_odonto',
          descricao:
            'Plano Odontológico OdontoPrev Dental - Tratamentos gerais, ortodontia e emergência 24h',
        },
      ]

      const beneficioMap = {}

      for (const item of tiposDefinidos) {
        let rec
        try {
          // Busca benefício do tenant pelo tipo
          const existing = app.findRecordsByFilter(
            'beneficio',
            `tenant_id = "${tenantId}" && tipo = "${item.tipo}"`,
            'created',
            1,
            0,
          )
          if (existing.length > 0) {
            rec = existing[0]
          }
        } catch (_) {}

        if (!rec) {
          rec = new Record(beneficioCol)
          rec.set('tenant_id', tenantId)
          rec.set('tipo', item.tipo)
          rec.set('descricao', item.descricao)
          app.save(rec)
        }

        beneficioMap[item.tipo] = rec.id
      }

      // 2. Vincular os benefícios de demonstração para Lucas Ferreira
      // cobrindo todos os tipos, com detalhes_json preenchidos
      const vinculosLucas = [
        {
          tipo: 'vt',
          valor: 340.0,
          detalhes_json: {
            tipo_transporte: 'Metrô e Ônibus SPTrans',
            numero_cartao: '9821.4402.1902.8821',
            dias_uteis: 22,
            tarifa_diaria: 15.45,
            linha_habitual: 'Linha 2-Verde (Metrô) + Linha 1-Azul',
          },
        },
        {
          tipo: 'vr',
          valor: 880.0,
          detalhes_json: {
            bandeira: 'Flash Benefícios (Mastercard Flex)',
            valor_diario: 40.0,
            dias_uteis: 22,
            cartao_final: '4091',
            recarga_dia: '1º dia útil de cada mês',
          },
        },
        {
          tipo: 'va',
          valor: 550.0,
          detalhes_json: {
            bandeira: 'Flash Supermercados',
            cartao_final: '4091',
            recarga_dia: '1º dia útil de cada mês',
            cobertura: 'Supermercados, feiras e empórios',
          },
        },
        {
          tipo: 'plano_saude',
          valor: 780.0,
          detalhes_json: {
            operadora: 'Bradesco Saúde',
            plano: 'Top Nacional Plus - Quarto Individual',
            carteirinha: '892.401.829.102.001-4',
            acomodacao: 'Apartamento Individual',
            abrangencia: 'Nacional com Reembolso Livre',
            rede_credenciada:
              'Hospital Israelita Albert Einstein, Sírio-Libanês, Samaritano, Nove de Julho, Laboratórios Fleury e Delboni Auriemo',
            carencia_restante: 'Sem carências (isenção total)',
            contato_emergencia: '0800 701 2700',
            dependentes_inclusos: ['Beatriz Ferreira (Cônjuge)'],
          },
        },
        {
          tipo: 'seguro_vida',
          valor: 120.0,
          detalhes_json: {
            seguradora: 'MetLife Seguros',
            apolice: 'AP-TESLA-89210-SP',
            valor_cobertura: 250000.0, // R$ 250.000,00
            documento_beneficiario_url:
              'https://img.usecurling.com/p/800/1000?q=insurance+policy+contract+certificate',
            documento_beneficiario_nome: 'Termo_Designacao_Beneficiarios_LucasFerreira.pdf',
            cobertura_morte: 'R$ 250.000,00',
            cobertura_invalidez: 'R$ 250.000,00',
            assistencia_funeral: 'R$ 10.000,00 (Familiar integral)',
          },
        },
        {
          tipo: 'plano_odonto',
          valor: 65.0,
          detalhes_json: {
            operadora: 'OdontoPrev',
            plano: 'Dental Master Premium',
            carteirinha: 'OP-491.029.381-00',
            abrangencia: 'Nacional',
            rede_credenciada:
              'Rede OdontoPrev Credenciada Nacional (Mais de 28 mil dentistas e clínicas)',
            atendimento_urgencia: 'Pronto Atendimento 24h em todas as capitais',
          },
        },
      ]

      for (const vinculo of vinculosLucas) {
        const beneficioId = beneficioMap[vinculo.tipo]
        if (!beneficioId) continue

        // Verificar se já existe vínculo
        try {
          const existing = app.findRecordsByFilter(
            'colaborador_beneficio',
            `colaborador_id = "${lucas.id}" && beneficio_id = "${beneficioId}"`,
            'created',
            1,
            0,
          )
          if (existing.length > 0) {
            continue // já existe
          }
        } catch (_) {}

        const rec = new Record(colabBeneficioCol)
        rec.set('tenant_id', tenantId)
        rec.set('colaborador_id', lucas.id)
        rec.set('beneficio_id', beneficioId)
        rec.set('valor', vinculo.valor)
        rec.set('detalhes_json', vinculo.detalhes_json)
        app.save(rec)
      }
    } catch (err) {
      console.log('Erro ao semear benefícios:', err)
    }
  },
  (app) => {
    try {
      const records = app.findRecordsByFilter(
        'colaborador_beneficio',
        "id != ''",
        'created',
        100,
        0,
      )
      for (const rec of records) {
        app.delete(rec)
      }
    } catch (_) {}

    try {
      const records = app.findRecordsByFilter('beneficio', "id != ''", 'created', 100, 0)
      for (const rec of records) {
        app.delete(rec)
      }
    } catch (_) {}
  },
)
