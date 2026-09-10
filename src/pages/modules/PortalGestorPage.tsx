import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Users,
  CheckCircle2,
  Clock,
  Palmtree,
  CalendarCheck,
  Award,
  Calendar,
  AlertCircle,
  Megaphone,
  ArrowRight,
  TrendingUp,
  FileText,
  UserCog,
  Check,
  X,
  RefreshCw,
  ChevronRight,
  Loader2,
  Building,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  Colaborador,
  SolicitacaoFerias,
  CompensacaoBancoHoras,
  SolicitacaoAlteracao,
  Comunicado,
  CicloAvaliacao,
  Avaliacao,
  RegistroPonto,
} from '@/types'
import {
  colaboradorService,
  comunicadoService,
  solicitacaoService,
  logAuditoriaService,
} from '@/services/api'
import { feriasService } from '@/services/feriasService'
import { compensacaoService } from '@/services/compensacaoService'
import { avaliacaoService } from '@/services/avaliacaoService'
import { pontoService } from '@/services/pontoService'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatDataPtBr } from '@/lib/exportReports'
import { CalendarioFeriasEquipe } from '@/components/gestor/CalendarioFeriasEquipe'
import { OnboardingGestorCard } from '@/components/gestor/OnboardingGestorCard'
import { onboardingGestorService } from '@/services/onboardingGestorService'

