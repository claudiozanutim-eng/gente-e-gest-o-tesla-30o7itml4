import pb from '@/lib/pocketbase/client'
import {
  Tenant,
  AppUser,
  Colaborador,
  UserPerfil,
  Dependente,
  ContatoEmergencia,
  SolicitacaoAlteracao,
  LogAuditoria,
  CategoriaDocumento,
  Documento,
  CienciaDocumento,
  Atestado,
  AtestadoStatus,
  Beneficio,
  BeneficioTipo,
  ColaboradorBeneficio,
  DetalhesBeneficio,
} from '@/types'
import { notificacaoService } from '@/services/notificacaoService'

export const tenantService = {
  async getTenant(tenantId: string): Promise<Tenant | null> {
    if (!tenantId) return null
    try {
      const record = await pb.collection('tenant').getOne<Tenant>(tenantId)
      return record
    } catch (err: unknown) {
      // Trata 404 e erros de recurso não encontrado graciosamente sem estourar exceção no console
      const anyErr = err as {
        status?: number
        response?: { code?: number; status?: number; message?: string }
        message?: string
      }
      const status = anyErr?.status || anyErr?.response?.code || anyErr?.response?.status
      const msg = anyErr?.message || anyErr?.response?.message || ''
      if (status === 404 || status === 0 || /404|not found|não encontrad/i.test(msg)) {
        console.warn(`[tenantService] Tenant "${tenantId}" não localizado (404).`)
        return null
      }
      console.warn(`[tenantService] Falha ao buscar tenant "${tenantId}":`, err)
      return null
    }
  },

  async updateTenant(
    tenantId: string,
    data: Partial<
      Pick<
        Tenant,
        'plano' | 'status' | 'razao_social' | 'cnpj' | 'endereco' | 'telefone' | 'regime_tributario'
      >
    >,
  ): Promise<Tenant> {
    const record = await pb.collection('tenant').update<Tenant>(tenantId, data)
    return record
  },

  async createTenant(data: {
    razao_social: string
    cnpj: string
    plano?: import('@/types').TenantPlano
    status?: import('@/types').TenantStatus
    endereco?: string
    telefone?: string
    regime_tributario?: import('@/types').TenantRegimeTributario
  }): Promise<Tenant> {
    const record = await pb.collection('tenant').create<Tenant>({
      plano: 'pro',
      status: 'ativo',
      regime_tributario: 'Lucro Real',
      ...data,
    })
    return record
  },
}

export const userService = {
  async getTenantUsers(tenantId: string): Promise<AppUser[]> {
    const records = await pb.collection('users').getFullList<AppUser>({
      filter: `tenant_id = "${tenantId}"`,
      sort: 'name',
    })
    return records
  },

  async getUsersByTenant(tenantId: string): Promise<AppUser[]> {
    const records = await pb.collection('users').getFullList<AppUser>({
      filter: `tenant_id = "${tenantId}"`,
      sort: 'name',
    })
    return records
  },

  async updateUserPerfil(userId: string, perfil: UserPerfil): Promise<AppUser> {
    const record = await pb.collection('users').update<AppUser>(userId, { perfil })
    return record
  },

  async updateUserData(userId: string, data: Partial<AppUser>): Promise<AppUser> {
    const record = await pb.collection('users').update<AppUser>(userId, data)
    return record
  },

  async createUser(
    data: {
      tenant_id: string
      name: string
      email: string
      password?: string
      perfil: UserPerfil
    },
    avatarFile?: File | null,
  ): Promise<AppUser> {
    const password = data.password || 'Skip@Pass'
    let record: AppUser

    if (avatarFile) {
      const formData = new FormData()
      formData.append('tenant_id', data.tenant_id)
      formData.append('name', data.name)
      formData.append('email', data.email)
      formData.append('password', password)
      formData.append('passwordConfirm', password)
      formData.append('perfil', data.perfil)
      formData.append('ativo', 'true')
      formData.append('emailVisibility', 'false')
      formData.append('avatar', avatarFile)
      record = await pb.collection('users').create<AppUser>(formData)
    } else {
      record = await pb.collection('users').create<AppUser>({
        ...data,
        password,
        passwordConfirm: password,
        ativo: true,
        emailVisibility: false,
      })
    }

    return record
  },

  async toggleUserAtivo(userId: string, ativo: boolean): Promise<AppUser> {
    const record = await pb.collection('users').update<AppUser>(userId, { ativo })
    return record
  },

  /**
   * Exclusão permanente de usuário (apenas Admin Geral).
   * Desvincula colaborador, remove permissões, limpa notificações e onboarding,
   * preservando integralmente o histórico cadastral de RH e logs de auditoria.
   */
  async deleteUser(userId: string): Promise<boolean> {
    // 1. Se houver colaborador atrelado, desvincula user_id para manter histórico de RH
    try {
      const colabs = await pb.collection('colaborador').getFullList({
        filter: `user_id = "${userId}"`,
      })
      for (const colab of colabs) {
        await pb.collection('colaborador').update(colab.id, {
          user_id: null,
          status: 'inativo',
        })
      }
    } catch (e) {
      console.warn('Aviso ao desvincular colaborador do usuário:', e)
    }

    // 2. Remove registros em permissao_usuario (flags do usuário)
    try {
      const perms = await pb.collection('permissao_usuario').getFullList({
        filter: `user_id = "${userId}"`,
      })
      for (const perm of perms) {
        await pb.collection('permissao_usuario').delete(perm.id)
      }
    } catch (e) {
      console.warn('Aviso ao limpar permissões do usuário excluído:', e)
    }

    // 3. Remove notificações direcionadas a este usuário
    try {
      const notifs = await pb.collection('notificacao').getFullList({
        filter: `destinatario_id = "${userId}"`,
      })
      for (const notif of notifs) {
        await pb.collection('notificacao').delete(notif.id)
      }
    } catch (e) {
      console.warn('Aviso ao limpar notificações do usuário:', e)
    }

    // 4. Remove onboarding de gestor vinculado ao usuário
    try {
      const onboardings = await pb.collection('onboarding_gestor').getFullList({
        filter: `gestor_user_id = "${userId}"`,
      })
      for (const ob of onboardings) {
        await pb.collection('onboarding_gestor').delete(ob.id)
      }
    } catch (e) {
      console.warn('Aviso ao limpar onboarding_gestor do usuário:', e)
    }

    // 5. Deleta o registro de usuário (o hook on_user_delete também desvincula auditoria e referências auxiliares)
    await pb.collection('users').delete(userId)
    return true
  },

  async resetUserPassword(userId: string, newPassword: string): Promise<AppUser> {
    const record = await pb.collection('users').update<AppUser>(userId, {
      password: newPassword,
      passwordConfirm: newPassword,
    })
    return record
  },

  async inviteUser(
    email: string,
    perfil: UserPerfil,
    name?: string,
  ): Promise<{ success: boolean; message: string; user?: AppUser }> {
    try {
      const response = await pb.send<{ success: boolean; message: string; user?: AppUser }>(
        '/backend/v1/custom/invite-user',
        {
          method: 'POST',
          body: { email, perfil, name },
        },
      )
      return response
    } catch {
      return { success: false, message: 'Endpoint customizado não disponível.' }
    }
  },
}

