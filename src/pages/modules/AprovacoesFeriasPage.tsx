import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  User,
  Calendar,
  AlertCircle,
  Loader2,
  Coins,
  History,
  Building,
  Check,
  X,
  Palmtree,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { feriasService } from '@/services/feriasService'
import { colaboradorService, logAuditoriaService } from '@/services/api'
import { SolicitacaoFerias, Colaborador, SolicitacaoFeriasStatus } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

export default function AprovacoesFeriasPage() {
  const { user, colaborador } = useAuth()
  const { toast } = useToast()

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoFerias[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroColaborador, setFiltroColaborador] = useState<string>('todos')
  const [busca, setBusca] = useState('')

  // Modais de Ação
  const [modalAprovar, setModalAprovar] = useState<SolicitacaoFerias | null>(null)
  const [comentarioAprovacao, setComentarioAprovacao] = useState('')
  const [processandoAprovacao, setProcessandoAprovacao] = useState(false)

  const [modalRejeitar, setModalRejeitar] = useState<SolicitacaoFerias | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [erroRejeicao, setErroRejeicao] = useState<string | null>(null)
  const [processandoRejeicao, setProcessandoRejeicao] = useState(false)

  const tenantId = user?.tenant_id
  const perfil = user?.perfil
  const isRhOrAdmin = perfil === 'rh' || perfil === 'admin_rh' || perfil === 'admin'
  const isGestor = perfil === 'gestor'

  // Carregar solicitações e colaboradores
  const carregarDados = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [listaColaboradores, todasSolicitacoes] = await Promise.all([
        colaboradorService.getColaboradores(tenantId),
        feriasService.listarSolicitacoes({
          tenantId,
        }),
      ])

      setColaboradores(listaColaboradores)
      setSolicitacoes(todasSolicitacoes)
    } catch (err) {
      console.error('Erro ao carregar dados de aprovação de férias:', err)
      toast({
        title: 'Erro ao carregar solicitações',
        description: 'Não foi possível carregar as férias para aprovação.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Realtime subscription
  useRealtime('solicitacao_ferias', (e) => {
    const rec = e.record as unknown as SolicitacaoFerias
    if (rec.tenant_id === tenantId) {
      if (e.action === 'create') {
        setSolicitacoes((prev) => {
          if (prev.some((s) => s.id === rec.id)) return prev
          return [rec, ...prev]
        })
      } else if (e.action === 'update') {
        setSolicitacoes((prev) => prev.map((s) => (s.id === rec.id ? { ...s, ...rec } : s)))
      } else if (e.action === 'delete') {
        setSolicitacoes((prev) => prev.filter((s) => s.id !== rec.id))
      }
    }
  })

  // Mapeamento de Colaborador por ID
  const colaboradorMap = useMemo(() => {
    const map = new Map<string, Colaborador>()
    for (const c of colaboradores) {
      map.set(c.id, c)
    }
    return map
  }, [colaboradores])

  // Se o usuário for gestor (não RH/admin), limitar lista às pessoas da sua equipe (mesmo departamento)
  const solicitacoesFiltradasPerfil = useMemo(() => {
    if (isRhOrAdmin) {
      return solicitacoes
    }
    if (isGestor && colaborador?.departamento) {
      return solicitacoes.filter((s) => {
        const colab = s.expand?.colaborador_id || colaboradorMap.get(s.colaborador_id)
        return colab?.departamento === colaborador.departamento
      })
    }
    return solicitacoes
  }, [isRhOrAdmin, isGestor, colaborador?.departamento, solicitacoes, colaboradorMap])

  // Separação entre Pendentes e Histórico
  const solicitacoesPendentes = useMemo(() => {
    return solicitacoesFiltradasPerfil.filter((s) => s.status === 'pendente')
  }, [solicitacoesFiltradasPerfil])

  const solicitacoesHistorico = useMemo(() => {
    return solicitacoesFiltradasPerfil.filter((s) => s.status !== 'pendente')
  }, [solicitacoesFiltradasPerfil])

  // Filtro avançado para RH / Busca
  const solicitacoesExibicao = useMemo(() => {
    return solicitacoesFiltradasPerfil.filter((s) => {
      // Filtro status
      if (filtroStatus !== 'todos' && s.status !== filtroStatus) {
        return false
      }
      // Filtro colaborador
      if (filtroColaborador !== 'todos' && s.colaborador_id !== filtroColaborador) {
        return false
      }
      // Busca por nome ou departamento
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim()
        const colab = s.expand?.colaborador_id || colaboradorMap.get(s.colaborador_id)
        const nome = (colab?.nome || '').toLowerCase()
        const depto = (colab?.departamento || '').toLowerCase()
        return nome.includes(termo) || depto.includes(termo)
      }
      return true
    })
  }, [solicitacoesFiltradasPerfil, filtroStatus, filtroColaborador, busca, colaboradorMap])

  // Ação: Aprovar Solicitação
  const handleConfirmarAprovacao = async () => {
    if (!modalAprovar || !tenantId || !user?.id) return

    try {
      setProcessandoAprovacao(true)
      const atualizada = await feriasService.aprovarSolicitacao(
        modalAprovar.id,
        comentarioAprovacao.trim() || undefined,
      )

      // Registrar auditoria
      const colabAlvo =
        modalAprovar.expand?.colaborador_id || colaboradorMap.get(modalAprovar.colaborador_id)
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: user.id,
        acao: 'aprovacao_ferias',
        entidade: 'solicitacao_ferias',
        entidade_id: modalAprovar.id,
        data_hora: new Date().toISOString(),
        dados_json: {
          gestor_nome: user.name,
          gestor_email: user.email,
          gestor_perfil: user.perfil,
          colaborador_nome: colabAlvo?.nome || 'Não identificado',
          colaborador_id: modalAprovar.colaborador_id,
          data_inicio: modalAprovar.data_inicio,
          data_fim: modalAprovar.data_fim,
          dias: modalAprovar.dias,
          abono_pecuniario: modalAprovar.abono_pecuniario,
          comentario: comentarioAprovacao.trim() || null,
        },
      })

      setSolicitacoes((prev) =>
        prev.map((s) => (s.id === modalAprovar.id ? { ...s, ...atualizada } : s)),
      )

      toast({
        title: 'Solicitação aprovada',
        description: `As férias de ${colabAlvo?.nome || 'colaborador'} foram aprovadas com sucesso.`,
      })

      setModalAprovar(null)
      setComentarioAprovacao('')
    } catch (err) {
      console.error('Erro ao aprovar férias:', err)
      toast({
        title: 'Erro ao aprovar',
        description: 'Não foi possível registrar a aprovação da solicitação.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoAprovacao(false)
    }
  }

  // Ação: Rejeitar Solicitação
  const handleConfirmarRejeicao = async () => {
    if (!modalRejeitar || !tenantId || !user?.id) return
    if (!motivoRejeicao.trim()) {
      setErroRejeicao('O comentário/motivo da rejeição é obrigatório.')
      return
    }

    try {
      setProcessandoRejeicao(true)
      setErroRejeicao(null)

      const atualizada = await feriasService.rejeitarSolicitacao(
        modalRejeitar.id,
        motivoRejeicao.trim(),
      )

      // Registrar auditoria
      const colabAlvo =
        modalRejeitar.expand?.colaborador_id || colaboradorMap.get(modalRejeitar.colaborador_id)
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: user.id,
        acao: 'rejeicao_ferias',
        entidade: 'solicitacao_ferias',
        entidade_id: modalRejeitar.id,
        data_hora: new Date().toISOString(),
        dados_json: {
          gestor_nome: user.name,
          gestor_email: user.email,
          gestor_perfil: user.perfil,
          colaborador_nome: colabAlvo?.nome || 'Não identificado',
          colaborador_id: modalRejeitar.colaborador_id,
          motivo_rejeicao: motivoRejeicao.trim(),
          data_inicio: modalRejeitar.data_inicio,
          data_fim: modalRejeitar.data_fim,
          dias: modalRejeitar.dias,
        },
      })

      setSolicitacoes((prev) =>
        prev.map((s) => (s.id === modalRejeitar.id ? { ...s, ...atualizada } : s)),
      )

      toast({
        title: 'Solicitação rejeitada',
        description: `A solicitação foi recusada e o colaborador foi notificado com o parecer.`,
        variant: 'destructive',
      })

      setModalRejeitar(null)
      setMotivoRejeicao('')
    } catch (err) {
      console.error('Erro ao rejeitar férias:', err)
      toast({
        title: 'Erro ao rejeitar',
        description: 'Não foi possível recusar a solicitação de férias.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoRejeicao(false)
    }
  }

  // Formatar Badge de Status
  const renderBadgeStatus = (status: SolicitacaoFeriasStatus) => {
    switch (status) {
      case 'pendente':
        return (
          <Badge
            variant="outline"
            className="bg-[#FFF9C4] text-[#7F6000] border-[#FBC02D] font-semibold text-xs flex items-center gap-1"
          >
            <Clock className="w-3 h-3 text-[#FBC02D]" />
            Pendente
          </Badge>
        )
      case 'aprovada':
        return (
          <Badge
            variant="outline"
            className="bg-[#E8F5E9] text-[#1B5E20] border-[#388E3C] font-semibold text-xs flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3 text-[#388E3C]" />
            Aprovada
          </Badge>
        )
      case 'rejeitada':
        return (
          <Badge
            variant="outline"
            className="bg-[#FFEBEE] text-[#B71C1C] border-[#D32F2F] font-semibold text-xs flex items-center gap-1"
          >
            <XCircle className="w-3 h-3 text-[#D32F2F]" />
            Rejeitada
          </Badge>
        )
      case 'cancelada':
      default:
        return (
          <Badge
            variant="outline"
            className="bg-neutral-100 text-neutral-600 border-neutral-300 font-semibold text-xs"
          >
            Cancelada
          </Badge>
        )
    }
  }

  const formatData = (d: Date | string) => {
    try {
      const date = typeof d === 'string' ? new Date(d) : d
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: typeof d === 'string' && d.length <= 10 ? 'UTC' : undefined,
      })
    } catch {
      return String(d)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1]">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
              Aprovações de Férias
            </h1>
            <p className="text-xs text-[#757575] mt-0.5">
              {isRhOrAdmin
                ? 'Visão Global RH: analise e delibere sobre as solicitações de férias de todos os setores do tenant.'
                : 'Painel da Gestão: valide os períodos de descanso solicitados pela sua equipe de trabalho.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-[#FFF9C4] text-[#7F6000] border-[#FBC02D] text-xs px-3 py-1 font-semibold"
          >
            {solicitacoesPendentes.length}{' '}
            {solicitacoesPendentes.length === 1 ? 'solicitação pendente' : 'solicitações pendentes'}
          </Badge>
        </div>
      </div>

      {/* 2. Mini Cards de Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFiltroStatus('pendente')}
          className="bg-white border rounded-xl p-3.5 shadow-2xs cursor-pointer transition-all hover:bg-neutral-50"
          style={{ borderLeft: '4px solid #FBC02D' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9A7B00]">
            Pendentes
          </span>
          <div className="text-2xl font-extrabold text-[#212121] mt-1">
            {solicitacoesPendentes.length}
          </div>
          <p className="text-[11px] text-[#757575] mt-0.5">Aguardando parecer</p>
        </div>

        <div
          onClick={() => setFiltroStatus('aprovada')}
          className="bg-white border rounded-xl p-3.5 shadow-2xs cursor-pointer transition-all hover:bg-neutral-50"
          style={{ borderLeft: '4px solid #388E3C' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#2E7D32]">
            Aprovadas
          </span>
          <div className="text-2xl font-extrabold text-[#212121] mt-1">
            {solicitacoesFiltradasPerfil.filter((s) => s.status === 'aprovada').length}
          </div>
          <p className="text-[11px] text-[#757575] mt-0.5">Autorizadas no período</p>
        </div>

        <div
          onClick={() => setFiltroStatus('rejeitada')}
          className="bg-white border rounded-xl p-3.5 shadow-2xs cursor-pointer transition-all hover:bg-neutral-50"
          style={{ borderLeft: '4px solid #D32F2F' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#B71C1C]">
            Rejeitadas
          </span>
          <div className="text-2xl font-extrabold text-[#212121] mt-1">
            {solicitacoesFiltradasPerfil.filter((s) => s.status === 'rejeitada').length}
          </div>
          <p className="text-[11px] text-[#757575] mt-0.5">Necessitam reagendamento</p>
        </div>

        <div
          onClick={() => setFiltroStatus('todos')}
          className="bg-white border rounded-xl p-3.5 shadow-2xs cursor-pointer transition-all hover:bg-neutral-50"
          style={{ borderLeft: '4px solid #0D47A1' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D47A1]">
            Total Geral
          </span>
          <div className="text-2xl font-extrabold text-[#212121] mt-1">
            {solicitacoesFiltradasPerfil.length}
          </div>
          <p className="text-[11px] text-[#757575] mt-0.5">Todas as solicitações</p>
        </div>
      </div>

      {/* 3. Abas: Solicitações Pendentes da Equipe vs Visão Geral / Histórico */}
      <Tabs defaultValue="pendentes" className="space-y-4">
        <TabsList className="bg-neutral-100 p-1 rounded-lg">
          <TabsTrigger
            value="pendentes"
            className="data-[state=active]:bg-white data-[state=active]:text-[#0D47A1] text-xs font-semibold px-4"
          >
            Pendentes para Análise ({solicitacoesPendentes.length})
          </TabsTrigger>
          <TabsTrigger
            value="todas"
            className="data-[state=active]:bg-white data-[state=active]:text-[#0D47A1] text-xs font-semibold px-4"
          >
            {isRhOrAdmin ? 'Todas as Férias do Tenant' : 'Histórico da Equipe'} (
            {solicitacoesFiltradasPerfil.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: Pendentes */}
        <TabsContent value="pendentes" className="space-y-4">
          <Card className="border border-[#E0E0E0] shadow-sm bg-white">
            <CardHeader className="p-4 border-b border-[#E0E0E0]">
              <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#FBC02D]" />
                Solicitações Pendentes de Parecer
              </CardTitle>
              <CardDescription className="text-xs text-[#757575]">
                Revise os prazos, conformidade com a escala de trabalho e decida pela aprovação ou
                rejeição com justificativa.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : solicitacoesPendentes.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-[#388E3C] mx-auto" />
                  <p className="text-sm font-semibold text-[#212121]">
                    Nenhuma solicitação pendente no momento!
                  </p>
                  <p className="text-xs text-[#757575]">
                    Todas as solicitações de férias da sua equipe foram analisadas.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-[#F8F9FA] text-[#616161] font-semibold text-xs border-b border-[#E0E0E0]">
                      <tr>
                        <th className="py-3 px-4">Colaborador</th>
                        <th className="py-3 px-4">Departamento / Cargo</th>
                        <th className="py-3 px-4">Período Solicitado</th>
                        <th className="py-3 px-4 text-center">Dias</th>
                        <th className="py-3 px-4">Abono Pecuniário</th>
                        <th className="py-3 px-4">Data Solicitação</th>
                        <th className="py-3 px-4 text-right">Ações de Decisão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E0E0] text-xs">
                      {solicitacoesPendentes.map((sol) => {
                        const colab =
                          sol.expand?.colaborador_id || colaboradorMap.get(sol.colaborador_id)

                        return (
                          <tr key={sol.id} className="hover:bg-[#FAFAFA] transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-[#212121]">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-[#E8EEF7] text-[#0D47A1] font-bold flex items-center justify-center text-xs">
                                  {colab?.nome ? colab.nome.charAt(0).toUpperCase() : 'C'}
                                </div>
                                <span>{colab?.nome || 'Colaborador não identificado'}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-[#616161]">
                              <div>{colab?.departamento || '—'}</div>
                              <div className="text-[11px] text-[#757575]">
                                {colab?.cargo || '—'}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-[#212121]">
                              {formatData(sol.data_inicio)} até {formatData(sol.data_fim)}
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-[#0D47A1]">
                              {sol.dias} dias
                            </td>
                            <td className="py-3.5 px-4">
                              {sol.abono_pecuniario ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <Coins className="w-3.5 h-3.5" />
                                  Sim (10 dias)
                                </span>
                              ) : (
                                <span className="text-[#9E9E9E]">Não</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-[#616161]">
                              {sol.data_solicitacao
                                ? formatData(sol.data_solicitacao)
                                : formatData(sol.created)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => setModalAprovar(sol)}
                                  className="h-8 bg-[#388E3C] hover:bg-[#2E7D32] text-white font-semibold text-xs gap-1 shadow-sm"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Aprovar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setModalRejeitar(sol)
                                    setMotivoRejeicao('')
                                    setErroRejeicao(null)
                                  }}
                                  className="h-8 border-[#D32F2F] text-[#D32F2F] hover:bg-[#FFEBEE] font-semibold text-xs gap-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Rejeitar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: Todas / Histórico */}
        <TabsContent value="todas" className="space-y-4">
          <Card className="border border-[#E0E0E0] shadow-sm bg-white">
            <CardHeader className="p-4 border-b border-[#E0E0E0] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                    <History className="h-4 w-4 text-[#0D47A1]" />
                    {isRhOrAdmin ? 'Visão RH de Férias do Tenant' : 'Histórico de Férias da Equipe'}
                  </CardTitle>
                  <CardDescription className="text-xs text-[#757575]">
                    Consulte os registros de férias, pareceres emitidos e filtre por status ou
                    colaborador.
                  </CardDescription>
                </div>
              </div>

              {/* Barra de Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#757575]" />
                  <Input
                    placeholder="Buscar por colaborador ou depto..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-8 text-xs h-9 border-[#E0E0E0]"
                  />
                </div>

                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-9 text-xs border-[#E0E0E0]">
                    <SelectValue placeholder="Filtrar por Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="aprovada">Aprovada</SelectItem>
                    <SelectItem value="rejeitada">Rejeitada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>

                {isRhOrAdmin && (
                  <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
                    <SelectTrigger className="h-9 text-xs border-[#E0E0E0]">
                      <SelectValue placeholder="Filtrar Colaborador" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-56">
                      <SelectItem value="todos">Todos os Colaboradores</SelectItem>
                      {colaboradores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} ({c.departamento || 'Geral'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {solicitacoesExibicao.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#757575]">
                  Nenhum registro encontrado para os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-[#F8F9FA] text-[#616161] font-semibold text-xs border-b border-[#E0E0E0]">
                      <tr>
                        <th className="py-3 px-4">Colaborador</th>
                        <th className="py-3 px-4">Departamento</th>
                        <th className="py-3 px-4">Período de Gozo</th>
                        <th className="py-3 px-4 text-center">Dias</th>
                        <th className="py-3 px-4">Abono</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Parecer / Resposta</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E0E0] text-xs">
                      {solicitacoesExibicao.map((sol) => {
                        const colab =
                          sol.expand?.colaborador_id || colaboradorMap.get(sol.colaborador_id)

                        return (
                          <tr key={sol.id} className="hover:bg-[#FAFAFA] transition-colors">
                            <td className="py-3 px-4 font-semibold text-[#212121]">
                              {colab?.nome || '—'}
                            </td>
                            <td className="py-3 px-4 text-[#616161]">
                              {colab?.departamento || '—'}
                            </td>
                            <td className="py-3 px-4 text-[#212121]">
                              {formatData(sol.data_inicio)} a {formatData(sol.data_fim)}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-[#0D47A1]">
                              {sol.dias}d
                            </td>
                            <td className="py-3 px-4 text-[#616161]">
                              {sol.abono_pecuniario ? 'Sim (10d)' : 'Não'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {renderBadgeStatus(sol.status)}
                            </td>
                            <td className="py-3 px-4 text-[#616161] max-w-xs truncate">
                              {sol.comentario_gestor ? (
                                <span
                                  title={sol.comentario_gestor}
                                  className="italic text-[#424242]"
                                >
                                  &ldquo;{sol.comentario_gestor}&rdquo;
                                </span>
                              ) : (
                                <span className="text-[#9E9E9E]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {sol.status === 'pendente' && (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => setModalAprovar(sol)}
                                    className="h-7 text-xs bg-[#388E3C] hover:bg-[#2E7D32] text-white px-2"
                                  >
                                    Aprovar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setModalRejeitar(sol)
                                      setMotivoRejeicao('')
                                      setErroRejeicao(null)
                                    }}
                                    className="h-7 text-xs border-[#D32F2F] text-[#D32F2F] hover:bg-[#FFEBEE] px-2"
                                  >
                                    Rejeitar
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 4. Modal de Confirmação de Aprovação */}
      <Dialog open={!!modalAprovar} onOpenChange={(open) => !open && setModalAprovar(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-[#E0E0E0] p-6">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2 text-[#388E3C]">
              <CheckCircle2 className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold text-[#212121]">
                Aprovar Solicitação de Férias
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#757575]">
              Ao aprovar, o período de gozo será homologado e destacado automaticamente no espelho
              de ponto do colaborador.
            </DialogDescription>
          </DialogHeader>

          {modalAprovar && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-[#E8F5E9]/50 border border-[#A5D6A7] rounded-lg text-xs space-y-1">
                <div>
                  Colaborador:{' '}
                  <strong>
                    {modalAprovar.expand?.colaborador_id?.nome ||
                      colaboradorMap.get(modalAprovar.colaborador_id)?.nome ||
                      'Colaborador'}
                  </strong>
                </div>
                <div>
                  Período:{' '}
                  <strong>
                    {formatData(modalAprovar.data_inicio)} a {formatData(modalAprovar.data_fim)}
                  </strong>{' '}
                  ({modalAprovar.dias} dias corridos)
                </div>
                {modalAprovar.abono_pecuniario && (
                  <div className="text-emerald-800 font-semibold">
                    Inclui Abono Pecuniário (venda de 10 dias)
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="comentario_aprovacao"
                  className="text-xs font-semibold text-[#212121]"
                >
                  Observação ou Parecer do Gestor (Opcional)
                </Label>
                <Textarea
                  id="comentario_aprovacao"
                  placeholder="Ex: Férias aprovadas e alinhadas com a escala do departamento."
                  value={comentarioAprovacao}
                  onChange={(e) => setComentarioAprovacao(e.target.value)}
                  className="text-xs border-[#E0E0E0]"
                  rows={3}
                />
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalAprovar(null)}
                  disabled={processandoAprovacao}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmarAprovacao}
                  disabled={processandoAprovacao}
                  className="bg-[#388E3C] hover:bg-[#2E7D32] text-white"
                >
                  {processandoAprovacao ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Aprovando...
                    </>
                  ) : (
                    'Confirmar Aprovação'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. Modal de Rejeição de Solicitação */}
      <Dialog open={!!modalRejeitar} onOpenChange={(open) => !open && setModalRejeitar(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-[#E0E0E0] p-6">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2 text-[#D32F2F]">
              <XCircle className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold text-[#212121]">
                Rejeitar Solicitação de Férias
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#757575]">
              Informe o motivo da recusa para orientar o colaborador sobre o reagendamento.
            </DialogDescription>
          </DialogHeader>

          {modalRejeitar && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-[#FFEBEE]/60 border border-[#EF9A9A] rounded-lg text-xs space-y-1">
                <div>
                  Colaborador:{' '}
                  <strong>
                    {modalRejeitar.expand?.colaborador_id?.nome ||
                      colaboradorMap.get(modalRejeitar.colaborador_id)?.nome ||
                      'Colaborador'}
                  </strong>
                </div>
                <div>
                  Período solicitado:{' '}
                  <strong>
                    {formatData(modalRejeitar.data_inicio)} a {formatData(modalRejeitar.data_fim)}
                  </strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="motivo_rejeicao" className="text-xs font-semibold text-[#212121]">
                  Justificativa / Motivo da Rejeição <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="motivo_rejeicao"
                  placeholder="Ex: Conflito de escala com outros membros da equipe ou período de fechamento anual crítico."
                  value={motivoRejeicao}
                  onChange={(e) => {
                    setMotivoRejeicao(e.target.value)
                    if (erroRejeicao) setErroRejeicao(null)
                  }}
                  className="text-xs border-[#E0E0E0]"
                  rows={3}
                />
                {erroRejeicao && (
                  <p className="text-[11px] text-[#D32F2F] flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {erroRejeicao}
                  </p>
                )}
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalRejeitar(null)}
                  disabled={processandoRejeicao}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmarRejeicao}
                  disabled={processandoRejeicao}
                  className="bg-[#D32F2F] hover:bg-[#B71C1C] text-white"
                >
                  {processandoRejeicao ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Rejeitando...
                    </>
                  ) : (
                    'Confirmar Rejeição'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
