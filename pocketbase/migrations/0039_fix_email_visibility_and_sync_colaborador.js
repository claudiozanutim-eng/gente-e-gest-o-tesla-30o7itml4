/// <reference types="pocketbase" />

migrate(
  (app) => {
    // 1. Atualizar emailVisibility = true para TODOS os usuários existentes
    try {
      app
        .db()
        .newQuery(
          'UPDATE users SET emailVisibility = true WHERE emailVisibility = false OR emailVisibility IS NULL',
        )
        .execute()
    } catch (err) {
      console.warn('Aviso ao atualizar emailVisibility em users:', err)
    }

    // 2. Normalizar correspondência entre users e colaborador
    try {
      const users = app.findRecordsByFilter('users', "id != ''", 'created', 500, 0)
      const colabs = app.findRecordsByFilter('colaborador', "id != ''", 'created', 500, 0)

      const normalizarTexto = (str) => {
        if (!str) return ''
        return str
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
      }

      for (let u of users) {
        const uEmail = (u.get('email') || '').trim().toLowerCase()
        const uNameNorm = normalizarTexto(u.get('name'))
        const uTenantId = u.get('tenant_id')
        const uId = u.get('id')

        // Buscar colaborador correspondente
        let match = colabs.find((c) => c.get('user_id') === uId)

        if (!match && uEmail) {
          match = colabs.find((c) => (c.get('email') || '').trim().toLowerCase() === uEmail)
        }

        if (!match && uNameNorm) {
          match = colabs.find((c) => {
            const cNome = normalizarTexto(c.get('nome'))
            const cCompleto = normalizarTexto(c.get('nome_completo'))
            return cNome === uNameNorm || cCompleto === uNameNorm
          })
        }

        if (match) {
          let changed = false
          if (!match.get('user_id')) {
            match.set('user_id', uId)
            changed = true
          }
          if (
            uEmail &&
            (!match.get('email') || match.get('email').trim().toLowerCase() !== uEmail)
          ) {
            match.set('email', uEmail)
            changed = true
          }
          if (changed) {
            app.save(match)
          }
        } else {
          // Criar ficha para o usuário caso não possua nenhuma
          try {
            const colabCollection = app.findCollectionByNameOrId('colaborador')
            const novoColab = new Record(colabCollection)

            // Gerar CPF único aleatório
            const random9 = Math.floor(100000000 + Math.random() * 900000000).toString()
            const d1 = Math.floor(Math.random() * 10)
            const d2 = Math.floor(Math.random() * 10)
            const cpfFinal = `${random9.slice(0, 3)}.${random9.slice(3, 6)}.${random9.slice(6, 9)}-${d1}${d2}`

            const uPerfil = u.get('perfil')
            const cargo =
              uPerfil === 'admin'
                ? 'Administrador Geral'
                : uPerfil === 'admin_rh'
                  ? 'Administrador de RH'
                  : uPerfil === 'rh'
                    ? 'Analista de RH'
                    : uPerfil === 'gestor'
                      ? 'Gestor'
                      : 'Colaborador'

            const departamento =
              uPerfil === 'admin'
                ? 'Diretoria'
                : uPerfil === 'admin_rh' || uPerfil === 'rh'
                  ? 'Recursos Humanos'
                  : 'Geral'

            novoColab.set('tenant_id', uTenantId)
            novoColab.set('user_id', uId)
            novoColab.set('nome', u.get('name') || uEmail.split('@')[0] || 'Usuário')
            novoColab.set('nome_completo', u.get('name') || uEmail.split('@')[0] || 'Usuário')
            novoColab.set('email', uEmail)
            novoColab.set('cpf', cpfFinal)
            novoColab.set('cargo', cargo)
            novoColab.set('departamento', departamento)
            novoColab.set('status', u.get('ativo') !== false ? 'ativo' : 'inativo')
            novoColab.set('data_admissao', u.get('created') || new Date().toISOString())

            app.save(novoColab)
          } catch (createErr) {
            console.warn('Erro ao criar ficha na migração para usuário ' + uEmail + ':', createErr)
          }
        }
      }
    } catch (err) {
      console.warn('Erro no processo de normalização users/colaborador:', err)
    }
  },
  (app) => {
    // Reversão
  },
)
