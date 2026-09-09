// Invite user hook for admin
routerAdd(
  'POST',
  '/backend/v1/custom/invite-user',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { message: 'Não autorizado' })
    }

    // Check if user is admin
    const perfil = authRecord.getString('perfil')
    const tenantId = authRecord.getString('tenant_id')
    if (perfil !== 'admin') {
      return e.json(403, { message: 'Apenas administradores podem convidar usuários' })
    }

    const body = e.requestInfo().body || {}
    const email = (body.email || '').trim().toLowerCase()
    const targetPerfil = body.perfil || 'colaborador'
    const name = (body.name || email.split('@')[0] || 'Usuário').trim()

    if (!email || !email.includes('@')) {
      return e.json(400, { message: 'E-mail inválido' })
    }

    const validProfiles = ['colaborador', 'gestor', 'rh', 'admin']
    if (!validProfiles.includes(targetPerfil)) {
      return e.json(400, { message: 'Perfil selecionado inválido' })
    }

    const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')

    // Check if user exists
    try {
      $app.findAuthRecordByEmail('_pb_users_auth_', email)
      return e.json(400, { message: 'Já existe um usuário cadastrado com este e-mail' })
    } catch (_) {
      // Record does not exist, proceed to create
    }

    const tempPassword = 'Skip@' + $security.randomString(8)

    const newUser = new Record(usersCol)
    newUser.setEmail(email)
    newUser.setPassword(tempPassword)
    newUser.setVerified(true)
    newUser.set('name', name)
    newUser.set('tenant_id', tenantId)
    newUser.set('perfil', targetPerfil)

    $app.save(newUser)

    return e.json(200, {
      success: true,
      message: 'Convite enviado com sucesso!',
      user: {
        id: newUser.id,
        email: newUser.getString('email'),
        name: newUser.getString('name'),
        perfil: newUser.getString('perfil'),
      },
    })
  },
  $apis.requireAuth(),
)