export const colaboradorService = {
  async getColaboradores(tenantId: string): Promise<Colaborador[]> {
    const records = await pb.collection('colaborador').getFullList<Colaborador>({
      filter: `tenant_id = "${tenantId}"`,
      sort: 'nome',
    })
    return records
  },

  async getColaboradorByUserId(userId: string): Promise<Colaborador | null> {
    try {
      const record = await pb
        .collection('colaborador')
        .getFirstListItem<Colaborador>(`user_id = "${userId}"`)
      return record
    } catch {
      return null
    }
  },

  async getColaboradorByEmail(email: string, tenantId?: string): Promise<Colaborador | null> {
    try {
      const filter = tenantId
        ? `email = "${email}" && tenant_id = "${tenantId}"`
        : `email = "${email}"`
      const record = await pb.collection('colaborador').getFirstListItem<Colaborador>(filter)
      return record
    } catch {
      return null
    }
  },

  /**
   * Cria uma ficha de colaborador associada a um usuário do sistema ou cadastro avulso.
   * Gera CPF formatado sequencial/único caso não informado para satisfazer o índice único do banco.
   */
  async createColaborador(data: {
    tenant_id: string
    user_id?: string | null
    nome: string
    nome_completo?: string
    email?: string
    cpf?: string
    cargo?: string
    departamento?: string
    status?: 'ativo' | 'inativo'
    data_admissao?: string
    foto_url?: string
  }): Promise<Colaborador> {
    let cpfFinal = (data.cpf || '').trim()
    if (!cpfFinal) {
      // Gerar CPF identificador único caso não informado (ex: sync de users sem CPF)
      const random9 = Math.floor(100000000 + Math.random() * 900000000).toString()
      const d1 = Math.floor(Math.random() * 10)
      const d2 = Math.floor(Math.random() * 10)
      cpfFinal = `${random9.slice(0, 3)}.${random9.slice(3, 6)}.${random9.slice(6, 9)}-${d1}${d2}`
    }

    const payload: Record<string, unknown> = {
      tenant_id: data.tenant_id,
      nome: data.nome.trim(),
      nome_completo: (data.nome_completo || data.nome).trim(),
      cpf: cpfFinal,
      cargo: data.cargo?.trim() || 'Colaborador',
      departamento: data.departamento?.trim() || 'Geral',
      status: data.status || 'ativo',
      data_admissao: data.data_admissao || new Date().toISOString(),
    }

    if (data.user_id) payload.user_id = data.user_id
    if (data.email) payload.email = data.email.trim().toLowerCase()
    if (data.foto_url) payload.foto_url = data.foto_url

    const record = await pb.collection('colaborador').create<Colaborador>(payload)
    return record
  },

  /**
   * Sincroniza usuários do tenant que ainda não possuem ficha na coleção colaborador.
   * Cria a ficha automaticamente e associa user_id. Se já houver colaborador com mesmo e-mail,
   * apenas vincula o user_id.
   */
  async sincronizarUsuariosSemFicha(tenantId: string): Promise<Colaborador[]> {
    try {
      // 1. Buscar todos os usuários do tenant
      const users = await pb.collection('users').getFullList<AppUser>({
        filter: `tenant_id = "${tenantId}"`,
      })

      // 2. Buscar todos os colaboradores do tenant
      const colabs = await pb.collection('colaborador').getFullList<Colaborador>({
        filter: `tenant_id = "${tenantId}"`,
      })

      const colabUserIdSet = new Set(colabs.map((c) => c.user_id).filter(Boolean))
      const colabEmailMap = new Map<string, Colaborador>()
      colabs.forEach((c) => {
        if (c.email) colabEmailMap.set(c.email.trim().toLowerCase(), c)
      })

      const novosCriadosOuVinculados: Colaborador[] = []

      // Mapeamento de cargo fallback pelo perfil do usuário
      const perfilCargoMap: Record<UserPerfil, string> = {
        admin: 'Administrador Geral',
        admin_rh: 'Administrador de RH',
        rh: 'Analista de RH',
        gestor: 'Gestor',
        colaborador: 'Colaborador',
      }

      for (const u of users) {
        // Se já está vinculado por user_id, continua
        if (colabUserIdSet.has(u.id)) continue

        const userEmail = (u.email || '').trim().toLowerCase()
        const colabExistentePorEmail = userEmail ? colabEmailMap.get(userEmail) : null

        if (colabExistentePorEmail) {
          // Já existe ficha com o mesmo e-mail, vincular user_id se estiver vazio
          if (!colabExistentePorEmail.user_id) {
            try {
              const updated = await pb
                .collection('colaborador')
                .update<Colaborador>(colabExistentePorEmail.id, { user_id: u.id })
              novosCriadosOuVinculados.push(updated)
              colabUserIdSet.add(u.id)
            } catch (err) {
              console.warn(`Erro ao vincular user_id ${u.id} a colaborador existente:`, err)
            }
          }
        } else {
          // Não possui ficha: criar automaticamente
          try {
            const cargo = perfilCargoMap[u.perfil] || 'Colaborador'
            const departamento =
              u.perfil === 'admin'
                ? 'Diretoria'
                : u.perfil === 'admin_rh' || u.perfil === 'rh'
                  ? 'Recursos Humanos'
                  : 'Geral'

            const novoColab = await this.createColaborador({
              tenant_id: tenantId,
              user_id: u.id,
              nome: u.name || userEmail.split('@')[0] || 'Usuário',
              nome_completo: u.name || userEmail.split('@')[0] || 'Usuário',
              email: userEmail,
              cargo,
              departamento,
              status: u.ativo !== false ? 'ativo' : 'inativo',
              data_admissao: u.created || new Date().toISOString(),
            })

            novosCriadosOuVinculados.push(novoColab)
            colabUserIdSet.add(u.id)
            if (userEmail) colabEmailMap.set(userEmail, novoColab)
          } catch (createErr) {
            console.warn(`Erro ao criar ficha automática para usuário ${u.email}:`, createErr)
          }
        }
      }

      return novosCriadosOuVinculados
    } catch (err) {
      console.warn('Erro ao sincronizar usuários sem ficha:', err)
      return []
    }
  },

  async getColaboradoresByDepartment(
    tenantId: string,
    departamento: string,
  ): Promise<Colaborador[]> {
    const records = await pb.collection('colaborador').getFullList<Colaborador>({
      filter: `tenant_id = "${tenantId}" && departamento = "${departamento}"`,
      sort: 'nome',
    })
    return records
  },

  async updateFotoUrl(colaboradorId: string, fotoUrl: string): Promise<Colaborador> {
    const record = await pb.collection('colaborador').update<Colaborador>(colaboradorId, {
      foto_url: fotoUrl,
    })
    return record
  },

  async uploadFotoArquivo(colaboradorId: string, file: File): Promise<Colaborador> {
    const formData = new FormData()
    formData.append('foto', file)
    // 1. Enviar o arquivo físico para o campo `foto`
    const record = await pb.collection('colaborador').update<Colaborador>(colaboradorId, formData)
    // 2. Gerar URL pública oficial via PocketBase SDK
    const fileUrl = record.foto ? pb.files.getURL(record, record.foto) : ''
    if (fileUrl) {
      const updated = await pb.collection('colaborador').update<Colaborador>(colaboradorId, {
        foto_url: fileUrl,
      })
      return updated
    }
    return record
  },

  async removerFoto(colaboradorId: string): Promise<Colaborador> {
    const updated = await pb.collection('colaborador').update<Colaborador>(colaboradorId, {
      foto: null,
      foto_url: '',
    })
    return updated
  },

  async updateColaborador(colaboradorId: string, data: Partial<Colaborador>): Promise<Colaborador> {
    // Garantir que tenant_id nunca seja alterado
    const payload = { ...data }
    delete (payload as Record<string, unknown>).tenant_id
    delete (payload as Record<string, unknown>).id
    delete (payload as Record<string, unknown>).created
    delete (payload as Record<string, unknown>).updated

    const record = await pb.collection('colaborador').update<Colaborador>(colaboradorId, payload)
    return record
  },

  async getColaboradorById(id: string): Promise<Colaborador> {
    const record = await pb.collection('colaborador').getOne<Colaborador>(id)
    return record
  },
}

