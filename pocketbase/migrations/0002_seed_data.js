migrate(
  (app) => {
    const tenantCol = app.findCollectionByNameOrId('tenant')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const colaboradorCol = app.findCollectionByNameOrId('colaborador')

    // 1. Seed Tenant
    let tenantRecord
    try {
      tenantRecord = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')
    } catch (_) {
      tenantRecord = new Record(tenantCol)
      tenantRecord.set('razao_social', 'Tesla RH Ltda')
      tenantRecord.set('cnpj', '12.345.678/0001-90')
      tenantRecord.set('plano', 'pro')
      tenantRecord.set('status', 'ativo')
      app.save(tenantRecord)
    }
    const tenantId = tenantRecord.id

    // 2. Helper to find or create auth user
    const seedUser = (email, name, perfil, password = 'Skip@Pass') => {
      let user
      try {
        user = app.findAuthRecordByEmail('_pb_users_auth_', email)
        // Ensure tenant_id and perfil are set
        user.set('tenant_id', tenantId)
        user.set('perfil', perfil)
        user.set('name', name)
        app.save(user)
      } catch (_) {
        user = new Record(usersCol)
        user.setEmail(email)
        user.setPassword(password)
        user.setVerified(true)
        user.set('name', name)
        user.set('tenant_id', tenantId)
        user.set('perfil', perfil)
        app.save(user)
      }
      return user
    }

    // Seed 4 users (one for each profile)
    const adminUser = seedUser('claudio.zanutim@iceduc.com.br', 'Cláudio Zanutim', 'admin')
    const rhUser = seedUser('mariana.silva@teslarh.com.br', 'Mariana Silva', 'rh')
    const gestorUser = seedUser('roberto.almeida@teslarh.com.br', 'Roberto Almeida', 'gestor')
    const colabUser = seedUser('lucas.ferreira@teslarh.com.br', 'Lucas Ferreira', 'colaborador')

    // 3. Helper to find or create colaborador
    const seedColaborador = (
      nome,
      cpf,
      cargo,
      departamento,
      dataAdmissao,
      status,
      userId,
      fotoUrl,
    ) => {
      let colab
      try {
        colab = app.findFirstRecordByData('colaborador', 'cpf', cpf)
      } catch (_) {
        colab = new Record(colaboradorCol)
        colab.set('tenant_id', tenantId)
        colab.set('nome', nome)
        colab.set('cpf', cpf)
        colab.set('cargo', cargo)
        colab.set('departamento', departamento)
        colab.set('data_admissao', dataAdmissao)
        colab.set('status', status)
        if (userId) colab.set('user_id', userId)
        if (fotoUrl) colab.set('foto_url', fotoUrl)
        app.save(colab)
      }
      return colab
    }

    // 5-6 realistic Brazilian colaboradores
    // Lucas Ferreira (Marketing)
    seedColaborador(
      'Lucas Ferreira',
      '284.912.839-44',
      'Analista de Marketing Pleno',
      'Marketing',
      '2023-03-15',
      'ativo',
      colabUser.id,
      'https://img.usecurling.com/ppl/medium?gender=male&seed=101',
    )

    // Roberto Almeida (Gestor - Marketing)
    seedColaborador(
      'Roberto Almeida',
      '193.482.019-12',
      'Gerente de Marketing',
      'Marketing',
      '2021-08-01',
      'ativo',
      gestorUser.id,
      'https://img.usecurling.com/ppl/medium?gender=male&seed=102',
    )

    // Mariana Silva (RH)
    seedColaborador(
      'Mariana Silva',
      '392.184.726-55',
      'Especialista em Gente e Gestão',
      'Recursos Humanos',
      '2022-01-10',
      'ativo',
      rhUser.id,
      'https://img.usecurling.com/ppl/medium?gender=female&seed=103',
    )

    // Cláudio Zanutim (Admin / Diretor)
    seedColaborador(
      'Cláudio Zanutim',
      '049.281.938-71',
      'Diretor de Operações',
      'Diretoria',
      '2020-05-01',
      'ativo',
      adminUser.id,
      'https://img.usecurling.com/ppl/medium?gender=male&seed=104',
    )

    // Beatriz Souza (Financeiro)
    seedColaborador(
      'Beatriz Souza',
      '512.930.129-88',
      'Analista Financeiro Sênior',
      'Financeiro',
      '2022-06-20',
      'ativo',
      null,
      'https://img.usecurling.com/ppl/medium?gender=female&seed=105',
    )

    // Thiago Ramos (TI)
    seedColaborador(
      'Thiago Ramos',
      '671.203.491-30',
      'Engenheiro de Software',
      'TI',
      '2023-11-01',
      'ativo',
      null,
      'https://img.usecurling.com/ppl/medium?gender=male&seed=106',
    )

    // Camila Oliveira (Marketing - Inativo para testar métricas de status)
    seedColaborador(
      'Camila Oliveira',
      '782.391.024-67',
      'Designer Gráfico',
      'Marketing',
      '2022-09-12',
      'inativo',
      null,
      'https://img.usecurling.com/ppl/medium?gender=female&seed=107',
    )
  },
  (app) => {
    // down logic if needed
  },
)
