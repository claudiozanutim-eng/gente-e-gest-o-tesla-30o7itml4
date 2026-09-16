migrate(
  (app) => {
    // Tornar o campo user_id em log_auditoria opcional (required: false) e manter cascadeDelete: false
    // para que a exclusão de um usuário não seja bloqueada por logs de auditoria e nem
    // apague os logs de auditoria (preservando o histórico).
    const auditCol = app.findCollectionByNameOrId('log_auditoria')
    const userIdField = auditCol.fields.getByName('user_id')
    if (userIdField) {
      userIdField.required = false
      app.save(auditCol)
    }

    // Tornar atualizado_por em permissao_usuario cascadeDelete: false e opcional (se já não for)
    const permCol = app.findCollectionByNameOrId('permissao_usuario')
    const atualizadoPorField = permCol.fields.getByName('atualizado_por')
    if (atualizadoPorField) {
      atualizadoPorField.required = false
      app.save(permCol)
    }
  },
  (app) => {
    try {
      const auditCol = app.findCollectionByNameOrId('log_auditoria')
      const userIdField = auditCol.fields.getByName('user_id')
      if (userIdField) {
        userIdField.required = true
        app.save(auditCol)
      }
    } catch (_) {}
  },
)
