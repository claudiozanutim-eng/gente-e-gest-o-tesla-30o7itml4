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

export const tenantService = {
  async getTenant(tenantId: string): Promise<Tenant> {
    const record = await pb.collection('tenant').getOne<Tenant>(tenantId)
    return record
  },

  async updateTenant(
    tenantId: string,
    data: Partial<Pick<Tenant, 'plano' | 'status'>>,
  ): Promise<Tenant> {
    const record = await pb.collection('tenant').update<Tenant>(tenantId, data)
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

  async updateUserPerfil(userId: string, perfil: UserPerfil): Promise<AppUser> {
    const record = await pb.collection('users').update<AppUser>(userId, { perfil })
    return record
  },

  async inviteUser(
    email: string,
    perfil: UserPerfil,
    name?: string,
  ): Promise<{ success: boolean; message: string; user?: AppUser }> {
    const response = await pb.send<{ success: boolean; message: string; user?: AppUser }>(
      '/backend/v1/custom/invite-user',
      {
        method: 'POST',
        body: { email, perfil, name },
      },
    )
    return response
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
}

export const solicitacaoService = {
  async getSolicitacoesByColaborador(colaboradorId: string): Promise<SolicitacaoAlteracao[]> {
    const records = await pb.collection('solicitacao_alteracao').getFullList<SolicitacaoAlteracao>({
      filter: `colaborador_id = "${colaboradorId}"`,
      sort: '-created',
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
}

export const comunicadoService = {
  async getComunicados(tenantId: string): Promise<import('@/types').Comunicado[]> {
    const records = await pb.collection('comunicado').getFullList<import('@/types').Comunicado>({
      filter: `tenant_id = "${tenantId}"`,
      sort: '-data_publicacao,-created',
    })
    return records
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
