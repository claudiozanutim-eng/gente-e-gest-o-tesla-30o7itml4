import React, { useState, useEffect } from 'react'
import { FileText, User, ShieldAlert, ArrowRight, Briefcase, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { colaboradorService } from '@/services/api'
import { Colaborador } from '@/types'
import { DemonstrativoFinanceiroView } from '@/components/folha/DemonstrativoFinanceiroView'
import { ModalImportarHoleritePDF } from '@/components/folha/ModalImportarHoleritePDF'
import { NavLink } from 'react-router-dom'

export const DemonstrativoPage: React.FC = () => {
  const { user } = useAuth()
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [todosColaboradores, setTodosColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [modalImportarPdfAberto, setModalImportarPdfAberto] = useState<boolean>(false)
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0)

  useEffect(() => {
    async function loadColaborador() {
      if (!user) return
      setLoading(true)
      setErrorMsg(null)
      try {
        // Carrega lista geral para modal de importação se for admin
        if (user.perfil === 'admin_rh' || user.perfil === 'admin' || user.perfil === 'rh') {
          const list = await colaboradorService.getColaboradores(user.tenant_id)
          setTodosColaboradores(list)
        }

        // Se o usuário já tiver vínculo com colaborador pelo id do user
        const colab = await colaboradorService.getColaboradorByUserId(user.id)
        if (colab) {
          setColaborador(colab)
        } else {
          // Se for RH/Admin ou não encontrar direto, buscar primeiro colaborador do tenant para demonstração
          if (user.perfil === 'rh' || user.perfil === 'admin' || user.perfil === 'admin_rh') {
            const list = await colaboradorService.getColaboradores(user.tenant_id)
            if (list.length > 0) {
              setColaborador(list[0])
            } else {
              setErrorMsg('Nenhum colaborador cadastrado neste tenant.')
            }
          } else {
            // Tenta localizar por e-mail do usuário se o user_id não estiver preenchido
            const list = await colaboradorService.getColaboradores(user.tenant_id)
            const matchEmail = list.find(
              (c) => c.email && c.email.toLowerCase() === user.email.toLowerCase(),
            )
            if (matchEmail) {
              setColaborador(matchEmail)
            } else if (list.length > 0) {
              setColaborador(list[0])
            } else {
              setErrorMsg('Cadastro de colaborador não localizado para o usuário logado.')
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados do colaborador:', err)
        setErrorMsg('Falha ao comunicar com o servidor para obter dados do colaborador.')
      } finally {
        setLoading(false)
      }
    }

    loadColaborador()
  }, [user, refreshTrigger])

  const canManageRH =
    user?.perfil === 'rh' || user?.perfil === 'admin' || user?.perfil === 'admin_rh'
  const podeImportarPdf = user?.perfil === 'admin_rh' || user?.perfil === 'admin'

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0D47A1]">
            <FileText className="h-4 w-4" />
            <span>Portal do Colaborador • Finanças</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#212121] mt-1">
            Demonstrativo de Pagamento
          </h1>
          <p className="text-sm text-[#757575] mt-0.5">
            Consulta detalhada de lançamentos periódicos (remuneração e benefícios) e eventos
            pontuais do mês.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {podeImportarPdf && (
            <Button
              size="sm"
              onClick={() => setModalImportarPdfAberto(true)}
              className="bg-[#0D47A1] hover:bg-[#0B3D91] text-white text-xs h-9 gap-1.5 shadow-sm font-semibold"
              title="Importar holerites em PDF no modelo oficial Tesla"
            >
              <FileText className="h-4 w-4" />
              Importar Holerite (PDF)
            </Button>
          )}

          {canManageRH && (
            <Button
              asChild
              variant="outline"
              className="border-[#0D47A1] text-[#0D47A1] hover:bg-blue-50 text-xs h-9 gap-2 font-semibold"
            >
              <NavLink to="/folha/gestao">
                <Briefcase className="h-3.5 w-3.5" />
                Gestão Geral da Folha
                <ArrowRight className="h-3.5 w-3.5" />
              </NavLink>
            </Button>
          )}
        </div>
      </div>

      {/* Card com identificação do colaborador */}
      {loading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : colaborador ? (
        <Card className="border border-[#E0E0E0] bg-white shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-[#E8EEF7] text-[#0D47A1] font-bold flex items-center justify-center text-base border border-blue-200 shrink-0 overflow-hidden">
                {colaborador.foto_url ? (
                  <img
                    src={colaborador.foto_url}
                    alt={colaborador.nome}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-6 w-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#212121]">
                    {colaborador.nome_completo || colaborador.nome}
                  </h2>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold"
                  >
                    Ativo
                  </Badge>
                </div>
                <p className="text-xs text-[#757575]">
                  Cargo: <strong className="text-[#212121]">{colaborador.cargo || '—'}</strong> •
                  Setor:{' '}
                  <strong className="text-[#212121]">{colaborador.departamento || '—'}</strong> •
                  CPF: <strong className="font-mono text-[#212121]">{colaborador.cpf}</strong>
                </p>
              </div>
            </div>

            {colaborador.dados_bancarios && (
              <div className="bg-[#FAFAFA] border border-[#E0E0E0] rounded-lg p-2.5 text-xs text-right hidden lg:block">
                <span className="text-[10px] uppercase font-semibold text-[#757575] block">
                  Conta para Depósito Salarial
                </span>
                <span className="font-mono text-[11px] font-bold text-[#212121]">
                  {colaborador.dados_bancarios}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : errorMsg ? (
        <div className="p-6 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3 text-amber-800 text-xs">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      {/* View Principal com Seletor de Mês/Ano, Cards de Resumo e Tabelas */}
      {colaborador && user && (
        <DemonstrativoFinanceiroView
          tenantId={user.tenant_id}
          colaboradorId={colaborador.id}
          colaborador={colaborador}
          canManage={false} // Nesta tela (do colaborador), o modo é somente leitura para o usuário
          refreshTrigger={refreshTrigger}
        />
      )}

      {/* Modal de Importação de Holerites em PDF */}
      {user && podeImportarPdf && (
        <ModalImportarHoleritePDF
          open={modalImportarPdfAberto}
          onClose={() => setModalImportarPdfAberto(false)}
          tenantId={user.tenant_id}
          userId={user.id}
          colaboradores={
            todosColaboradores.length > 0 ? todosColaboradores : colaborador ? [colaborador] : []
          }
          colaboradorPreSelecionado={colaborador}
          onSuccess={() => {
            setRefreshTrigger((prev) => prev + 1)
          }}
        />
      )}
    </div>
  )
}

export default DemonstrativoPage