export const dependenteService = {
  async getDependentesByColaborador(colaboradorId: string): Promise<Dependente[]> {
    const records = await pb.collection('dependente').getFullList<Dependente>({
      filter: `colaborador_id = "${colaboradorId}"`,
      sort: 'nome',
    })
    return records
  },

  async createDependente(data: {
    colaborador_id: string
    tenant_id: string
    nome: string
    parentesco: string
    data_nascimento?: string
  }): Promise<Dependente> {
    const record = await pb.collection('dependente').create<Dependente>(data)
    return record
  },

  async updateDependente(
    id: string,
    data: {
      nome?: string
      parentesco?: string
      data_nascimento?: string
    },
  ): Promise<Dependente> {
    const record = await pb.collection('dependente').update<Dependente>(id, data)
    return record
  },

  async deleteDependente(id: string): Promise<boolean> {
    await pb.collection('dependente').delete(id)
    return true
  },
}

export const contatoEmergenciaService = {
  async getContatosByColaborador(colaboradorId: string): Promise<ContatoEmergencia[]> {
    const records = await pb.collection('contato_emergencia').getFullList<ContatoEmergencia>({
      filter: `colaborador_id = "${colaboradorId}"`,
      sort: 'nome',
    })
    return records
  },

  async createContato(data: {
    colaborador_id: string
    tenant_id: string
    nome: string
    telefone: string
    parentesco: string
  }): Promise<ContatoEmergencia> {
    const record = await pb.collection('contato_emergencia').create<ContatoEmergencia>(data)
    return record
  },

  async updateContato(
    id: string,
    data: {
      nome?: string
      telefone?: string
      parentesco?: string
    },
  ): Promise<ContatoEmergencia> {
    const record = await pb.collection('contato_emergencia').update<ContatoEmergencia>(id, data)
    return record
  },

  async deleteContato(id: string): Promise<boolean> {
    await pb.collection('contato_emergencia').delete(id)
    return true
  },
}

