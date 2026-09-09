import pb from '@/lib/pocketbase/client'
import { Tenant, AppUser, Colaborador, UserPerfil } from '@/types'

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
}
