migrate(
  (app) => {
    // 1. Atualizar o campo perfil na coleção users (_pb_users_auth_) para aceitar os 5 valores
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const perfilField = usersCol.fields.getByName('perfil')
    if (perfilField) {
      perfilField.values = ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']
    } else {
      usersCol.fields.add(
        new SelectField({
          name: 'perfil',
          required: true,
          values: ['colaborador', 'gestor', 'rh', 'admin_rh', 'admin'],
          maxSelect: 1,
        }),
      )
    }

    // Regras de acesso em users:
    // Apenas admin geral gerencia (cria/atualiza/deleta) usuários
    usersCol.listRule = "@request.auth.id != '' && tenant_id = @request.auth.tenant_id"
    usersCol.viewRule =
      "@request.auth.id != '' && (tenant_id = @request.auth.tenant_id || id = @request.auth.id)"
    usersCol.createRule = "@request.auth.id != '' && @request.auth.perfil = 'admin'"
    usersCol.updateRule =
      "@request.auth.id != '' && ((tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin') || id = @request.auth.id)"
    usersCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && @request.auth.perfil = 'admin'"
    app.save(usersCol)

    // 2. Coleção tenant:
    // Apenas admin geral ('admin') pode atualizar configurações do tenant
    const tenantCol = app.findCollectionByNameOrId('tenant')
    tenantCol.updateRule =
      "@request.auth.id != '' && @request.auth.tenant_id = id && @request.auth.perfil = 'admin'"
    app.save(tenantCol)

    // 3. Coleção colaborador:
    // Leitura: membros do mesmo tenant
    // Criação e exclusão: rh, admin_rh ou admin
    // Edição: rh, admin_rh, admin ou o próprio colaborador
    const colabCol = app.findCollectionByNameOrId('colaborador')
    colabCol.listRule = "@request.auth.id != '' && tenant_id = @request.auth.tenant_id"
    colabCol.viewRule = "@request.auth.id != '' && tenant_id = @request.auth.tenant_id"
    colabCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    colabCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || user_id = @request.auth.id)"
    colabCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(colabCol)

    // 4. Coleção comunicado:
    // Leitura: todos do mesmo tenant
    // Criação/edição/exclusão: rh, admin_rh ou admin
    const comCol = app.findCollectionByNameOrId('comunicado')
    comCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    comCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    comCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(comCol)

    // 5. Coleções dependente e contato_emergencia:
    const depCol = app.findCollectionByNameOrId('dependente')
    depCol.listRule =
      "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')))"
    depCol.viewRule =
      "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')))"
    depCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    depCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    depCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    app.save(depCol)

    const contatoCol = app.findCollectionByNameOrId('contato_emergencia')
    contatoCol.listRule =
      "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')))"
    contatoCol.viewRule =
      "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || @request.auth.perfil = 'gestor')))"
    contatoCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    contatoCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    contatoCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    app.save(contatoCol)

    // 6. Coleção solicitacao_alteracao:
    const solCol = app.findCollectionByNameOrId('solicitacao_alteracao')
    solCol.listRule =
      "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')))"
    solCol.viewRule =
      "@request.auth.id != '' && (colaborador_id.user_id = @request.auth.id || (tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')))"
    solCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    solCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    solCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(solCol)

    // 7. Coleção log_auditoria:
    // Visível apenas para 'admin_rh' e 'admin'
    // Criação permitida para registrar ações autenticadas
    const logCol = app.findCollectionByNameOrId('log_auditoria')
    logCol.listRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    logCol.viewRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    logCol.createRule = "@request.auth.id != '' && tenant_id = @request.auth.tenant_id"
    app.save(logCol)

    // 8. Coleção categoria_documento e documento:
    const catCol = app.findCollectionByNameOrId('categoria_documento')
    catCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    catCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    catCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(catCol)

    const docCol = app.findCollectionByNameOrId('documento')
    docCol.listRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id = '' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    docCol.viewRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id = '' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    docCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    docCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    docCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(docCol)

    // 9. Coleção ciencia_documento:
    const cienciaCol = app.findCollectionByNameOrId('ciencia_documento')
    cienciaCol.listRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    cienciaCol.viewRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    cienciaCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(cienciaCol)

    // 10. Coleção atestado:
    const atestadoCol = app.findCollectionByNameOrId('atestado')
    atestadoCol.listRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    atestadoCol.viewRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    atestadoCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    atestadoCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(atestadoCol)

    // 11. Coleções beneficio e colaborador_beneficio:
    const beneficioCol = app.findCollectionByNameOrId('beneficio')
    beneficioCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    beneficioCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    beneficioCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(beneficioCol)

    const colabBenCol = app.findCollectionByNameOrId('colaborador_beneficio')
    colabBenCol.listRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    colabBenCol.viewRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    colabBenCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    colabBenCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    colabBenCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(colabBenCol)

    // 12. Coleções de Avaliação (ciclo_avaliacao, competencia, avaliacao, nota_competencia):
    // Administrador de RH e Admin criam e gerenciam ciclos e competências
    const cicloCol = app.findCollectionByNameOrId('ciclo_avaliacao')
    cicloCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    cicloCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    cicloCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(cicloCol)

    const compCol = app.findCollectionByNameOrId('competencia')
    compCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    compCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    compCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(compCol)

    const avalCol = app.findCollectionByNameOrId('avaliacao')
    avalCol.listRule =
      "@request.auth.id != '' && ciclo_id.tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || avaliador_id.user_id = @request.auth.id || colaborador_id.user_id = @request.auth.id)"
    avalCol.viewRule =
      "@request.auth.id != '' && ciclo_id.tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || avaliador_id.user_id = @request.auth.id || colaborador_id.user_id = @request.auth.id)"
    avalCol.createRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || avaliador_id.user_id = @request.auth.id)"
    avalCol.updateRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || avaliador_id.user_id = @request.auth.id)"
    avalCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(avalCol)

    const notaCol = app.findCollectionByNameOrId('nota_competencia')
    notaCol.listRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || avaliacao_id.avaliador_id.user_id = @request.auth.id || avaliacao_id.colaborador_id.user_id = @request.auth.id)"
    notaCol.viewRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || avaliacao_id.avaliador_id.user_id = @request.auth.id || avaliacao_id.colaborador_id.user_id = @request.auth.id)"
    notaCol.createRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || avaliacao_id.avaliador_id.user_id = @request.auth.id)"
    notaCol.updateRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || avaliacao_id.avaliador_id.user_id = @request.auth.id)"
    notaCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || avaliacao_id.avaliador_id.user_id = @request.auth.id)"
    app.save(notaCol)

    // 13. Coleções de Escalas e Ponto:
    // escala_trabalho: admin_rh e admin gerenciam escalas
    const escalaCol = app.findCollectionByNameOrId('escala_trabalho')
    escalaCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    escalaCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    escalaCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(escalaCol)

    const colabEscalaCol = app.findCollectionByNameOrId('colaborador_escala')
    colabEscalaCol.listRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'gestor')"
    colabEscalaCol.viewRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'gestor')"
    colabEscalaCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    colabEscalaCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    colabEscalaCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(colabEscalaCol)

    const pontoCol = app.findCollectionByNameOrId('registro_ponto')
    pontoCol.listRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'gestor')"
    pontoCol.viewRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'gestor')"
    pontoCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (colaborador_id.user_id = @request.auth.id || @request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    pontoCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    pontoCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(pontoCol)

    // 14. Coleções de Folha de Pagamento:
    // lancamento_periodico e lancamento_pontual: escrita para admin_rh e admin
    const perCol = app.findCollectionByNameOrId('lancamento_periodico')
    perCol.listRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    perCol.viewRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    perCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    perCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    perCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(perCol)

    const pontCol = app.findCollectionByNameOrId('lancamento_pontual')
    pontCol.listRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    pontCol.viewRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'rh' || @request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin' || colaborador_id.user_id = @request.auth.id)"
    pontCol.createRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    pontCol.updateRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    pontCol.deleteRule =
      "@request.auth.id != '' && tenant_id = @request.auth.tenant_id && (@request.auth.perfil = 'admin_rh' || @request.auth.perfil = 'admin')"
    app.save(pontCol)

    // 15. Criação/Ajuste do usuário de teste para Administrador de RH ('admin_rh'):
    // Patrícia Gomes - patricia.gomes@teslarh.com.br (senha Skip@Pass)
    try {
      const teslaTenant = app.findFirstRecordByData('tenant', 'cnpj', '12.345.678/0001-90')

      let patriciaUser
      try {
        patriciaUser = app.findAuthRecordByEmail('_pb_users_auth_', 'patricia.gomes@teslarh.com.br')
        patriciaUser.set('perfil', 'admin_rh')
        patriciaUser.set('ativo', true)
        patriciaUser.set('tenant_id', teslaTenant.id)
        app.save(patriciaUser)
      } catch (_) {
        patriciaUser = new Record(usersCol)
        patriciaUser.setEmail('patricia.gomes@teslarh.com.br')
        patriciaUser.setPassword('Skip@Pass')
        patriciaUser.setVerified(true)
        patriciaUser.set('name', 'Patrícia Gomes')
        patriciaUser.set('perfil', 'admin_rh')
        patriciaUser.set('tenant_id', teslaTenant.id)
        patriciaUser.set('ativo', true)
        app.save(patriciaUser)
      }

      // Vínculo na coleção colaborador para Patrícia Gomes
      try {
        app.findFirstRecordByData('colaborador', 'cpf', '384.719.201-88')
      } catch (_) {
        const colabRecord = new Record(colabCol)
        colabRecord.set('tenant_id', teslaTenant.id)
        colabRecord.set('user_id', patriciaUser.id)
        colabRecord.set('nome', 'Patrícia Gomes')
        colabRecord.set('nome_completo', 'Patrícia Gomes de Oliveira')
        colabRecord.set('cpf', '384.719.201-88')
        colabRecord.set('rg', '31.482.901-5 SSP/SP')
        colabRecord.set('cargo', 'Gerente de Recursos Humanos')
        colabRecord.set('departamento', 'Recursos Humanos')
        colabRecord.set('data_admissao', '2021-03-01 00:00:00.000Z')
        colabRecord.set('data_nascimento', '1987-11-14 00:00:00.000Z')
        colabRecord.set('estado_civil', 'Casado(a)')
        colabRecord.set('email', 'patricia.gomes@teslarh.com.br')
        colabRecord.set('telefone', '(11) 98234-5678')
        colabRecord.set(
          'endereco',
          'Rua Pamplona, 800, Apto 102 - Jardim Paulista, São Paulo - SP, 01405-001',
        )
        colabRecord.set('status', 'ativo')
        colabRecord.set('foto_url', 'https://img.usecurling.com/ppl/medium?gender=female&seed=108')
        colabRecord.set('jornada', '40h semanais (Segunda a Sexta, 08h às 17h)')
        colabRecord.set('local_trabalho', 'Matriz São Paulo - Sede')
        app.save(colabRecord)
      }
    } catch (e) {
      console.log('Erro ao criar/vincular Patrícia Gomes:', e)
    }
  },
  (app) => {
    // Reverter valores do campo perfil na coleção users
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const perfilField = usersCol.fields.getByName('perfil')
      if (perfilField) {
        perfilField.values = ['colaborador', 'gestor', 'rh', 'admin']
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
