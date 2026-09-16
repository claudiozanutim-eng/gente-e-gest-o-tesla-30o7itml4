import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { UserPerfil, PROFILE_HOME_MAP, PermissaoMenuKey } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermission } from '@/hooks/usePermission'
import { ROTA_PARA_CHAVE_MAP } from '@/services/permissaoUsuarioService'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedProfiles?: UserPerfil[]
  minProfile?: UserPerfil
  permissionKey?: PermissaoMenuKey
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedProfiles,
  minProfile,
  permissionKey,
}) => {
  const { user, isLoading, isAuthenticated } = useAuth()
  const { hasAnyPerfil, hasMinPerfil, podeAcessarItem, userFlags } = usePermission()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F5F5F5] p-6">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-[#E0E0E0] bg-white p-8 shadow-sm">
          <Skeleton className="h-8 w-3/4 bg-slate-200" />
          <Skeleton className="h-4 w-full bg-slate-100" />
          <Skeleton className="h-10 w-full bg-slate-200" />
          <Skeleton className="h-24 w-full bg-slate-100" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Determina a chave de permissão para esta rota (seja passada explicitamente ou mapeada pelo pathname)
  const resolvedKey: PermissaoMenuKey | undefined =
    permissionKey || ROTA_PARA_CHAVE_MAP[location.pathname]

  // Se houver uma chave de permissão associada a esta rota:
  // As flags individuais funcionam como exceção prioritária:
  // 1. Se flag = 'bloqueado' -> bloqueia imediatamente mesmo se o perfil permitir
  // 2. Se flag = 'liberado' -> concede imediatamente mesmo se o perfil não permitir
  // 3. Se flag = 'padrao' (ou sem flag) -> segue a checagem padrão de allowedProfiles/minProfile
  if (resolvedKey) {
    const flag = userFlags?.[resolvedKey] || 'padrao'
    if (flag === 'bloqueado') {
      const profileHome = PROFILE_HOME_MAP[user.perfil] || '/portal'
      return <Navigate to={profileHome} replace />
    }
    if (flag === 'liberado') {
      // Concedido individualmente pela flag de liberação
      return <>{children}</>
    }
  }

  // Profile-based route protection (by allowed list or minimum hierarchy)
  if (allowedProfiles && allowedProfiles.length > 0) {
    if (!hasAnyPerfil(allowedProfiles)) {
      const profileHome = PROFILE_HOME_MAP[user.perfil] || '/portal'
      return <Navigate to={profileHome} replace />
    }
  } else if (minProfile) {
    if (!hasMinPerfil(minProfile)) {
      const profileHome = PROFILE_HOME_MAP[user.perfil] || '/portal'
      return <Navigate to={profileHome} replace />
    }
  }

  return <>{children}</>
}

export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F5F5F5] p-6">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-[#E0E0E0] bg-white p-8 shadow-sm">
          <Skeleton className="h-8 w-1/2 bg-slate-200 mx-auto" />
          <Skeleton className="h-10 w-full bg-slate-100" />
          <Skeleton className="h-10 w-full bg-slate-100" />
        </div>
      </div>
    )
  }

  if (isAuthenticated && user) {
    const profileHome = PROFILE_HOME_MAP[user.perfil] || '/portal'
    return <Navigate to={profileHome} replace />
  }

  return <>{children}</>
}
