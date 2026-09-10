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
import GestaoPontoPage from '@/pages/modules/GestaoPontoPage'
import DocumentosPage from '@/pages/modules/DocumentosPage'
import MeuPerfilPage from '@/pages/modules/MeuPerfilPage'
import FeriasPage from '@/pages/modules/FeriasPage'
import AprovacoesFeriasPage from '@/pages/modules/AprovacoesFeriasPage'
import BeneficiosPage from '@/pages/modules/BeneficiosPage'
import GestaoBeneficiosPage from '@/pages/modules/GestaoBeneficiosPage'
import AtestadosPage from '@/pages/modules/AtestadosPage'
import ValidacaoAtestadosPage from '@/pages/modules/ValidacaoAtestadosPage'
import RelatoriosPage from '@/pages/RelatoriosPage'
import MinhasAvaliacoesPage from '@/pages/modules/MinhasAvaliacoesPage'
import MinhaEquipePage from '@/pages/modules/MinhaEquipePage'
import AvaliacoesAdminPage from '@/pages/modules/AvaliacoesAdminPage'
import DemonstrativoPage from '@/pages/DemonstrativoPage'
import GestaoFolhaPage from '@/pages/GestaoFolhaPage'
import BancoHorasColaboradorPage from '@/pages/modules/BancoHorasColaboradorPage'
import FechamentoBancoHorasPage from '@/pages/modules/FechamentoBancoHorasPage'
import PortalGestorPage from '@/pages/modules/PortalGestorPage'
import GestaoComunicadosPage from '@/pages/modules/GestaoComunicadosPage'
import AlteracoesPendentesPage from '@/pages/modules/AlteracoesPendentesPage'
import AdminConfiguracoesPage from '@/pages/modules/AdminConfiguracoesPage'
import AdminUsuariosPage from '@/pages/modules/AdminUsuariosPage'
import AdminLogsPage from '@/pages/modules/AdminLogsPage'
import AdminEmailPage from '@/pages/modules/AdminEmailPage'
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
      return <Navigate to="/portal-gestor" replace />
    case 'rh':
    case 'admin_rh':
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
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <PortalColaborador />
                </ProtectedRoute>
              }
            />

            {/* Gestor Home & Portal do Gestor Consolidado */}
            <Route
              path="/dashboard-equipe"
              element={
                <ProtectedRoute allowedProfiles={['gestor', 'rh', 'admin_rh', 'admin']}>
                  <DashboardEquipe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal-gestor"
              element={
                <ProtectedRoute allowedProfiles={['gestor', 'rh', 'admin_rh', 'admin']}>
                  <PortalGestorPage />
                </ProtectedRoute>
              }
            />

            {/* RH Home - Rota canônica /dashboard ('rh', 'admin_rh', 'admin') */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <DashboardRH />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard-rh" element={<Navigate to="/dashboard" replace />} />

            {/* Pendências Documentais ('rh', 'admin_rh', 'admin') */}
            <Route
              path="/pendencias-documentais"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <PendenciasDocumentaisPage />
                </ProtectedRoute>
              }
            />

            {/* Comunicados Gestão ('rh', 'admin_rh', 'admin') */}
            <Route
              path="/comunicados/gestao"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <GestaoComunicadosPage />
                </ProtectedRoute>
              }
            />

            {/* Aprovação de Alterações Cadastrais ('rh', 'admin_rh', 'admin') */}
            <Route
              path="/alteracoes/pendentes"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <AlteracoesPendentesPage />
                </ProtectedRoute>
              }
            />

            {/* Menu de Administração - Configurações e Usuários: APENAS 'admin' */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedProfiles={['admin']}>
                  <AdminConfiguracoesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/configuracoes"
              element={
                <ProtectedRoute allowedProfiles={['admin']}>
                  <AdminConfiguracoesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/email"
              element={
                <ProtectedRoute allowedProfiles={['admin']}>
                  <AdminEmailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <ProtectedRoute allowedProfiles={['admin']}>
                  <AdminUsuariosPage />
                </ProtectedRoute>
              }
            />
            {/* Logs de Auditoria: 'admin_rh' e 'admin' */}
            <Route
              path="/admin/logs"
              element={
                <ProtectedRoute allowedProfiles={['admin_rh', 'admin']}>
                  <AdminLogsPage />
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

            {/* Gestão de Talentos ('rh', 'admin_rh', 'admin') */}
            <Route
              path="/vagas"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <VagasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/candidatos"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <CandidatosPage />
                </ProtectedRoute>
              }
            />

            {/* Gestão de Pessoas - Base de Colaboradores e Documentos ('rh', 'admin_rh', 'admin') */}
            <Route
              path="/colaboradores"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <ColaboradoresPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documentos"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <GestaoDocumentosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/estrutura"
              element={
                <ProtectedRoute allowedProfiles={['gestor', 'rh', 'admin_rh', 'admin']}>
                  <EstruturaPage />
                </ProtectedRoute>
              }
            />

            {/* Gestão do Tempo */}
            <Route
              path="/ponto"
              element={
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <PontoPage />
                </ProtectedRoute>
              }
            />
            {/* Ponto Gestão ('gestor', 'rh', 'admin_rh', 'admin') */}
            <Route
              path="/ponto/gestao"
              element={
                <ProtectedRoute allowedProfiles={['gestor', 'rh', 'admin_rh', 'admin']}>
                  <GestaoPontoPage />
                </ProtectedRoute>
              }
            />
            {/* Escalas de Trabalho: 'admin_rh' e 'admin' */}
            <Route
              path="/escalas"
              element={
                <ProtectedRoute allowedProfiles={['admin_rh', 'admin']}>
                  <EscalasPage />
                </ProtectedRoute>
              }
            />
            {/* Banco de Horas (Colaborador - Self-service) */}
            <Route
              path="/banco-horas"
              element={
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <BancoHorasColaboradorPage />
                </ProtectedRoute>
              }
            />
            {/* Fechamento Banco de Horas (RH / Admin RH / Admin) */}
            <Route
              path="/banco-horas/fechamento"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <FechamentoBancoHorasPage />
                </ProtectedRoute>
              }
            />

            {/* Portal do Colaborador - Atalhos */}
            <Route
              path="/documentos-importantes"
              element={
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <DocumentosImportantesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meus-documentos"
              element={
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <DocumentosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meu-perfil"
              element={
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <MeuPerfilPage />
                </ProtectedRoute>
              }
            />
            {/* Férias do Colaborador: rota canônica /ferias e compatibilidade /minhas-ferias */}
            <Route
              path="/ferias"
              element={
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <FeriasPage />
                </ProtectedRoute>
              }
            />
            <Route path="/minhas-ferias" element={<Navigate to="/ferias" replace />} />
            {/* Férias Aprovações ('gestor', 'rh', 'admin_rh', 'admin') */}
            <Route
              path="/ferias/aprovacoes"
              element={
                <ProtectedRoute allowedProfiles={['gestor', 'rh', 'admin_rh', 'admin']}>
                  <AprovacoesFeriasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/beneficios"
              element={
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <BeneficiosPage />
                </ProtectedRoute>
              }
            />
            {/* Gestão de Benefícios ('rh', 'admin_rh', 'admin') */}
            <Route
              path="/beneficios/gestao"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <GestaoBeneficiosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/atestados"
              element={
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <AtestadosPage />
                </ProtectedRoute>
              }
            />
            {/* Validação de Atestados ('rh', 'admin_rh', 'admin') */}
            <Route
              path="/atestados/validacao"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <ValidacaoAtestadosPage />
                </ProtectedRoute>
              }
            />

            {/* Avaliação de Desempenho */}
            <Route
              path="/avaliacoes"
              element={
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <MinhasAvaliacoesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/minha-equipe"
              element={
                <ProtectedRoute allowedProfiles={['gestor', 'rh', 'admin_rh', 'admin']}>
                  <MinhaEquipePage />
                </ProtectedRoute>
              }
            />
            {/* Avaliações Admin (Ciclos e Competências): 'admin_rh' e 'admin' */}
            <Route
              path="/avaliacoes/admin"
              element={
                <ProtectedRoute allowedProfiles={['admin_rh', 'admin']}>
                  <AvaliacoesAdminPage />
                </ProtectedRoute>
              }
            />

            {/* Relatórios e Exportações ('rh', 'admin_rh', 'admin') */}
            <Route
              path="/relatorios"
              element={
                <ProtectedRoute allowedProfiles={['rh', 'admin_rh', 'admin']}>
                  <RelatoriosPage />
                </ProtectedRoute>
              }
            />

            {/* Folha de Pagamento & Demonstrativos */}
            <Route
              path="/demonstrativo"
              element={
                <ProtectedRoute
                  allowedProfiles={['colaborador', 'gestor', 'rh', 'admin_rh', 'admin']}
                >
                  <DemonstrativoPage />
                </ProtectedRoute>
              }
            />
            {/* Folha Gestão: 'admin_rh' e 'admin' */}
            <Route
              path="/folha/gestao"
              element={
                <ProtectedRoute allowedProfiles={['admin_rh', 'admin']}>
                  <GestaoFolhaPage />
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
