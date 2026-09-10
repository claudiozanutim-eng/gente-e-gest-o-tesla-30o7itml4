import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { UserPerfil, PROFILE_HOME_MAP } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermission } from '@/hooks/usePermission'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedProfiles?: UserPerfil[]
  minProfile?: UserPerfil
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedProfiles,
  minProfile,
}) => {
  const { user, isLoading, isAuthenticated } = useAuth()
  const { hasAnyPerfil, hasMinPerfil } = usePermission()
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
