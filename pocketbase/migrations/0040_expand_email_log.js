migrate(
  (app) => {
    try {
      const emailLogCol = app.findCollectionByNameOrId('email_log')
      const hasTipoEvento = emailLogCol.fields.find((f) => f.name === 'tipo_evento')
      if (!hasTipoEvento) {
        emailLogCol.fields.add(
          new TextField({
            name: 'tipo_evento',
            required: false,
          }),
        )
      }

      const hasEventoRef = emailLogCol.fields.find((f) => f.name === 'evento_ref')
      if (!hasEventoRef) {
        emailLogCol.fields.add(
          new TextField({
            name: 'evento_ref',
            required: false,
          }),
        )
      }

      app.save(emailLogCol)

      // Adicionar índice para otimizar busca anti-duplicação
      try {
        emailLogCol.addIndex('idx_email_log_anti_spam', false, 'destinatario, assunto, created', '')
        app.save(emailLogCol)
      } catch (idxErr) {
        console.log('Aviso ao adicionar índice idx_email_log_anti_spam:', idxErr)
      }
    } catch (e) {
      console.log('Aviso na migração 0040_expand_email_log:', e)
    }
  },
  (app) => {
    try {
      const emailLogCol = app.findCollectionByNameOrId('email_log')
      try {
        emailLogCol.removeIndex('idx_email_log_anti_spam')
      } catch (_) {}
      emailLogCol.fields.removeByName('tipo_evento')
      emailLogCol.fields.removeByName('evento_ref')
      app.save(emailLogCol)
    } catch (_) {}
  },
)
