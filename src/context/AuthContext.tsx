import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { AppUser, Colaborador, UserPerfil, PROFILE_HOME_MAP, PermissoesFlags } from '@/types'
import { colaboradorService } from '@/services/api'
import { permissaoUsuarioService } from '@/services/permissaoUsuarioService'

interface AuthContextType {
  user: AppUser | null
  colaborador: Colaborador | null
  userFlags: PermissoesFlags
  isLoading: boolean
  isAuthenticated: boolean
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; user?: AppUser }>
  logout: () => void
  refreshProfile: () => Promise<void>
  refreshUserFlags: () => Promise<void>
  getHomeRoute: () => string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null)
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [userFlags, setUserFlags] = useState<PermissoesFlags>({})
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const fetchProfileAndColaborador = async (authModel: Record<string, unknown> | null) => {
    if (!authModel) {
      setUser(null)
      setColaborador(null)
      setUserFlags({})
      return
    }

    try {
      // Re-fetch the fresh user record from the DB to guarantee fields like perfil and tenant_id
      const currentUser = await pb.collection('users').getOne<AppUser>(authModel.id as string)
      setUser(currentUser)

      // Fetch linked colaborador details if any
      const colab = await colaboradorService.getColaboradorByUserId(currentUser.id)
      setColaborador(colab)

      // Fetch user custom permission flags
      try {
        const permRec = await permissaoUsuarioService.getPermissaoPorUsuario(currentUser.id)
        setUserFlags(permRec?.flags_json || {})
      } catch {
        setUserFlags({})
      }
    } catch {
      // Fallback to auth model if direct fetch fails
      const fallbackUser: AppUser = {
        id: (authModel.id as string) || '',
        email: (authModel.email as string) || '',
        name: (authModel.name as string) || '',
        perfil: (authModel.perfil as UserPerfil) || 'colaborador',
        tenant_id: (authModel.tenant_id as string) || '',
        avatar: (authModel.avatar as string) || '',
        created: (authModel.created as string) || '',
        updated: (authModel.updated as string) || '',
      }
      setUser(fallbackUser)
      setUserFlags({})
    }
  }

  const refreshUserFlags = async () => {
    if (user?.id) {
      try {
        const permRec = await permissaoUsuarioService.getPermissaoPorUsuario(user.id)
        setUserFlags(permRec?.flags_json || {})
      } catch {
        setUserFlags({})
      }
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true)
      if (pb.authStore.isValid && pb.authStore.record) {
        await fetchProfileAndColaborador(pb.authStore.record as unknown as Record<string, unknown>)
      } else {
        setUser(null)
        setColaborador(null)
      }
      setIsLoading(false)
    }

    initAuth()

    // Listen to changes in auth store
    const unsubscribe = pb.authStore.onChange(async () => {
      if (pb.authStore.isValid && pb.authStore.record) {
        await fetchProfileAndColaborador(pb.authStore.record as unknown as Record<string, unknown>)
      } else {
        setUser(null)
        setColaborador(null)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email.trim(), password)
      if (authData && authData.record) {
        await fetchProfileAndColaborador(authData.record as unknown as Record<string, unknown>)
        const freshUser = await pb.collection('users').getOne<AppUser>(authData.record.id)
        return { success: true, user: freshUser }
      }
      return { success: false, error: 'E-mail ou senha inválidos' }
    } catch {
      return { success: false, error: 'E-mail ou senha inválidos' }
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setColaborador(null)
    setUserFlags({})
  }

  const refreshProfile = async () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      await fetchProfileAndColaborador(pb.authStore.record as unknown as Record<string, unknown>)
    }
  }

  const getHomeRoute = (): string => {
    if (!user || !user.perfil) return '/login'
    return PROFILE_HOME_MAP[user.perfil] || '/portal'
  }

  const value = useMemo(
    () => ({
      user,
      colaborador,
      userFlags,
      isLoading,
      isAuthenticated: !!user && pb.authStore.isValid,
      login,
      logout,
      refreshProfile,
      refreshUserFlags,
      getHomeRoute,
    }),
    [user, colaborador, userFlags, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