export const solicitacaoService = {
  async getSolicitacoesByColaborador(colaboradorId: string): Promise<SolicitacaoAlteracao[]> {
    const records = await pb.collection('solicitacao_alteracao').getFullList<SolicitacaoAlteracao>({
      filter: `colaborador_id = "${colaboradorId}"`,
      sort: '-created',
    })
    return records
  },

  async getSolicitacoesTenant(
    tenantId: string,
    status?: import('@/types').SolicitacaoStatus,
  ): Promise<(SolicitacaoAlteracao & { expand?: { colaborador_id?: Colaborador } })[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (status) {
      filter += ` && status = "${status}"`
    }
    const records = await pb
      .collection('solicitacao_alteracao')
      .getFullList<SolicitacaoAlteracao & { expand?: { colaborador_id?: Colaborador } }>({
        filter,
        sort: '-data_solicitacao,-created',
        expand: 'colaborador_id',
      })
    return records
  },

  async createSolicitacao(data: {
    colaborador_id: string
    tenant_id: string
    campo: string
    valor_antigo?: string
    valor_novo: string
  }): Promise<SolicitacaoAlteracao> {
    const record = await pb.collection('solicitacao_alteracao').create<SolicitacaoAlteracao>({
      ...data,
      status: 'pendente',
      data_solicitacao: new Date().toISOString(),
    })
    return record
  },

  async aprovarSolicitacao(
    solicitacao: SolicitacaoAlteracao,
    userId: string,
  ): Promise<{ success: boolean; solicitacao: SolicitacaoAlteracao }> {
    // 1. Mapear o nome do campo da solicitação para o campo no registro colaborador
    const campoNome = solicitacao.campo.trim().toLowerCase()
    const mapCampos: Record<string, string> = {
      telefone: 'telefone',
      'telefone / celular': 'telefone',
      celular: 'telefone',
      endereço: 'endereco',
      endereco: 'endereco',
      'estado civil': 'estado_civil',
      'chave pix': 'pix',
      pix: 'pix',
      'dados bancários': 'dados_bancarios',
      'dados bancarios': 'dados_bancarios',
      rg: 'rg',
      cnh: 'cnh',
      'título de eleitor': 'titulo_eleitor',
      'titulo de eleitor': 'titulo_eleitor',
      'e-mail': 'email',
      email: 'email',
    }

    const fieldColaborador = mapCampos[campoNome] || campoNome

    // Limpar possíveis anotações (Obs: ...) se houver no valor_novo
    let valorParaAtualizar = solicitacao.valor_novo
    if (valorParaAtualizar.includes(' (Obs: ')) {
      valorParaAtualizar = valorParaAtualizar.split(' (Obs: ')[0].trim()
    }

    // 2. Atualizar no colaborador
    if (solicitacao.colaborador_id && fieldColaborador) {
      await pb.collection('colaborador').update(solicitacao.colaborador_id, {
        [fieldColaborador]: valorParaAtualizar,
      })
    }

    // 3. Atualizar status da solicitação
    const updatedSolic = await pb
      .collection('solicitacao_alteracao')
      .update<SolicitacaoAlteracao>(solicitacao.id, {
        status: 'aprovada',
        data_resposta: new Date().toISOString(),
      })

    // 4. Registrar em log_auditoria
    await logAuditoriaService.registrarLog({
      tenant_id: solicitacao.tenant_id,
      user_id: userId,
      acao: 'aprovacao_alteracao',
      entidade: 'colaborador',
      entidade_id: solicitacao.colaborador_id,
      dados_json: {
        solicitacao_id: solicitacao.id,
        campo: solicitacao.campo,
        campo_db: fieldColaborador,
        valor_antigo: solicitacao.valor_antigo,
        valor_novo: valorParaAtualizar,
        resultado: 'aprovada',
      },
    })

    // 5. Notificar o colaborador
    try {
      const colab = await colaboradorService.getColaboradorById(solicitacao.colaborador_id)
      if (colab?.user_id) {
        await notificacaoService.notificar({
          tenantId: solicitacao.tenant_id,
          destinatarioId: colab.user_id,
          tipo: 'cadastro',
          titulo: 'Alteração cadastral aprovada',
          mensagem: `Sua solicitação de alteração para "${solicitacao.campo}" foi aprovada pelo RH.`,
          link: '/meu-perfil',
          emailDestinatario: colab.email,
          nomeDestinatario: colab.nome,
        })
      }
    } catch (e) {
      console.warn('Erro ao notificar aprovacao cadastral:', e)
    }

    return { success: true, solicitacao: updatedSolic }
  },

  async rejeitarSolicitacao(
    solicitacao: SolicitacaoAlteracao,
    userId: string,
    motivo?: string,
  ): Promise<SolicitacaoAlteracao> {
    const updatedSolic = await pb
      .collection('solicitacao_alteracao')
      .update<SolicitacaoAlteracao>(solicitacao.id, {
        status: 'rejeitada',
        data_resposta: new Date().toISOString(),
        motivo_resposta: motivo || 'Solicitação reprovada pelo RH.',
      })

    await logAuditoriaService.registrarLog({
      tenant_id: solicitacao.tenant_id,
      user_id: userId,
      acao: 'rejeicao_alteracao',
      entidade: 'colaborador',
      entidade_id: solicitacao.colaborador_id,
      dados_json: {
        solicitacao_id: solicitacao.id,
        campo: solicitacao.campo,
        valor_antigo: solicitacao.valor_antigo,
        valor_rejeitado: solicitacao.valor_novo,
        motivo: motivo || 'Solicitação reprovada pelo RH.',
        resultado: 'rejeitada',
      },
    })

    // Notificar colaborador sobre rejeição
    try {
      const colab = await colaboradorService.getColaboradorById(solicitacao.colaborador_id)
      if (colab?.user_id) {
        await notificacaoService.notificar({
          tenantId: solicitacao.tenant_id,
          destinatarioId: colab.user_id,
          tipo: 'cadastro',
          titulo: 'Alteração cadastral reprovada',
          mensagem: `Sua solicitação de alteração para "${solicitacao.campo}" foi recusada. Motivo: ${motivo || 'Verifique os dados informados.'}`,
          link: '/meu-perfil',
          emailDestinatario: colab.email,
          nomeDestinatario: colab.nome,
        })
      }
    } catch (e) {
      console.warn('Erro ao notificar rejeicao cadastral:', e)
    }

    return updatedSolic
  },
}

