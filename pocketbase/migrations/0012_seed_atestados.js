migrate(
  (app) => {
    try {
      const atestadoCol = app.findCollectionByNameOrId('atestado')
      const tenantCol = app.findCollectionByNameOrId('tenant')
      const lucas = app.findFirstRecordByData('colaborador', 'cpf', '284.912.839-44')

      if (!lucas) {
        console.log('Lucas Ferreira não encontrado para seed de atestados.')
        return
      }

      const tenantId = lucas.getString('tenant_id') || tenantCol.id

      // Seed 4 atestados com diferentes status para mostrar todos os badges:
      // Amarelo #FBC02D = "recebido"
      // Azul #1976D2 = "em_analise"
      // Verde #388E3C = "validado"
      // Vermelho #D32F2F = "necessita_correcao"

      const seeds = [
        {
          data_inicio: '2026-03-02 00:00:00.000Z',
          qtd_dias: 2,
          status: 'recebido',
          data_envio: '2026-03-02 08:30:00.000Z',
          comentario_rh: '',
          data_resposta: '',
          anexo_url: 'https://img.usecurling.com/p/800/1000?q=medical+certificate+document',
        },
        {
          data_inicio: '2026-02-18 00:00:00.000Z',
          qtd_dias: 3,
          status: 'em_analise',
          data_envio: '2026-02-18 09:15:00.000Z',
          comentario_rh: 'Em análise pelo departamento médico da empresa.',
          data_resposta: '',
          anexo_url: 'https://img.usecurling.com/p/800/1000?q=medical+prescription+report',
        },
        {
          data_inicio: '2026-01-12 00:00:00.000Z',
          qtd_dias: 1,
          status: 'validado',
          data_envio: '2026-01-12 10:00:00.000Z',
          comentario_rh: 'Atestado homologado com sucesso pelo RH.',
          data_resposta: '2026-01-12 14:20:00.000Z',
          anexo_url: 'https://img.usecurling.com/p/800/1000?q=doctor+note+signed',
        },
        {
          data_inicio: '2026-02-05 00:00:00.000Z',
          qtd_dias: 5,
          status: 'necessita_correcao',
          data_envio: '2026-02-05 11:45:00.000Z',
          comentario_rh:
            'O CRM do médico emissor e o carimbo estão ilegíveis na foto. Por favor, reenvie uma foto mais nítida ou o arquivo em PDF original.',
          data_resposta: '2026-02-06 09:10:00.000Z',
          anexo_url: 'https://img.usecurling.com/p/800/1000?q=medical+form+document',
        },
      ]

      for (const s of seeds) {
        // Verificar se já existe atestado para o Lucas com mesma data_inicio para idempotência
        try {
          app.findFirstRecordByData('atestado', 'data_inicio', s.data_inicio)
          continue // já existe
        } catch (_) {}

        const record = new Record(atestadoCol)
        record.set('tenant_id', tenantId)
        record.set('colaborador_id', lucas.id)
        record.set('data_inicio', s.data_inicio)
        record.set('qtd_dias', s.qtd_dias)
        record.set('status', s.status)
        record.set('data_envio', s.data_envio)
        record.set('comentario_rh', s.comentario_rh)
        if (s.data_resposta) {
          record.set('data_resposta', s.data_resposta)
        }
        record.set('anexo_url', s.anexo_url)
        app.save(record)
      }
    } catch (err) {
      console.log('Erro ao semear atestados:', err)
    }
  },
  (app) => {
    // Reversão limpa
    try {
      const records = app.findRecordsByFilter('atestado', "id != ''", 'created', 100, 0)
      for (const rec of records) {
        app.delete(rec)
      }
    } catch (_) {}
  },
)
