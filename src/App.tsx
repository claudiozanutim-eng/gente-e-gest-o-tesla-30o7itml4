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
import GestaoDocumentosPage from '@/pages/GestaoDocumentosPage'
import DocumentosImportantesPage from '@/pages/DocumentosImportantesPage'
import PendenciasDocumentaisPage from '@/pages/PendenciasDocumentaisPage'

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
import GestaoBeneficiosPage from '@/pages/modules/GestaoBeneficiosPage'
import AtestadosPage from '@/pages/modules/AtestadosPage'
import ValidacaoAtestadosPage from '@/pages/modules/ValidacaoAtestadosPage'
import RelatoriosPage from '@/pages/RelatoriosPage'
import MinhasAvaliacoesPage from '@/pages/modules/MinhasAvaliacoesPage'
import MinhaEquipePage from '@/pages/modules/MinhaEquipePage'
import AvaliacoesAdminPage from '@/pages/modules/AvaliacoesAdminPage'
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
      return <Navigate to="/dashboard" replace />
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

            {/* RH Home - Rota canônica /dashboard e redirect de /dashboard-rh */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <DashboardRH />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard-rh" element={<Navigate to="/dashboard" replace />} />

            {/* Pendências Documentais (RH & Admin) */}
            <Route
              path="/pendencias-documentais"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <PendenciasDocumentaisPage />
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

            {/* Gestão de Pessoas (Base de Colaboradores e Documentos restrita a RH e Admin) */}
            <Route
              path="/colaboradores"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <ColaboradoresPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documentos"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <GestaoDocumentosPage />
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
              path="/documentos-importantes"
              element={
                <ProtectedRoute allowedProfiles={['colaborador', 'gestor', 'rh', 'admin']}>
                  <DocumentosImportantesPage />
                </ProtectedRoute>
              }
            />
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
            {/* Gestão de Benefícios exclusiva para RH e Admin */}
            <Route
              path="/beneficios/gestao"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <GestaoBeneficiosPage />
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
            {/* Validação de Atestados para RH e Admin */}
            <Route
              path="/atestados/validacao"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <ValidacaoAtestadosPage />
                </ProtectedRoute>
              }
            />

            {/* Avaliação de Desempenho (Prompt 13) */}
            <Route
              path="/avaliacoes"
              element={
                <ProtectedRoute allowedProfiles={['colaborador', 'gestor', 'rh', 'admin']}>
                  <MinhasAvaliacoesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/minha-equipe"
              element={
                <ProtectedRoute allowedProfiles={['gestor', 'rh', 'admin']}>
                  <MinhaEquipePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/avaliacoes/admin"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <AvaliacoesAdminPage />
                </ProtectedRoute>
              }
            />

            {/* Relatórios e Exportações (RH & Admin) */}
            <Route
              path="/relatorios"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin']}>
                  <RelatoriosPage />
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