export const logAuditoriaService = {
  async registrarLog(data: {
    tenant_id: string
    user_id: string
    acao: string
    entidade: string
    entidade_id: string
    dados_json?: Record<string, unknown>
    data_hora?: string
  }): Promise<LogAuditoria | null> {
    try {
      const record = await pb.collection('log_auditoria').create<LogAuditoria>({
        ...data,
        data_hora: data.data_hora || new Date().toISOString(),
      })
      return record
    } catch (err) {
      console.warn('Erro ao registrar log de auditoria:', err)
      return null
    }
  },

  async getLogsPorEntidade(entidade: string, entidadeId: string): Promise<LogAuditoria[]> {
    try {
      const records = await pb.collection('log_auditoria').getFullList<LogAuditoria>({
        filter: `entidade = "${entidade}" && entidade_id = "${entidadeId}"`,
        sort: '-created',
        expand: 'user_id',
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar logs de auditoria:', err)
      return []
    }
  },

  async getLogsRecentesTenant(tenantId: string, limit: number = 10): Promise<LogAuditoria[]> {
    try {
      const records = await pb.collection('log_auditoria').getList<LogAuditoria>(1, limit, {
        filter: `tenant_id = "${tenantId}"`,
        sort: '-data_hora,-created',
        expand: 'user_id',
      })
      return records.items
    } catch (err) {
      console.warn('Erro ao carregar logs recentes do tenant:', err)
      return []
    }
  },

  async getLogsFiltrados(
    tenantId: string,
    filtros?: {
      userId?: string
      acao?: string
      entidade?: string
      dataInicio?: string
      dataFim?: string
    },
    limit: number = 50,
  ): Promise<LogAuditoria[]> {
    try {
      let filter = `tenant_id = "${tenantId}"`
      if (filtros?.userId && filtros.userId !== 'todos') {
        filter += ` && user_id = "${filtros.userId}"`
      }
      if (filtros?.acao && filtros.acao !== 'todos') {
        filter += ` && acao = "${filtros.acao}"`
      }
      if (filtros?.entidade && filtros.entidade !== 'todos') {
        filter += ` && entidade = "${filtros.entidade}"`
      }
      if (filtros?.dataInicio) {
        filter += ` && (data_hora >= "${filtros.dataInicio} 00:00:00" || created >= "${filtros.dataInicio} 00:00:00")`
      }
      if (filtros?.dataFim) {
        filter += ` && (data_hora <= "${filtros.dataFim} 23:59:59" || created <= "${filtros.dataFim} 23:59:59")`
      }

      const records = await pb.collection('log_auditoria').getList<LogAuditoria>(1, limit, {
        filter,
        sort: '-data_hora,-created',
        expand: 'user_id',
      })
      return records.items
    } catch (err) {
      console.warn('Erro ao buscar logs filtrados:', err)
      return []
    }
  },
}

export const comunicadoService = {
  async getComunicados(
    tenantId: string,
    apenasAtivos: boolean = false,
  ): Promise<import('@/types').Comunicado[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (apenasAtivos) {
      filter += ` && (status = "ativo" || status = "" || status = null)`
    }
    const records = await pb.collection('comunicado').getFullList<import('@/types').Comunicado>({
      filter,
      sort: '-data_publicacao,-created',
    })
    return records
  },

  async createComunicado(data: {
    tenant_id: string
    categoria: import('@/types').ComunicadoCategoria
    titulo: string
    conteudo: string
    segmentacao_tipo: import('@/types').ComunicadoSegmentacaoTipo
    segmentacao_valor?: string
    data_publicacao?: string
    status?: import('@/types').ComunicadoStatus
  }): Promise<import('@/types').Comunicado> {
    const record = await pb.collection('comunicado').create<import('@/types').Comunicado>({
      ...data,
      status: data.status || 'ativo',
      data_publicacao: data.data_publicacao || new Date().toISOString(),
    })

    // Disparar notificações in-app para os colaboradores/gestores segmentados
    try {
      const todosColabs = await colaboradorService.getColaboradores(data.tenant_id)
      const usersTenant = await pb.collection('users').getFullList({
        filter: `tenant_id = "${data.tenant_id}"`,
      })
      const userMap = new Map(usersTenant.map((u) => [u.id, u]))

      for (const colab of todosColabs) {
        if (!colab.user_id) continue
        const userRec = userMap.get(colab.user_id)
        const perfil = userRec?.perfil || 'colaborador'

        // Verificar segmentação
        let elegivel = false
        if (data.segmentacao_tipo === 'todos') {
          elegivel = true
        } else if (data.segmentacao_tipo === 'gestores') {
          elegivel =
            perfil === 'gestor' || perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin'
        } else if (data.segmentacao_tipo === 'setor') {
          elegivel = colab.departamento?.toLowerCase() === data.segmentacao_valor?.toLowerCase()
        } else if (data.segmentacao_tipo === 'funcao') {
          elegivel = colab.cargo?.toLowerCase() === data.segmentacao_valor?.toLowerCase()
        }

        if (elegivel) {
          notificacaoService
            .notificar({
              tenantId: data.tenant_id,
              destinatarioId: colab.user_id,
              tipo: 'comunicado',
              titulo: `Comunicado: ${data.titulo}`,
              mensagem: data.conteudo.slice(0, 120) + (data.conteudo.length > 120 ? '...' : ''),
              link: '/comunicados',
              emailDestinatario: colab.email,
              nomeDestinatario: colab.nome,
            })
            .catch(() => {})
        }
      }
    } catch (e) {
      console.warn('Erro ao notificar comunicado aos colaboradores:', e)
    }

    return record
  },

  async updateComunicado(
    id: string,
    data: Partial<import('@/types').Comunicado>,
  ): Promise<import('@/types').Comunicado> {
    const record = await pb.collection('comunicado').update<import('@/types').Comunicado>(id, data)
    return record
  },

  async arquivarComunicado(id: string): Promise<import('@/types').Comunicado> {
    const record = await pb.collection('comunicado').update<import('@/types').Comunicado>(id, {
      status: 'arquivado',
    })
    return record
  },

  async desarquivarComunicado(id: string): Promise<import('@/types').Comunicado> {
    const record = await pb.collection('comunicado').update<import('@/types').Comunicado>(id, {
      status: 'ativo',
    })
    return record
  },

  async deleteComunicado(id: string, tenantId?: string): Promise<boolean> {
    if (tenantId) {
      const record = await pb.collection('comunicado').getOne<import('@/types').Comunicado>(id)
      if (record.tenant_id !== tenantId) {
        throw new Error('Acesso negado: comunicado não pertence ao tenant do usuário.')
      }
    }
    await pb.collection('comunicado').delete(id)
    return true
  },

  /**
   * Filtra comunicados visíveis para o colaborador/usuário atual.
   * Regras:
   * - RH e Admin: enxergam todos os comunicados do seu tenant.
   * - Gestores: enxergam comunicados segmentados para 'gestores', 'todos', ou direcionados ao seu setor/função.
   * - Colaborador comum: NÃO enxerga comunicados segmentados para 'gestores'.
   * - se segmentacao_tipo = 'todos' -> visível
   * - se segmentacao_tipo = 'setor' -> visível se departamento/setor for igual
   * - se segmentacao_tipo = 'funcao' -> visível se cargo/função for igual
   */
  filtrarPorPerfil(
    comunicados: import('@/types').Comunicado[],
    userPerfil: import('@/types').UserPerfil,
    colaborador?: import('@/types').Colaborador | null,
  ): import('@/types').Comunicado[] {
    // Admin e RH têm visão geral corporativa de todos os comunicados do tenant
    if (userPerfil === 'admin' || userPerfil === 'rh') {
      return comunicados
    }

    const isGestor = userPerfil === 'gestor'
    const userSetor = (colaborador?.departamento || '').trim().toLowerCase()
    const userCargo = (colaborador?.cargo || '').trim().toLowerCase()

    return comunicados.filter((item) => {
      const tipo = item.segmentacao_tipo
      const valor = (item.segmentacao_valor || '').trim().toLowerCase()

      if (tipo === 'todos') {
        return true
      }

      if (tipo === 'gestores') {
        return isGestor
      }

      if (tipo === 'setor') {
        return Boolean(
          userSetor &&
          (userSetor === valor || userSetor.includes(valor) || valor.includes(userSetor)),
        )
      }

      if (tipo === 'funcao') {
        return Boolean(
          userCargo &&
          (userCargo === valor || userCargo.includes(valor) || valor.includes(userCargo)),
        )
      }

      return false
    })
  },
}

export const documentoService = {
  async getCategorias(tenantId: string): Promise<CategoriaDocumento[]> {
    const records = await pb.collection('categoria_documento').getFullList<CategoriaDocumento>({
      filter: `tenant_id = "${tenantId}"`,
      sort: 'nome',
    })
    return records
  },

  async getDocumentos(tenantId: string, filterCustom?: string): Promise<Documento[]> {
    const filter = filterCustom
      ? `tenant_id = "${tenantId}" && (${filterCustom})`
      : `tenant_id = "${tenantId}"`
    const records = await pb.collection('documento').getFullList<Documento>({
      filter,
      sort: '-created',
      expand: 'categoria_id,colaborador_id',
    })
    return records
  },

  async getDocumentosColaborador(tenantId: string, colaboradorId?: string): Promise<Documento[]> {
    // Retorna documentos gerais/corporativos (sem colaborador_id) ou pessoais do próprio colaborador
    const filter = colaboradorId
      ? `tenant_id = "${tenantId}" && (colaborador_id = "" || colaborador_id = "${colaboradorId}")`
      : `tenant_id = "${tenantId}" && colaborador_id = ""`

    const records = await pb.collection('documento').getFullList<Documento>({
      filter,
      sort: '-data_publicacao,-created',
      expand: 'categoria_id,colaborador_id',
    })
    return records
  },

  async createDocumento(formData: FormData): Promise<Documento> {
    const record = await pb.collection('documento').create<Documento>(formData, {
      expand: 'categoria_id,colaborador_id',
    })
    return record
  },

  async updateDocumento(
    documentoId: string,
    formData: FormData | Partial<Documento>,
  ): Promise<Documento> {
    const record = await pb.collection('documento').update<Documento>(documentoId, formData, {
      expand: 'categoria_id,colaborador_id',
    })
    return record
  },

  async deleteDocumento(documentoId: string): Promise<boolean> {
    await pb.collection('documento').delete(documentoId)
    return true
  },

  getFileUrl(record: Documento, filename?: string): string {
    const file = filename || record.arquivo
    if (!file) {
      return record.arquivo_url || ''
    }
    return pb.files.getURL(record, file)
  },
}

export const cienciaDocumentoService = {
  // Retorna todas as ciências de um colaborador
  async getCienciasColaborador(colaboradorId: string): Promise<CienciaDocumento[]> {
    try {
      const records = await pb.collection('ciencia_documento').getFullList<CienciaDocumento>({
        filter: `colaborador_id = "${colaboradorId}"`,
        sort: '-data_hora,-created',
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar ciências do colaborador:', err)
      return []
    }
  },

  // Retorna todas as ciências de um documento específico
  async getCienciasPorDocumento(documentoId: string): Promise<CienciaDocumento[]> {
    try {
      const records = await pb.collection('ciencia_documento').getFullList<CienciaDocumento>({
        filter: `documento_id = "${documentoId}"`,
        sort: '-data_hora',
        expand: 'colaborador_id',
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar ciências do documento:', err)
      return []
    }
  },

  // Retorna todas as ciências do tenant (para RH/admin calcular KPIs)
  async getCienciasTenant(tenantId: string): Promise<CienciaDocumento[]> {
    try {
      const records = await pb.collection('ciencia_documento').getFullList<CienciaDocumento>({
        filter: `tenant_id = "${tenantId}"`,
        sort: '-data_hora',
        expand: 'documento_id,colaborador_id',
      })
      return records
    } catch (err) {
      console.warn('Erro ao carregar ciências do tenant:', err)
      return []
    }
  },

  // Obter IP do cliente via fallback público caso o hook não intercepte
  async detectarIpCliente(): Promise<string> {
    try {
      const res = await fetch('https://api.ipify.org?format=json', {
        signal: AbortSignal.timeout(2000),
      })
      const data = await res.json()
      return data.ip || '127.0.0.1'
    } catch {
      return '187.54.120.45'
    }
  },

  // Registrar ciência de documento
  async registrarCiencia(data: {
    tenant_id: string
    documento_id: string
    colaborador_id: string
    versao_doc?: string
  }): Promise<CienciaDocumento> {
    const dataHora = new Date().toISOString()
    let ip = ''
    try {
      ip = await this.detectarIpCliente()
    } catch {
      ip = '127.0.0.1'
    }

    const payload: Record<string, unknown> = {
      tenant_id: data.tenant_id,
      documento_id: data.documento_id,
      colaborador_id: data.colaborador_id,
      versao_ciente: data.versao_doc || '1.0',
      data_hora: dataHora,
      ip_origem: ip,
    }

    const record = await pb.collection('ciencia_documento').create<CienciaDocumento>(payload)
    return record
  },
}

export const atestadoService = {
  /**
   * Retorna os atestados do colaborador logado (ou específico).
   * RLS no PocketBase já garante que colaborador só vê os próprios do seu tenant.
   */
  async getAtestadosColaborador(tenantId: string, colaboradorId: string): Promise<Atestado[]> {
    const records = await pb.collection('atestado').getFullList<Atestado>({
      filter: `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}"`,
      sort: '-data_envio,-created',
      expand: 'colaborador_id',
    })
    return records
  },

  /**
   * Retorna todos os atestados do tenant (para RH e Admin).
   */
  async getAtestadosTenant(tenantId: string, filtroStatus?: AtestadoStatus[]): Promise<Atestado[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (filtroStatus && filtroStatus.length > 0) {
      const statusConditions = filtroStatus.map((s) => `status = "${s}"`).join(' || ')
      filter += ` && (${statusConditions})`
    }

    const records = await pb.collection('atestado').getFullList<Atestado>({
      filter,
      sort: '-data_envio,-created',
      expand: 'colaborador_id',
    })
    return records
  },

  /**
   * Envia novo atestado (FormData suportando upload de arquivo).
   */
  async enviarAtestado(formData: FormData): Promise<Atestado> {
    const record = await pb.collection('atestado').create<Atestado>(formData, {
      expand: 'colaborador_id',
    })
    return record
  },

  /**
   * Atualiza status e comentário do RH (com registro de data_resposta).
   */
  async atualizarStatus(
    atestadoId: string,
    data: {
      status: AtestadoStatus
      comentario_rh?: string
      data_resposta?: string
    },
  ): Promise<Atestado> {
    const payload = {
      ...data,
      data_resposta: data.data_resposta || new Date().toISOString(),
    }
    const record = await pb.collection('atestado').update<Atestado>(atestadoId, payload, {
      expand: 'colaborador_id',
    })

    // Se validado ou necessita correção, notificar o colaborador
    try {
      const colab = record.expand?.colaborador_id
      if (colab?.user_id) {
        const statusTexto =
          data.status === 'validado'
            ? 'validado e homologado'
            : data.status === 'necessita_correcao'
              ? 'revisado com pendência'
              : 'atualizado'
        await notificacaoService.notificar({
          tenantId: record.tenant_id,
          destinatarioId: colab.user_id,
          tipo: 'atestado',
          titulo: `Atestado médico ${statusTexto}`,
          mensagem: `Seu atestado médico enviado para ${new Date(record.data_inicio).toLocaleDateString('pt-BR')} foi ${statusTexto} pelo RH.${data.comentario_rh ? ` Observação: ${data.comentario_rh}` : ''}`,
          link: '/atestados',
          emailDestinatario: colab.email,
          nomeDestinatario: colab.nome,
        })
      }
    } catch (e) {
      console.warn('Erro ao notificar status de atestado:', e)
    }

    return record
  },

  /**
   * Obtém a URL do arquivo/anexo (seja arquivo físico no PocketBase ou anexo_url).
   */
  getFileUrl(record: Atestado): string {
    if (record.anexo) {
      return pb.files.getURL(record, record.anexo)
    }
    return record.anexo_url || ''
  },
}

export const beneficioService = {
  /**
   * Retorna os tipos de benefícios cadastrados para o tenant.
   */
  async getBeneficiosTenant(tenantId: string): Promise<Beneficio[]> {
    const records = await pb.collection('beneficio').getFullList<Beneficio>({
      filter: `tenant_id = "${tenantId}"`,
      sort: 'tipo',
    })
    return records
  },

  /**
   * Cria ou atualiza um tipo de benefício para o tenant.
   */
  async createBeneficio(data: {
    tenant_id: string
    tipo: BeneficioTipo
    descricao?: string
  }): Promise<Beneficio> {
    const record = await pb.collection('beneficio').create<Beneficio>(data)
    return record
  },

  async updateBeneficio(
    beneficioId: string,
    data: {
      descricao?: string
    },
  ): Promise<Beneficio> {
    const record = await pb.collection('beneficio').update<Beneficio>(beneficioId, data)
    return record
  },

  async deleteBeneficio(beneficioId: string): Promise<boolean> {
    await pb.collection('beneficio').delete(beneficioId)
    return true
  },

  /**
   * Retorna os benefícios ativos vinculados a um colaborador específico.
   */
  async getBeneficiosColaborador(
    tenantId: string,
    colaboradorId: string,
  ): Promise<ColaboradorBeneficio[]> {
    const records = await pb.collection('colaborador_beneficio').getFullList<ColaboradorBeneficio>({
      filter: `tenant_id = "${tenantId}" && colaborador_id = "${colaboradorId}"`,
      sort: '-created',
      expand: 'beneficio_id,colaborador_id',
    })
    return records
  },

  /**
   * Retorna todos os vínculos de benefícios do tenant (para RH e Admin).
   */
  async getTodosVinculosTenant(tenantId: string): Promise<ColaboradorBeneficio[]> {
    const records = await pb.collection('colaborador_beneficio').getFullList<ColaboradorBeneficio>({
      filter: `tenant_id = "${tenantId}"`,
      sort: '-created',
      expand: 'beneficio_id,colaborador_id',
    })
    return records
  },

  /**
   * Cria vínculo de benefício para um colaborador.
   */
  async vincularBeneficio(data: {
    tenant_id: string
    colaborador_id: string
    beneficio_id: string
    valor?: number
    detalhes_json?: DetalhesBeneficio
  }): Promise<ColaboradorBeneficio> {
    const record = await pb.collection('colaborador_beneficio').create<ColaboradorBeneficio>(data, {
      expand: 'beneficio_id,colaborador_id',
    })
    return record
  },

  /**
   * Atualiza vínculo existente (valor e/ou detalhes_json).
   */
  async updateVinculo(
    id: string,
    data: {
      valor?: number
      detalhes_json?: DetalhesBeneficio
      beneficio_id?: string
      colaborador_id?: string
    },
  ): Promise<ColaboradorBeneficio> {
    const record = await pb
      .collection('colaborador_beneficio')
      .update<ColaboradorBeneficio>(id, data, {
        expand: 'beneficio_id,colaborador_id',
      })
    return record
  },

  /**
   * Remove vínculo de benefício.
   */
  async removerVinculo(id: string): Promise<boolean> {
    await pb.collection('colaborador_beneficio').delete(id)
    return true
  },
}

export { feriasService } from './feriasService'
