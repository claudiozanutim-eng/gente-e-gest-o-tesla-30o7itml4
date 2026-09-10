import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Palmtree,
  Stethoscope,
  FileWarning,
  Building,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  History,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  colaboradorService,
  documentoService,
  cienciaDocumentoService,
  atestadoService,
  logAuditoriaService,
} from '@/services/api'
import { feriasService, ColaboradorFeriasStatus } from '@/services/feriasService'
import { humanizarLogAuditoria, LogHumanizado } from '@/services/logFormatService'
import { useRealtime } from '@/hooks/use-realtime'
import { Colaborador, Documento, CienciaDocumento, Atestado, LogAuditoria } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ModalFeriasProximas } from '@/components/dashboard/ModalFeriasProximas'
import { AssistenteConsultaClt } from '@/components/clt/AssistenteConsultaClt'

export default function DashboardRH() {
  const { user } = useAuth()
  const tenantId = user?.tenant_id
  const navigate = useNavigate()

  // Estados dos dados principais
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [documentosObrigatorios, setDocumentosObrigatorios] = useState<Documento[]>([])
  const [ciencias, setCiencias] = useState<CienciaDocumento[]>([])
  const [atestados, setAtestados] = useState<Atestado[]>([])
  const [logsRecentes, setLogsRecentes] = useState<LogAuditoria[]>([])
  const [loading, setLoading] = useState(true)

  // Controle do modal de férias próximas
  const [modalFeriasOpen, setModalFeriasOpen] = useState(false)

  // Carregar todos os dados consolidados do tenant
  const carregarDados = useCallback(async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const [colabs, docs, cienciasList, atestadosList, logsList] = await Promise.all([
        colaboradorService.getColaboradores(tenantId),
        documentoService.getDocumentos(tenantId),
        cienciaDocumentoService.getCienciasTenant(tenantId),
        atestadoService.getAtestadosTenant(tenantId),
        logAuditoriaService.getLogsRecentesTenant(tenantId, 10),
      ])

      setColaboradores(colabs)
      // Somente documentos corporativos obrigatórios (sem colaborador_id específico)
      setDocumentosObrigatorios(docs.filter((d) => d.obrigatorio && !d.colaborador_id))
      setCiencias(cienciasList)
      setAtestados(atestadosList)
      setLogsRecentes(logsList)
    } catch (err) {
      console.error('Erro ao carregar dados do Dashboard RH:', err)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Subscrições Realtime no PocketBase com cleanup automático ao desmontar
  useRealtime('colaborador', () => carregarDados(), Boolean(tenantId))
  useRealtime('atestado', () => carregarDados(), Boolean(tenantId))
  useRealtime('ciencia_documento', () => carregarDados(), Boolean(tenantId))
  useRealtime('log_auditoria', () => carregarDados(), Boolean(tenantId))
  useRealtime('solicitacao_alteracao', () => carregarDados(), Boolean(tenantId))

  // 1. KPI: Total de Colaboradores Ativos
  const colaboradoresAtivos = useMemo(
    () => colaboradores.filter((c) => c.status === 'ativo'),
    [colaboradores],
  )
  const totalColaboradoresAtivos = colaboradoresAtivos.length

  // 2. KPI: Férias Próximas do Vencimento (<= hoje + 60 dias)
  const analiseFerias = useMemo(() => {
    return feriasService.analisarFeriasProximas(colaboradoresAtivos)
  }, [colaboradoresAtivos])
  const totalFeriasProximas = analiseFerias.totalProximos

  // 3. KPI: Atestados Aguardando Aprovação (status = 'recebido' || 'em_analise')
  const atestadosAguardando = useMemo(() => {
    return atestados.filter((a) => a.status === 'recebido' || a.status === 'em_analise')
  }, [atestados])
  const totalAtestadosAguardando = atestadosAguardando.length

  // 4. KPI: Pessoas sem Ciência na Versão Mais Recente dos Documentos Obrigatórios
  const pessoasSemCiencia = useMemo(() => {
    if (documentosObrigatorios.length === 0 || colaboradoresAtivos.length === 0) {
      return 0
    }

    const colabsSemCienciaSet = new Set<string>()

    documentosObrigatorios.forEach((doc) => {
      const versaoVigente = (doc.versao || '1.0').trim()
      const cientesDesteDoc = new Set(
        ciencias
          .filter(
            (c) => c.documento_id === doc.id && (c.versao_ciente || '').trim() === versaoVigente,
          )
          .map((c) => c.colaborador_id),
      )

      colaboradoresAtivos.forEach((colab) => {
        if (!cientesDesteDoc.has(colab.id)) {
          colabsSemCienciaSet.add(colab.id)
        }
      })
    })

    return colabsSemCienciaSet.size
  }, [documentosObrigatorios, colaboradoresAtivos, ciencias])

  // 5. Atividades Recentes Humanizadas via logFormatService
  const logsHumanizados = useMemo<LogHumanizado[]>(() => {
    return logsRecentes.map(humanizarLogAuditoria)
  }, [logsRecentes])

  return (
    <div className="space-y-6">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">Dashboard RH</h1>
            <Badge
              variant="outline"
              className="bg-[#E0F2F1] text-[#00695C] border-[#00695C]/30 text-xs px-2.5 py-0.5 font-semibold"
            >
              Tempo Real
            </Badge>
          </div>
          <p className="text-sm text-[#757575] mt-1">
            Visão consolidada dos principais indicadores de pessoal, conformidade e atividades
            recentes do tenant.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="border-[#E0E0E0] text-[#212121] hover:bg-[#E8EEF7] hover:text-[#0D47A1] text-xs font-semibold h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Assistente de Consulta CLT & Obrigações Trabalhistas */}
      <AssistenteConsultaClt />

      {/* Grid de 5 KPIs no topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Total de Colaboradores (👥, azul) */}
        <Card
          onClick={() => navigate('/colaboradores')}
          className="border border-[#E0E0E0] bg-white shadow-xs hover:border-[#0D47A1] hover:shadow-md transition-all cursor-pointer group"
        >
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
                Total de Colaboradores
              </span>
              <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center shrink-0 group-hover:bg-[#0D47A1] group-hover:text-white transition-colors">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-extrabold text-[#0D47A1]">
                  {totalColaboradoresAtivos}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-[#757575] mt-1">
                <span>Colaboradores ativos</span>
                <ChevronRight className="h-4 w-4 text-[#9E9E9E] group-hover:text-[#0D47A1] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Férias Próximas do Vencimento (🏖️, vermelho se > 0, verde se 0) */}
        <Card
          onClick={() => setModalFeriasOpen(true)}
          className={`border bg-white shadow-xs hover:shadow-md transition-all cursor-pointer group ${
            totalFeriasProximas > 0
              ? 'border-red-200 hover:border-[#C62828]'
              : 'border-[#E0E0E0] hover:border-[#2E7D32]'
          }`}
        >
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
                Férias a Vencer
              </span>
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  totalFeriasProximas > 0
                    ? 'bg-red-100 text-[#C62828] group-hover:bg-[#C62828] group-hover:text-white'
                    : 'bg-[#E8F5E9] text-[#2E7D32] group-hover:bg-[#2E7D32] group-hover:text-white'
                }`}
              >
                <Palmtree className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div
                  className={`text-3xl font-extrabold ${
                    totalFeriasProximas > 0 ? 'text-[#C62828]' : 'text-[#2E7D32]'
                  }`}
                >
                  {totalFeriasProximas}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-[#757575] mt-1">
                <span>{totalFeriasProximas > 0 ? 'Em até 60 dias (CLT)' : 'Todas em dia'}</span>
                <ChevronRight className="h-4 w-4 text-[#9E9E9E] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Atestados Aguardando Aprovação (🩺, laranja se > 0, verde se 0) */}
        <Card
          onClick={() => navigate('/atestados/validacao')}
          className={`border bg-white shadow-xs hover:shadow-md transition-all cursor-pointer group ${
            totalAtestadosAguardando > 0
              ? 'border-amber-200 hover:border-[#FB8C00]'
              : 'border-[#E0E0E0] hover:border-[#2E7D32]'
          }`}
        >
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
                Atestados Pendentes
              </span>
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  totalAtestadosAguardando > 0
                    ? 'bg-orange-100 text-[#E65100] group-hover:bg-[#E65100] group-hover:text-white'
                    : 'bg-[#E8F5E9] text-[#2E7D32] group-hover:bg-[#2E7D32] group-hover:text-white'
                }`}
              >
                <Stethoscope className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div
                  className={`text-3xl font-extrabold ${
                    totalAtestadosAguardando > 0 ? 'text-[#E65100]' : 'text-[#2E7D32]'
                  }`}
                >
                  {totalAtestadosAguardando}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-[#757575] mt-1">
                <span>
                  {totalAtestadosAguardando > 0 ? 'Recebidos / Análise' : 'Sem pendências'}
                </span>
                <ChevronRight className="h-4 w-4 text-[#9E9E9E] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Pessoas sem Ciência (📄, laranja se > 0, verde se 0) */}
        <Card
          onClick={() => navigate('/pendencias-documentais')}
          className={`border bg-white shadow-xs hover:shadow-md transition-all cursor-pointer group ${
            pessoasSemCiencia > 0
              ? 'border-amber-200 hover:border-[#FB8C00]'
              : 'border-[#E0E0E0] hover:border-[#2E7D32]'
          }`}
        >
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
                Pessoas sem Ciência
              </span>
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  pessoasSemCiencia > 0
                    ? 'bg-amber-100 text-[#E65100] group-hover:bg-[#E65100] group-hover:text-white'
                    : 'bg-[#E8F5E9] text-[#2E7D32] group-hover:bg-[#2E7D32] group-hover:text-white'
                }`}
              >
                <FileWarning className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div
                  className={`text-3xl font-extrabold ${
                    pessoasSemCiencia > 0 ? 'text-[#E65100]' : 'text-[#2E7D32]'
                  }`}
                >
                  {pessoasSemCiencia}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-[#757575] mt-1">
                <span>{pessoasSemCiencia > 0 ? 'Docs obrigatórios' : '100% conformidade'}</span>
                <ChevronRight className="h-4 w-4 text-[#9E9E9E] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 5: Exames Ocupacionais Próximos (🏥, amarelo placeholder com "Em breve") */}
        <Card className="border border-[#E0E0E0] bg-white shadow-xs opacity-90 cursor-default">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
                Exames Ocupacionais
              </span>
              <div className="h-9 w-9 rounded-lg bg-yellow-100 text-[#F57F17] flex items-center justify-center shrink-0">
                <Building className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-extrabold text-[#F57F17]">0</div>
                <Badge
                  variant="outline"
                  className="bg-yellow-50 text-[#F57F17] border-yellow-300 text-[10px] font-bold px-1.5 py-0.5"
                >
                  Em breve
                </Badge>
              </div>
              <p className="text-xs text-[#757575] mt-1">ASO / Periódicos (módulo futuro)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção "Atividades Recentes" */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs">
        <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
              <History className="h-5 w-5 text-[#0D47A1]" />
              Atividades Recentes
            </CardTitle>
            <CardDescription className="text-xs text-[#757575]">
              Últimas 10 ações e registros de auditoria realizados pelos usuários no tenant.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-xs font-medium"
          >
            Audit Trail
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : logsHumanizados.length === 0 ? (
            <div className="p-8 text-center text-[#757575]">
              <Clock className="h-8 w-8 mx-auto text-[#9E9E9E] mb-2" />
              <p className="text-sm font-semibold text-[#212121]">Nenhuma atividade recente</p>
              <p className="text-xs text-[#757575] mt-0.5">
                As ações dos usuários aparecerão aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0F0F0]">
              {logsHumanizados.map((item) => {
                const IconComponent = item.icone

                return (
                  <div
                    key={item.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-[#FAFAFA] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${item.bgIcone} ${item.corIcone}`}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#212121] leading-snug">
                          {item.descricao}
                        </p>
                        <p className="text-[11px] text-[#9E9E9E] mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{item.dataRelativa}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Férias Próximas */}
      <ModalFeriasProximas
        open={modalFeriasOpen}
        onOpenChange={setModalFeriasOpen}
        colaboradoresProximos={analiseFerias.colaboradoresProximos}
      />
    </div>
  )
}
