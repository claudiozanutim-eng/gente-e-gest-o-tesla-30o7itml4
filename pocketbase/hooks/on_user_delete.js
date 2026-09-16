// Hook para exclusão segura de usuários:
// Antes de excluir o registro de `users`, desvincula e limpa de forma consistente todas as relações:
// 1. Desvincula colaborador (set user_id = null e status = 'inativo' se existir) para manter todo o histórico de RH.
// 2. Remove flags em permissao_usuario (se houver).
// 3. Limpa referências em permissao_usuario onde o usuário foi o atualizador (atualizado_por).
// 4. Remove notificações recebidas pelo usuário (notificacao destinatario_id).
// 5. Remove etapas de onboarding de gestor do usuário (onboarding_gestor gestor_user_id).
// 6. Desvincula referências opcionais em meta_cobertura_departamento (atualizado_por), orcamento_folha (criado_por),
//    pesquisa_clima (criado_por) e compensacao_banco_horas (aprovado_por).
// 7. Desvincula user_id dos registros em log_auditoria (set user_id = null ou vazio) para NUNCA apagar o histórico de auditoria
//    e evitar erro de relação no PocketBase.
onRecordDeleteRequest((e) => {
  const user = e.record
  if (!user) return e.next()

  const userId = user.id

  // 1. Desvincular colaborador
  try {
    const colabs = $app.findRecordsByFilter(
      'colaborador',
      `user_id = '${userId}'`,
      '-created',
      10,
      0,
    )
    if (colabs && colabs.length > 0) {
      for (let i = 0; i < colabs.length; i++) {
        const c = colabs[i]
        c.set('user_id', null)
        c.set('status', 'inativo')
        $app.save(c)
      }
    }
  } catch (errColab) {
    console.log('Aviso ao desvincular colaborador no hook de exclusão de usuário:', errColab)
  }

  // 2. Remover permissao_usuario vinculadas a este usuário
  try {
    const perms = $app.findRecordsByFilter(
      'permissao_usuario',
      `user_id = '${userId}'`,
      '-created',
      20,
      0,
    )
    if (perms && perms.length > 0) {
      for (let i = 0; i < perms.length; i++) {
        $app.delete(perms[i])
      }
    }
  } catch (errPerm) {
    console.log('Aviso ao remover permissao_usuario no hook de exclusão de usuário:', errPerm)
  }

  // 3. Desvincular permissao_usuario onde atualizado_por = userId
  try {
    const permsAtualizador = $app.findRecordsByFilter(
      'permissao_usuario',
      `atualizado_por = '${userId}'`,
      '-created',
      50,
      0,
    )
    if (permsAtualizador && permsAtualizador.length > 0) {
      for (let i = 0; i < permsAtualizador.length; i++) {
        const p = permsAtualizador[i]
        p.set('atualizado_por', null)
        $app.save(p)
      }
    }
  } catch (errPermAtualizador) {
    console.log('Aviso ao desvincular atualizado_por em permissao_usuario:', errPermAtualizador)
  }

  // 4. Remover notificações direcionadas a este usuário
  try {
    const notifs = $app.findRecordsByFilter(
      'notificacao',
      `destinatario_id = '${userId}'`,
      '-created',
      100,
      0,
    )
    if (notifs && notifs.length > 0) {
      for (let i = 0; i < notifs.length; i++) {
        $app.delete(notifs[i])
      }
    }
  } catch (errNotif) {
    console.log('Aviso ao remover notificacoes do usuário:', errNotif)
  }

  // 5. Remover onboarding_gestor deste usuário
  try {
    const onboardings = $app.findRecordsByFilter(
      'onboarding_gestor',
      `gestor_user_id = '${userId}'`,
      '-created',
      50,
      0,
    )
    if (onboardings && onboardings.length > 0) {
      for (let i = 0; i < onboardings.length; i++) {
        $app.delete(onboardings[i])
      }
    }
  } catch (errOnboarding) {
    console.log('Aviso ao remover onboarding_gestor:', errOnboarding)
  }

  // 6. Desvincular compensacao_banco_horas aprovado_por
  try {
    const comps = $app.findRecordsByFilter(
      'compensacao_banco_horas',
      `aprovado_por = '${userId}'`,
      '-created',
      100,
      0,
    )
    if (comps && comps.length > 0) {
      for (let i = 0; i < comps.length; i++) {
        const comp = comps[i]
        comp.set('aprovado_por', null)
        $app.save(comp)
      }
    }
  } catch (errComp) {
    console.log('Aviso ao desvincular compensacao_banco_horas aprovado_por:', errComp)
  }

  // 7. Desvincular meta_cobertura_departamento atualizado_por
  try {
    const metas = $app.findRecordsByFilter(
      'meta_cobertura_departamento',
      `atualizado_por = '${userId}'`,
      '-created',
      50,
      0,
    )
    if (metas && metas.length > 0) {
      for (let i = 0; i < metas.length; i++) {
        const m = metas[i]
        m.set('atualizado_por', null)
        $app.save(m)
      }
    }
  } catch (errMeta) {
    console.log('Aviso ao desvincular meta_cobertura atualizado_por:', errMeta)
  }

  // 8. Desvincular orcamento_folha criado_por
  try {
    const orcs = $app.findRecordsByFilter(
      'orcamento_folha',
      `criado_por = '${userId}'`,
      '-created',
      50,
      0,
    )
    if (orcs && orcs.length > 0) {
      for (let i = 0; i < orcs.length; i++) {
        const o = orcs[i]
        o.set('criado_por', null)
        $app.save(o)
      }
    }
  } catch (errOrc) {
    console.log('Aviso ao desvincular orcamento_folha criado_por:', errOrc)
  }

  // 9. Desvincular pesquisa_clima criado_por
  try {
    const pesquisas = $app.findRecordsByFilter(
      'pesquisa_clima',
      `criado_por = '${userId}'`,
      '-created',
      50,
      0,
    )
    if (pesquisas && pesquisas.length > 0) {
      for (let i = 0; i < pesquisas.length; i++) {
        const p = pesquisas[i]
        p.set('criado_por', null)
        $app.save(p)
      }
    }
  } catch (errPesq) {
    console.log('Aviso ao desvincular pesquisa_clima criado_por:', errPesq)
  }

  // 10. Desvincular log_auditoria (garantir preservação total do log histórico)
  // Via SQL direto para atualizar todos os registros em lote sem acionar hooks desnecessários
  try {
    $app
      .db()
      .newQuery('UPDATE log_auditoria SET user_id = NULL WHERE user_id = {:uid}')
      .bind({ uid: userId })
      .execute()
  } catch (errLog) {
    console.log('Aviso ao desvincular log_auditoria user_id:', errLog)
  }

  return e.next()
}, 'users')
