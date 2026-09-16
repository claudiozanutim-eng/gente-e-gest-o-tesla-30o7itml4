migrate(
  (app) => {
    // Permitir que admin_rh também liste/atualize usuários do mesmo tenant (necessário para a tela /admin/usuarios)
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    usersCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin' || @request.auth.perfil = 'admin_rh')"
    usersCol.updateRule =
      "@request.auth.id != '' && ((tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin' || @request.auth.perfil = 'admin_rh')) || id = @request.auth.id)"
    app.save(usersCol)
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.createRule = "@request.auth.id != '' && @request.auth.perfil = 'admin'"
      usersCol.updateRule =
        "@request.auth.id != '' && ((tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin') || id = @request.auth.id)"
      app.save(usersCol)
    } catch (_) {}
  },
)