export const PortalGestorPage: React.FC = () => {
  const { user, colaborador } = useAuth()
  const navigate = useNavigate()

  // Onboarding do Gestor
  const [progressoOnboarding, setProgressoOnboarding] = useState<{
    concluidasSet: Set<number>
    percentual: number
    isConcluido: boolean
    isNovoGestor: boolean
  }>({
    concluidasSet: new Set(),
    percentual: 0,
    isConcluido: false,
    isNovoGestor: false,
  })

  const [loading, setLoading] = useState(true)
  const [colaboradoresEquipe, setColaboradoresEquipe] = useState<Colaborador[]>([])
  const [solicitacoesFerias, setSolicitacoesFerias] = useState<SolicitacaoFerias[]>([])
  const [todasFeriasEquipe, setTodasFeriasEquipe] = useState<SolicitacaoFerias[]>([])
  const [compensacoesHoras, setCompensacoesHoras] = useState<CompensacaoBancoHoras[]>([])
  const [alteracoesCadastrais, setAlteracoesCadastrais] = useState<
    (SolicitacaoAlteracao & { expand?: { colaborador_id?: Colaborador } })[]
  >([])
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [cicloAtivo, setCicloAtivo] = useState<CicloAvaliacao | null>(null)
  const [avaliacoesCiclo, setAvaliacoesCiclo] = useState<Avaliacao[]>([])
  const [pontosHoje, setPontosHoje] = useState<RegistroPonto[]>([])

  // Modais de ação rápida para aprovação / recusa
  const [modalAcao, setModalAcao] = useState<{
    tipo: 'ferias' | 'compensacao' | 'cadastro'
    acao: 'aprovar' | 'recusar'
    item: any
  } | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [processandoAcao, setProcessandoAcao] = useState(false)

  const carregarDadosGestor = useCallback(async () => {
    if (!user?.tenant_id) return
    setLoading(true)

    try {
      const departamento = colaborador?.departamento || ''
      const isRHGeral =
        user.perfil === 'rh' || user.perfil === 'admin_rh' || user.perfil === 'admin'

      // 1. Colaboradores da equipe (se RH vê todos ou depto; se gestor vê do departamento)
      const todosColabs = await colaboradorService.getColaboradores(user.tenant_id)
      const equipe =
        isRHGeral && !departamento
          ? todosColabs
          : todosColabs.filter(
              (c) =>
                c.departamento &&
                departamento &&
                c.departamento.toLowerCase() === departamento.toLowerCase(),
            )
      setColaboradoresEquipe(equipe)

      const idsEquipe = new Set(equipe.map((c) => c.id))

      // 2. Férias pendentes da equipe e todas as férias (para o calendário)
      try {
        const todasFerias = await pb
          .collection('solicitacao_ferias')
          .getFullList<SolicitacaoFerias>({
            filter: `tenant_id = "${user.tenant_id}"`,
            sort: '-data_solicitacao,-created',
            expand: 'colaborador_id',
          })
        const feriasEquipe =
          isRHGeral && !departamento
            ? todasFerias
            : todasFerias.filter((f) => idsEquipe.has(f.colaborador_id))

        setTodasFeriasEquipe(feriasEquipe)
        setSolicitacoesFerias(feriasEquipe.filter((f) => f.status === 'pendente'))
      } catch (e) {
        console.warn('Erro ao carregar férias da equipe:', e)
      }

      // 3. Compensações de Banco de Horas pendentes
      try {
        const todasComp = await compensacaoService.getCompensacoesTenant(user.tenant_id, 'pendente')
        const compEquipe =
          isRHGeral && !departamento
            ? todasComp
            : todasComp.filter((c) => idsEquipe.has(c.colaborador_id))
        setCompensacoesHoras(compEquipe)
      } catch (e) {
        console.warn('Erro ao carregar compensações da equipe:', e)
      }

      // 4. Alterações cadastrais pendentes
      try {
        const todasAlt = await solicitacaoService.getSolicitacoesTenant(user.tenant_id, 'pendente')
        const altEquipe =
          isRHGeral && !departamento
            ? todasAlt
            : todasAlt.filter((a) => idsEquipe.has(a.colaborador_id))
        setAlteracoesCadastrais(altEquipe)
      } catch (e) {
        console.warn('Erro ao carregar alterações cadastrais pendentes:', e)
      }

      // 5. Pontos registrados hoje
      try {
        const hojeStr = new Date().toISOString().slice(0, 10)
        const registros = await pb.collection('registro_ponto').getFullList<RegistroPonto>({
          filter: `tenant_id = "${user.tenant_id}" && data_hora >= "${hojeStr} 00:00:00" && data_hora <= "${hojeStr} 23:59:59"`,
        })
        const pontosEquipe =
          isRHGeral && !departamento
            ? registros
            : registros.filter((p) => idsEquipe.has(p.colaborador_id))
        setPontosHoje(pontosEquipe)
      } catch (e) {
        console.warn('Erro ao carregar registros de ponto de hoje:', e)
      }

      // 6. Ciclo de Avaliações e pendências da equipe
      try {
        const ciclos = await avaliacaoService.getCiclos(user.tenant_id)
        const ativo = ciclos.find((c) => c.status === 'em_andamento') || ciclos[0] || null
        setCicloAtivo(ativo)

        if (ativo) {
          const avs = await avaliacaoService.getAvaliacoesPorCiclo(ativo.id)
          const avsEquipe =
            isRHGeral && !departamento ? avs : avs.filter((a) => idsEquipe.has(a.colaborador_id))
          setAvaliacoesCiclo(avsEquipe)
        }
      } catch (e) {
        console.warn('Erro ao carregar avaliações do gestor:', e)
      }

      // 7. Comunicados relevantes
      try {
        const listaComunicados = await comunicadoService.getComunicados(user.tenant_id, true)
        const filtrados = comunicadoService.filtrarPorPerfil(
          listaComunicados,
          user.perfil,
          colaborador,
        )
        setComunicados(filtrados.slice(0, 4))
      } catch (e) {
        console.warn('Erro ao carregar comunicados para o gestor:', e)
      }

      // 8. Onboarding do Gestor
      try {
        if (user.id) {
          const prog = await onboardingGestorService.getProgressoGestor(user.tenant_id, user.id)
          setProgressoOnboarding({
            concluidasSet: prog.concluidasSet,
            percentual: prog.percentual,
            isConcluido: prog.isConcluido,
            isNovoGestor: prog.isNovoGestor,
          })
        }
      } catch (onbErr) {
        console.warn('Erro ao carregar progresso de onboarding do gestor:', onbErr)
      }
    } catch (err) {
      console.error('Erro geral ao carregar dados do Portal do Gestor:', err)
      toast({
        title: 'Erro de carregamento',
        description: 'Não foi possível carregar todas as informações da sua equipe.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user?.tenant_id, user?.perfil, colaborador])

  useEffect(() => {
    carregarDadosGestor()
  }, [carregarDadosGestor])

  // KPIs
  const totalColaboradores = colaboradoresEquipe.length

  // Colaboradores que registraram ponto hoje
  const colaboradoresPresentesHojeIds = useMemo(() => {
    return new Set(pontosHoje.map((p) => p.colaborador_id))
  }, [pontosHoje])

  const totalPresentesHoje = colaboradoresEquipe.filter((c) =>
    colaboradoresPresentesHojeIds.has(c.id),
  ).length

  // Colaboradores em férias hoje
  const totalEmFeriasHoje = useMemo(() => {
    return colaboradoresEquipe.filter(
      (c) => (c.status as string) === 'ferias' || (c.status as string) === 'afastado',
    ).length
  }, [colaboradoresEquipe])

  // Total de pendências de aprovação
  const totalPendenciasAprovacao =
    solicitacoesFerias.length + compensacoesHoras.length + alteracoesCadastrais.length

  // Lista unificada de pendências para ação rápida
  const pendenciasUnificadas = useMemo(() => {
    const itens: Array<{
      id: string
      tipo: 'ferias' | 'compensacao' | 'cadastro'
      tipoLabel: string
      badgeCor: string
      colaboradorNome: string
      colaboradorCargo: string
      detalhes: string
      data: string
      itemOriginal: any
    }> = []

    solicitacoesFerias.forEach((f) => {
      itens.push({
        id: `ferias-${f.id}`,
        tipo: 'ferias',
        tipoLabel: 'Férias',
        badgeCor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        colaboradorNome: f.expand?.colaborador_id?.nome || 'Colaborador',
        colaboradorCargo: f.expand?.colaborador_id?.cargo || 'Colaborador',
        detalhes: `${f.dias} dias a partir de ${formatDataPtBr(f.data_inicio)}`,
        data: f.data_solicitacao || f.created,
        itemOriginal: f,
      })
    })

    compensacoesHoras.forEach((c) => {
      itens.push({
        id: `comp-${c.id}`,
        tipo: 'compensacao',
        tipoLabel: 'Compensação Horas',
        badgeCor: 'bg-blue-50 text-[#0D47A1] border-blue-300',
        colaboradorNome: c.expand?.colaborador_id?.nome || 'Colaborador',
        colaboradorCargo: c.expand?.colaborador_id?.cargo || 'Colaborador',
        detalhes: `${c.horas.toFixed(1)}h para o dia ${formatDataPtBr(c.data_compensacao)} — ${c.motivo}`,
        data: c.data_solicitacao || c.created,
        itemOriginal: c,
      })
    })

    alteracoesCadastrais.forEach((a) => {
      itens.push({
        id: `alt-${a.id}`,
        tipo: 'cadastro',
        tipoLabel: 'Alteração Cadastral',
        badgeCor: 'bg-purple-50 text-purple-800 border-purple-300',
        colaboradorNome: a.expand?.colaborador_id?.nome || 'Colaborador',
        colaboradorCargo: a.expand?.colaborador_id?.cargo || 'Colaborador',
        detalhes: `Campo "${a.campo}": ${a.valor_novo}`,
        data: a.data_solicitacao || a.created,
        itemOriginal: a,
      })
    })

    return itens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [solicitacoesFerias, compensacoesHoras, alteracoesCadastrais])

  // Ações de aprovação / recusa rápidas
  const handleConfirmarAcaoRapida = async () => {
    if (!modalAcao || !user?.id) return
    setProcessandoAcao(true)

    try {
      const { tipo, acao, item } = modalAcao

      if (tipo === 'ferias') {
        if (acao === 'aprovar') {
          await feriasService.aprovarSolicitacao(item.id, justificativa || undefined, user.id)
          toast({
            title: 'Férias aprovadas',
            description: 'A solicitação de férias foi homologada com sucesso.',
          })
        } else {
          if (!justificativa.trim()) {
            toast({
              title: 'Justificativa necessária',
              description: 'Informe o motivo da recusa das férias.',
              variant: 'destructive',
            })
            setProcessandoAcao(false)
            return
          }
          await feriasService.rejeitarSolicitacao(item.id, justificativa.trim())
          toast({
            title: 'Férias recusadas',
            description: 'A solicitação foi recusada e o colaborador notificado.',
          })
        }
      } else if (tipo === 'compensacao') {
        if (acao === 'aprovar') {
          await compensacaoService.aprovarCompensacao({
            compensacaoId: item.id,
            userId: user.id,
            comentario: justificativa,
          })
          toast({
            title: 'Compensação aprovada',
            description: 'Horas debitadas do banco e registradas no histórico.',
          })
        } else {
          if (!justificativa.trim()) {
            toast({
              title: 'Motivo obrigatório',
              description: 'Informe o motivo para recusa da compensação.',
              variant: 'destructive',
            })
            setProcessandoAcao(false)
            return
          }
          await compensacaoService.recusarCompensacao({
            compensacaoId: item.id,
            userId: user.id,
            motivoRecusa: justificativa.trim(),
          })
          toast({
            title: 'Compensação recusada',
            description: 'A compensação foi recusada e o saldo mantido.',
          })
        }
      } else if (tipo === 'cadastro') {
        if (acao === 'aprovar') {
          await solicitacaoService.aprovarSolicitacao(item, user.id)
          toast({
            title: 'Alteração cadastral aprovada',
            description: 'O cadastro do colaborador foi atualizado no sistema.',
          })
        } else {
          await solicitacaoService.rejeitarSolicitacao(item, user.id, justificativa)
          toast({
            title: 'Alteração recusada',
            description: 'A solicitação de alteração cadastral foi reprovada.',
          })
        }
      }

      setModalAcao(null)
      setJustificativa('')
      carregarDadosGestor()
    } catch (err: any) {
      toast({
        title: 'Falha na operação',
        description: err?.message || 'Não foi possível processar a ação.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoAcao(false)
    }
  }

  // Avaliações: notas e quem falta avaliar
  const avaliacoesPendentes = avaliacoesCiclo.filter((a) => a.status === 'pendente')
  const avaliacoesConcluidas = avaliacoesCiclo.filter((a) => a.status === 'concluida')
  const mediaNotasCiclo =
    avaliacoesConcluidas.length > 0
      ? (
          avaliacoesConcluidas.reduce((acc, curr) => acc + (curr.nota_final || 0), 0) /
          avaliacoesConcluidas.length
        ).toFixed(1)
      : null

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100/70 text-[#0D47A1] rounded-lg">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Portal do Gestor</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Visão consolidada da equipe{' '}
                {colaborador?.departamento && (
                  <strong className="text-[#0D47A1]">({colaborador.departamento})</strong>
                )}
                : ponto hoje, aprovações imediatas, avaliações e comunicados.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDadosGestor}
            disabled={loading}
            className="gap-2 border-slate-300 text-slate-700 hover:text-[#0D47A1]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Painel
          </Button>
        </div>
      </div>

      {/* Card / Banner Destacado de Onboarding do Gestor */}
      {user?.tenant_id && user?.id && (
        <OnboardingGestorCard
          tenantId={user.tenant_id}
          gestorUserId={user.id}
          concluidasSet={progressoOnboarding.concluidasSet}
          percentual={progressoOnboarding.percentual}
          isConcluido={progressoOnboarding.isConcluido}
          onProgressoAtualizado={carregarDadosGestor}
        />
      )}

      {/* Grid de 4 KPIs da Equipe */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total de Colaboradores */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Total na Equipe
              </span>
              <div className="h-9 w-9 rounded-full bg-blue-50 text-[#0D47A1] flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-3xl font-black text-slate-900">{totalColaboradores}</div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span>{colaboradoresEquipe.filter((c) => c.status === 'ativo').length} ativos</span>
              </p>
            </CardContent>
          </Card>

          {/* KPI 2: Presentes Hoje (via Ponto) */}
          <Card className="border border-emerald-200 bg-emerald-50/40 shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Presentes Hoje
              </span>
              <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-3xl font-black text-emerald-700 font-mono">
                {totalPresentesHoje}{' '}
                <span className="text-base font-normal text-slate-500">/ {totalColaboradores}</span>
              </div>
              <p className="text-xs text-emerald-800 mt-1">Registraram ponto no dia de hoje</p>
            </CardContent>
          </Card>

          {/* KPI 3: Em Férias Hoje */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Em Férias
              </span>
              <div className="h-9 w-9 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
                <Palmtree className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-3xl font-black text-slate-900">{totalEmFeriasHoje}</div>
              <p className="text-xs text-slate-500 mt-1">Colaboradores ausentes por férias</p>
            </CardContent>
          </Card>

          {/* KPI 4: Pendências de Aprovação */}
          <Card
            className={`border shadow-xs ${
              totalPendenciasAprovacao > 0
                ? 'border-rose-200 bg-rose-50/50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  totalPendenciasAprovacao > 0 ? 'text-rose-800' : 'text-slate-600'
                }`}
              >
                Aprovações Pendentes
              </span>
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center ${
                  totalPendenciasAprovacao > 0
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Clock className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div
                className={`text-3xl font-black font-mono ${
                  totalPendenciasAprovacao > 0 ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {totalPendenciasAprovacao}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {solicitacoesFerias.length} férias, {compensacoesHoras.length} compensações,{' '}
                {alteracoesCadastrais.length} cadastros
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Barra de Atalhos Rápidos para o Gestor */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/minha-equipe"
          className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-[#0D47A1] hover:shadow-xs transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-[#0D47A1] group-hover:bg-[#0D47A1] group-hover:text-white transition-colors">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Minha Equipe</p>
              <p className="text-[11px] text-slate-500">Membros e dados</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#0D47A1]" />
        </Link>

        <Link
          to="/ferias/aprovacoes"
          className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-[#0D47A1] hover:shadow-xs transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Aprovações de Férias</p>
              <p className="text-[11px] text-slate-500">Prazos e gozo</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
        </Link>

        <Link
          to="/ponto/gestao"
          className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-[#0D47A1] hover:shadow-xs transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Ponto da Equipe</p>
              <p className="text-[11px] text-slate-500">Espelhos e batidas</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600" />
        </Link>

        <Link
          to="/banco-horas"
          className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-[#0D47A1] hover:shadow-xs transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Banco de Horas</p>
              <p className="text-[11px] text-slate-500">Compensações e saldo</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600" />
        </Link>
      </div>

      {/* Grid Principal: 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda (2 spans): Aprovações Pendentes Unificadas com Ação Rápida */}
        <div className="lg:col-span-2 space-y-6">
          {/* Seção Calendário de Férias da Equipe */}
          <CalendarioFeriasEquipe
            colaboradores={colaboradoresEquipe}
            solicitacoesFerias={todasFeriasEquipe}
            departamentoNome={
              colaborador?.departamento ||
              (user?.perfil === 'gestor' ? 'Minha Equipe' : 'Equipes do Tenant')
            }
          />

          <div id="aprovacoes">
            <Card className="border border-slate-200 bg-white shadow-xs">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#0D47A1]" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Aprovações Pendentes da Equipe
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
                    >
                      {pendenciasUnificadas.length} pendente(s)
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Fila unificada de solicitações de férias, compensações de banco de horas e
                    alterações cadastrais da sua equipe.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : pendenciasUnificadas.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-2">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">Tudo em dia!</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Não há solicitações pendentes de aprovação da sua equipe no momento.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pendenciasUnificadas.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`${item.badgeCor} text-[10px] font-bold`}
                            >
                              {item.tipoLabel}
                            </Badge>
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {item.colaboradorNome}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate">
                              ({item.colaboradorCargo})
                            </span>
                          </div>
                          <p className="text-slate-700 font-medium">{item.detalhes}</p>
                          <p className="text-[11px] text-slate-400">
                            Solicitado em {formatDataPtBr(item.data)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setJustificativa('')
                              setModalAcao({
                                tipo: item.tipo,
                                acao: 'aprovar',
                                item: item.itemOriginal,
                              })
                            }}
                            className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1 font-semibold"
                          >
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setJustificativa('')
                              setModalAcao({
                                tipo: item.tipo,
                                acao: 'recusar',
                                item: item.itemOriginal,
                              })
                            }}
                            className="h-8 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 gap-1 font-semibold"
                          >
                            <X className="h-3.5 w-3.5 text-rose-600" />
                            Recusar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Resumo de Ponto da Equipe Hoje */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[#0D47A1]" />
                  Resumo de Ponto da Equipe Hoje ({new Date().toLocaleDateString('pt-BR')})
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Situação de registro das batidas de ponto dos colaboradores do seu setor no dia de
                  hoje.
                </CardDescription>
              </div>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="text-xs border-slate-300 text-[#0D47A1] hover:bg-blue-50 gap-1.5 h-8 font-medium"
              >
                <Link to="/ponto/gestao">
                  Gestão Completa de Ponto
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="p-4">
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : colaboradoresEquipe.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Sem colaboradores vinculados.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {colaboradoresEquipe.slice(0, 6).map((colab) => {
                    const registrou = colaboradoresPresentesHojeIds.has(colab.id)
                    const emFerias =
                      (colab.status as string) === 'ferias' ||
                      (colab.status as string) === 'afastado'

                    return (
                      <div
                        key={colab.id}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-900 truncate">{colab.nome}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {colab.cargo || 'Equipe'}
                          </p>
                        </div>
                        <div>
                          {emFerias ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                            >
                              Em Férias
                            </Badge>
                          ) : registrou ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Presente
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-600 border-slate-300 text-[10px]"
                            >
                              Sem Registro
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita (1 span): Avaliações do Ciclo Atual e Comunicados */}
        <div className="space-y-6">
          {/* Card de Avaliações de Desempenho */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="h-4.5 w-4.5 text-amber-600" />
                  Avaliações da Equipe
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Ciclo: {cicloAtivo?.nome || 'Ciclo Anual de Competências'}
                </CardDescription>
              </div>

              <Button
                asChild
                size="sm"
                className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs h-8 font-semibold gap-1"
              >
                <Link to="/minha-equipe">
                  Avaliar
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="p-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-lg font-black text-slate-900">
                    {avaliacoesConcluidas.length} /{' '}
                    {avaliacoesCiclo.length || colaboradoresEquipe.length}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Avaliações Feitas</p>
                </div>
                <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-200/60">
                  <span className="text-lg font-black text-amber-800 font-mono">
                    {mediaNotasCiclo ? `${mediaNotasCiclo} / 10` : '—'}
                  </span>
                  <p className="text-[10px] text-amber-700 mt-0.5">Nota Média Equipe</p>
                </div>
              </div>

              {avaliacoesPendentes.length > 0 ? (
                <div>
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Pendentes de sua avaliação ({avaliacoesPendentes.length}):
                  </p>
                  <div className="space-y-1.5">
                    {avaliacoesPendentes.slice(0, 4).map((av) => (
                      <div
                        key={av.id}
                        className="flex items-center justify-between p-2 rounded-md bg-slate-50 text-[11px]"
                      >
                        <span className="font-medium text-slate-800 truncate">
                          {av.expand?.colaborador_id?.nome || 'Colaborador'}
                        </span>
                        <Badge
                          variant="outline"
                          className="bg-amber-100/70 text-amber-800 border-amber-200 text-[10px]"
                        >
                          Pendente
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-slate-500 text-[11px] bg-slate-50 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                  Todas as avaliações deste ciclo estão em dia!
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card de Comunicados Relevantes */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="h-4.5 w-4.5 text-purple-600" />
                Comunicados aos Gestores
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs text-[#0D47A1] h-7 px-2">
                <Link to="/comunicados/gestao">Ver todos</Link>
              </Button>
            </CardHeader>

            <CardContent className="p-4 text-xs">
              {comunicados.length === 0 ? (
                <p className="text-slate-400 text-center py-4">Nenhum comunicado recente.</p>
              ) : (
                <div className="space-y-3">
                  {comunicados.map((c) => (
                    <div
                      key={c.id}
                      className="border-b border-slate-100 pb-2.5 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 truncate">{c.titulo}</span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                          {formatDataPtBr(c.data_publicacao)}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-1 line-clamp-2 leading-relaxed">
                        {c.conteudo}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Confirmação Rápida de Ação */}
      <Dialog open={Boolean(modalAcao)} onOpenChange={(open) => !open && setModalAcao(null)}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              {modalAcao?.acao === 'aprovar' ? (
                <Check className="h-5 w-5 text-emerald-600" />
              ) : (
                <X className="h-5 w-5 text-rose-600" />
              )}
              {modalAcao?.acao === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Recusa'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              {modalAcao?.tipo === 'ferias'
                ? 'Solicitação de Férias'
                : modalAcao?.tipo === 'compensacao'
                  ? 'Compensação de Banco de Horas'
                  : 'Alteração Cadastral'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                {modalAcao?.acao === 'aprovar'
                  ? 'Parecer ou comentário (opcional):'
                  : 'Motivo da recusa (obrigatório):'}
              </label>
              <Textarea
                placeholder={
                  modalAcao?.acao === 'aprovar'
                    ? 'Ex: Aprovado conforme alinhamento com a diretoria.'
                    : 'Ex: Período com escala reduzida / Necessário envio de novo comprovante.'
                }
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                className="text-xs min-h-[70px] border-slate-300"
                required={modalAcao?.acao === 'recusar'}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              disabled={processandoAcao}
              onClick={() => setModalAcao(null)}
              className="text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={processandoAcao}
              onClick={handleConfirmarAcaoRapida}
              className={`text-white text-xs h-9 font-semibold gap-1.5 ${
                modalAcao?.acao === 'aprovar'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {processandoAcao ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : modalAcao?.acao === 'aprovar' ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              {processandoAcao
                ? 'Processando...'
                : modalAcao?.acao === 'aprovar'
                  ? 'Confirmar Aprovação'
                  : 'Confirmar Recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default PortalGestorPage
