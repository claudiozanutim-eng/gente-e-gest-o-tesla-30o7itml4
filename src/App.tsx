/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ProtectedRoute, PublicRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

// Pages
import LoginPage from '@/pages/Login'
import EsqueciSenhaPage from '@/pages/EsqueciSenha'
import PortalColaborador from '@/pages/PortalColaborador'
import DashboardEquipe from '@/pages/DashboardEquipe'
import DashboardRH from '@/pages/DashboardRH'
import AdminPage from '@/pages/AdminPage'
import ColaboradoresPage from '@/pages/ColaboradoresPage'

// Module placeholders
import VagasPage from '@/pages/modules/VagasPage'
import CandidatosPage from '@/pages/modules/CandidatosPage'
import EstruturaPage from '@/pages/modules/EstruturaPage'
import PontoPage from '@/pages/modules/PontoPage'
import EscalasPage from '@/pages/modules/EscalasPage'
import DocumentosPage from '@/pages/modules/DocumentosPage'
import MeuPerfilPage from '@/pages/modules/MeuPerfilPage'
import FeriasPage from '@/pages/modules/FeriasPage'
import BeneficiosPage from '@/pages/modules/BeneficiosPage'
import AtestadosPage from '@/pages/modules/AtestadosPage'
import NotFound from '@/pages/NotFound'

// Root redirect handler based on user profile or login
function RootRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="h-screen w-screen bg-[#F5F5F5]" />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  switch (user.perfil) {
    case 'colaborador':
      return <Navigate to="/portal" replace />
    case 'gestor':
      return <Navigate to="/dashboard-equipe" replace />
    case 'rh':
      return <Navigate to="/dashboard-rh" replace />
    case 'admin':
      return <Navigate to="/admin" replace />
    default:
      return <Navigate to="/portal" replace />
  }
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/esqueci-senha"
            element={
              <PublicRoute>
                <EsqueciSenhaPage />
              </PublicRoute>
            }
          />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Authenticated Layout and Protected Routes */}
          <Route element={<Layout />}>
            {/* Colaborador Home */}
            <Route
              path="/portal"
              element={
                <ProtectedRoute allowedProfiles={['colaborador', 'gestor', 'rh', 'admin']}>
                  <PortalColaborador />
                </ProtectedRoute>
              }
            />

            {/* Gestor Home */}
            <Route
              path="/dashboard-equipe"
              element={
                <ProtectedRoute allowedProfiles={['gestor', 'rh', 'admin']}>
                  <DashboardEquipe />
                </ProtectedRoute>
              }
            />

            {/* RH Home */}
            <Route
              path="/dashboard-rh"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <DashboardRH />
                </ProtectedRoute>
              }
            />

            {/* Admin Home and Sub-routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedProfiles={['admin']}>
                  <AdminPage initialTab="tenant" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tenant"
              element={
                <ProtectedRoute allowedProfiles={['admin']}>
                  <AdminPage initialTab="tenant" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <ProtectedRoute allowedProfiles={['admin']}>
                  <AdminPage initialTab="usuarios" />
                </ProtectedRoute>
              }
            />

            {/* Gestão de Talentos (RH & Admin) */}
            <Route
              path="/vagas"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <VagasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/candidatos"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <CandidatosPage />
                </ProtectedRoute>
              }
            />

            {/* Gestão de Pessoas (Base de Colaboradores restrita a RH e Admin) */}
            <Route
              path="/colaboradores"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <ColaboradoresPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/estrutura"
              element={
                <ProtectedRoute allowedProfiles={['gestor', 'rh', 'admin']}>
                  <EstruturaPage />
                </ProtectedRoute>
              }
            />

            {/* Gestão do Tempo (Colaborador, Gestor, RH & Admin) */}
            <Route
              path="/ponto"
              element={
                <ProtectedRoute allowedProfiles={['colaborador', 'gestor', 'rh', 'admin']}>
                  <PontoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/escalas"
              element={
                <ProtectedRoute allowedProfiles={['colaborador', 'gestor', 'rh', 'admin']}>
                  <EscalasPage />
                </ProtectedRoute>
              }
            />

            {/* Portal do Colaborador - Atalhos */}
            <Route
              path="/meus-documentos"
              element={
                <ProtectedRoute allowedProfiles={['colaborador', 'gestor', 'rh', 'admin']}>
                  <DocumentosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meu-perfil"
              element={
                <ProtectedRoute allowedProfiles={['colaborador', 'gestor', 'rh', 'admin']}>
                  <MeuPerfilPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/minhas-ferias"
              element={
                <ProtectedRoute allowedProfiles={['colaborador', 'gestor', 'rh', 'admin']}>
                  <FeriasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/beneficios"
              element={
                <ProtectedRoute allowedProfiles={['colaborador', 'gestor', 'rh', 'admin']}>
                  <BeneficiosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/atestados"
              element={
                <ProtectedRoute allowedProfiles={['colaborador', 'gestor', 'rh', 'admin']}>
                  <AtestadosPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
