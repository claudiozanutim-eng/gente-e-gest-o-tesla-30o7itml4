import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Palmtree,
  Calendar as CalendarIcon,
  Plus,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  CalendarCheck2,
  CalendarDays,
  Coins,
  TrendingDown,
  Info,
  Loader2,
  HelpCircle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { feriasService } from '@/services/feriasService'
import { SolicitacaoFerias, PeriodoAquisitivoFerias, SolicitacaoFeriasStatus } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function FeriasPage() {
  const { user, colaborador } = useAuth()
  const { toast } = useToast()

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoFerias[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  // Formulário de Solicitação
  const [dataInicio, setDataInicio] = useState('')
  const [opcaoDias, setOpcaoDias] = useState<string>('30')
  const [diasCustom, setDiasCustom] = useState<number>(30)
  const [abonoPecuniario, setAbonoPecuniario] = useState(false)
  const [vender20Dias, setVender20Dias] = useState(false)

  const tenantId = user?.tenant_id
  const colaboradorId = colaborador?.id

  // Carregar histórico de solicitações
  const carregarSolicitacoes = useCallback(async () => {
    if (!tenantId || !colaboradorId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await feriasService.listarSolicitacoes({
        tenantId,
        colaboradorId,
      })
      setSolicitacoes(data)
    } catch (err) {
      console.error('Erro ao carregar solicitações de férias:', err)
      toast({
        title: 'Erro ao carregar férias',
        description: 'Não foi possível carregar as informações de férias.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, colaboradorId, toast])

  useEffect(() => {
    carregarSolicitacoes()
  }, [carregarSolicitacoes])

  // Realtime subscription para atualizações automáticas
  useRealtime('solicitacao_ferias', (e) => {
    if (!colaboradorId) return
    const rec = e.record as unknown as SolicitacaoFerias

    if (rec.colaborador_id === colaboradorId) {
      if (e.action === 'create') {
        setSolicitacoes((prev) => {
          if (prev.some((s) => s.id === rec.id)) return prev
          return [rec, ...prev]
        })
      } else if (e.action === 'update') {
        setSolicitacoes((prev) => prev.map((s) => (s.id === rec.id ? { ...s, ...rec } : s)))
        if (rec.status === 'aprovada') {
          toast({
            title: 'Férias aprovadas!',
            description: `Sua solicitação de férias para o período foi aprovada pelo gestor.`,
            className: 'border-l-4 border-l-[#388E3C]',
          })
        } else if (rec.status === 'rejeitada') {
          toast({
            title: 'Solicitação de férias recusada',
            description: rec.comentario_gestor
              ? `Motivo: ${rec.comentario_gestor}`
              : 'Sua solicitação de férias foi recusada pelo gestor.',
            variant: 'destructive',
          })
        }
      } else if (e.action === 'delete') {
        setSolicitacoes((prev) => prev.filter((s) => s.id !== rec.id))
      }
    }
  })

  // Férias aprovadas para cálculo de saldo dos períodos
  const feriasAprovadas = useMemo(() => {
    return solicitacoes.filter((s) => s.status === 'aprovada')
  }, [solicitacoes])

  // Cálculo dos Períodos Aquisitivos do Colaborador
  const periodosAquisitivos = useMemo<PeriodoAquisitivoFerias[]>(() => {
    if (!colaborador?.data_admissao) return []
    return feriasService.calcularPeriodosAquisitivos(colaborador.data_admissao, feriasAprovadas)
  }, [colaborador?.data_admissao, feriasAprovadas])

  // Período concessivo ativo mais urgente com saldo disponível
  const periodoDisponivelAtivo = useMemo(() => {
    const list = [...periodosAquisitivos]
    // Achar o período disponível/vencendo mais antigo com saldo > 0
    return list.reverse().find((p) => p.status !== 'em_aquisicao' && p.saldo > 0) || null
  }, [periodosAquisitivos])

  // Quantidade de dias efetivos selecionados
  const diasEfetivos = useMemo(() => {
    if (opcaoDias === 'custom') {
      return diasCustom || 0
    }
    return Number(opcaoDias) || 0
  }, [opcaoDias, diasCustom])

  // Data de término estimada
  const dataFimEstimada = useMemo(() => {
    if (!dataInicio || diasEfetivos <= 0) return null
    try {
      const d = new Date(dataInicio + 'T00:00:00')
      if (isNaN(d.getTime())) return null
      d.setDate(d.getDate() + diasEfetivos - 1)
      return d.toLocaleDateString('pt-BR')
    } catch {
      return null
    }
  }, [dataInicio, diasEfetivos])

  // Validação das regras da CLT e do período
  const validacao = useMemo(() => {
    const erros: string[] = []
    if (!dataInicio) {
      return { valido: false, erros: ['Informe a data de início desejada.'] }
    }

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const dInicio = new Date(dataInicio + 'T00:00:00')
    if (isNaN(dInicio.getTime())) {
      erros.push('Data de início inválida.')
      return { valido: false, erros }
    }

    // Regra: antecedência mínima de 30 dias da data atual (CLT art. 135)
    const msDiferenca = dInicio.getTime() - hoje.getTime()
    const diasAntecedencia = Math.ceil(msDiferenca / (1000 * 60 * 60 * 24))
    if (diasAntecedencia < 30) {
      erros.push(
        `A data de início deve ter no mínimo 30 dias de antecedência (atual: ${diasAntecedencia < 0 ? 'data no passado' : `${diasAntecedencia} dia(s)`}).`,
      )
    }

    // Dias mínimo e máximo
    if (diasEfetivos < 5) {
      erros.push('O período mínimo permitido de gozo de férias é de 5 dias corridos (CLT).')
    }
    if (diasEfetivos > 30) {
      erros.push('O período máximo de férias não pode exceder 30 dias.')
    }

    // Saldo do período aquisitivo disponível
    if (periodoDisponivelAtivo) {
      if (diasEfetivos > periodoDisponivelAtivo.saldo) {
        erros.push(
          `A quantidade de dias (${diasEfetivos}) excede o saldo restante do seu período aquisitivo (${periodoDisponivelAtivo.saldo} dias).`,
        )
      }

      // Início não pode ser antes do término do aquisitivo
      if (dInicio < periodoDisponivelAtivo.fimAquisitivo) {
        const dFimAq = periodoDisponivelAtivo.fimAquisitivo.toLocaleDateString('pt-BR')
        erros.push(
          `As férias só podem ter início após a conclusão do período aquisitivo (${dFimAq}).`,
        )
      }

      // Não pode iniciar após o limite concessivo
      if (dInicio > periodoDisponivelAtivo.limiteConcessivo) {
        const dLim = periodoDisponivelAtivo.limiteConcessivo.toLocaleDateString('pt-BR')
        erros.push(
          `A data de início não pode ultrapassar o limite concessivo deste período (${dLim}).`,
        )
      }
    } else if (periodosAquisitivos.length > 0) {
      const periodoEmAquisicao = periodosAquisitivos[0]
      if (dInicio < periodoEmAquisicao.fimAquisitivo) {
        const dFimAq = periodoEmAquisicao.fimAquisitivo.toLocaleDateString('pt-BR')
        erros.push(`Seu período aquisitivo atual ainda está em curso. Ele só conclui em ${dFimAq}.`)
      }
    }

    return {
      valido: erros.length === 0,
      erros,
    }
  }, [dataInicio, diasEfetivos, periodoDisponivelAtivo, periodosAquisitivos])

  // Enviar Solicitação
  const handleSubmitSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !colaboradorId) {
      toast({
        title: 'Perfil não identificado',
        description: 'Vínculo do colaborador não encontrado.',
        variant: 'destructive',
      })
      return
    }

    if (!validacao.valido) {
      toast({
        title: 'Dados inválidos',
        description: validacao.erros[0] || 'Corrija os campos antes de continuar.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      const dInicio = new Date(dataInicio + 'T00:00:00')
      const dFim = new Date(dInicio)
      dFim.setDate(dFim.getDate() + diasEfetivos - 1)

      const payload = {
        tenant_id: tenantId,
        colaborador_id: colaboradorId,
        data_inicio: dInicio.toISOString().slice(0, 10) + ' 00:00:00.000Z',
        data_fim: dFim.toISOString().slice(0, 10) + ' 00:00:00.000Z',
        dias: diasEfetivos,
        abono_pecuniario: abonoPecuniario,
        vender_20_dias: vender20Dias,
      }

      const nova = await feriasService.criarSolicitacao(payload)

      setSolicitacoes((prev) => [nova, ...prev])
      setModalOpen(false)
      // Reset
      setDataInicio('')
      setOpcaoDias('30')
      setDiasCustom(30)
      setAbonoPecuniario(false)
      setVender20Dias(false)

      toast({
        title: 'Solicitação enviada com sucesso',
        description: 'Sua solicitação de férias foi encaminhada para aprovação do gestor.',
      })
    } catch (err: unknown) {
      console.error('Erro ao solicitar férias:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao registrar a solicitação.'
      toast({
        title: 'Erro ao solicitar férias',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Cancelar solicitação pendente
  const handleCancelarSolicitacao = async (id: string) => {
    try {
      setCancelingId(id)
      const atualizada = await feriasService.cancelarSolicitacao(id)
      setSolicitacoes((prev) => prev.map((s) => (s.id === id ? { ...s, ...atualizada } : s)))
      toast({
        title: 'Solicitação cancelada',
        description: 'A solicitação de férias foi cancelada com sucesso.',
      })
    } catch (err) {
      console.error('Erro ao cancelar solicitação:', err)
      toast({
        title: 'Erro ao cancelar',
        description: 'Não foi possível cancelar a solicitação.',
        variant: 'destructive',
      })
    } finally {
      setCancelingId(null)
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
            className="bg-neutral-100 text-neutral-600 border-neutral-300 font-semibold text-xs flex items-center gap-1"
          >
            <Ban className="w-3 h-3 text-neutral-500" />
            Cancelada
          </Badge>
        )
    }
  }

  // Formatar data curta BR
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
            <Palmtree className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">Minhas Férias</h1>
            <p className="text-xs text-[#757575] mt-0.5">
              Consulte seus períodos aquisitivos, acompanhe o saldo legal e solicite seus períodos
              de descanso.
            </p>
          </div>
        </div>

        {/* Botão de Solicitação */}
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white shadow-sm font-semibold h-10 px-5 gap-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Solicitar Férias
        </Button>
      </div>

      {/* 2. Cartões de Períodos Aquisitivos & Concessivos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-[#0D47A1]" />
            <h2 className="text-base font-bold text-[#212121]">
              Períodos Aquisitivos e Concessivos
            </h2>
          </div>
          <span className="text-xs text-[#757575]">
            Admissão:{' '}
            {colaborador?.data_admissao ? formatData(colaborador.data_admissao) : 'Não cadastrada'}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
        ) : periodosAquisitivos.length === 0 ? (
          <Card className="border border-dashed border-[#BDBDBD] bg-[#FAFAFA]">
            <CardContent className="p-8 text-center space-y-2">
              <CalendarDays className="h-8 w-8 text-[#9E9E9E] mx-auto" />
              <p className="text-sm font-medium text-[#616161]">
                Nenhum período aquisitivo disponível para o colaborador.
              </p>
              <p className="text-xs text-[#757575]">
                Certifique-se de que a data de admissão esteja preenchida corretamente no cadastro.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {periodosAquisitivos.map((p, idx) => {
              const percUtilizado = Math.min(100, Math.round((p.diasGozados / 30) * 100))

              let statusBadge = (
                <Badge variant="outline" className="bg-[#E8F5E9] text-[#2E7D32] border-[#81C784]">
                  Disponível para Gozo
                </Badge>
              )
              let cardBorderClass = 'border-[#E0E0E0] hover:border-[#0D47A1]/40'

              if (p.status === 'em_aquisicao') {
                statusBadge = (
                  <Badge variant="outline" className="bg-[#E3F2FD] text-[#0D47A1] border-[#90CAF9]">
                    Em Aquisição
                  </Badge>
                )
              } else if (p.status === 'gozado') {
                statusBadge = (
                  <Badge
                    variant="outline"
                    className="bg-neutral-100 text-neutral-600 border-neutral-300"
                  >
                    Totalmente Gozado
                  </Badge>
                )
              } else if (p.status === 'vencendo') {
                cardBorderClass = 'border-[#FBC02D] bg-[#FFFDE7]/20 shadow-sm'
                statusBadge = (
                  <Badge
                    variant="outline"
                    className="bg-[#FFF9C4] text-[#B78103] border-[#FBC02D] font-bold"
                  >
                    Vencendo em breve!
                  </Badge>
                )
              } else if (p.status === 'vencido') {
                cardBorderClass = 'border-[#EF5350] bg-[#FFEBEE]/20 shadow-sm'
                statusBadge = (
                  <Badge
                    variant="outline"
                    className="bg-[#FFCDD2] text-[#B71C1C] border-[#E57373] font-bold"
                  >
                    Limite Ultrapassado
                  </Badge>
                )
              }

              return (
                <Card
                  key={idx}
                  className={`transition-all bg-white shadow-sm border ${cardBorderClass} flex flex-col justify-between`}
                >
                  <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#0D47A1] uppercase tracking-wider">
                        Ciclo Anual {periodosAquisitivos.length - idx}
                      </span>
                      {statusBadge}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-medium text-[#616161]">
                        <span className="font-semibold text-[#212121]">Período aquisitivo:</span>{' '}
                        {formatData(p.inicioAquisitivo)} a {formatData(p.fimAquisitivo)}
                      </div>
                      <div className="text-xs font-medium text-[#616161]">
                        <span className="font-semibold text-[#212121]">Limite concessivo:</span>{' '}
                        <span
                          className={
                            p.status === 'vencendo'
                              ? 'text-[#B78103] font-bold'
                              : p.status === 'vencido'
                                ? 'text-[#B71C1C] font-bold'
                                : 'text-[#212121]'
                          }
                        >
                          {formatData(p.limiteConcessivo)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="grid grid-cols-3 gap-2 py-2 bg-[#F5F7FB] rounded-lg text-center">
                      <div>
                        <div className="text-[11px] text-[#757575]">Direito</div>
                        <div className="text-sm font-bold text-[#212121]">30d</div>
                      </div>
                      <div className="border-x border-[#E0E0E0]">
                        <div className="text-[11px] text-[#757575]">Gozados</div>
                        <div className="text-sm font-bold text-[#616161]">{p.diasGozados}d</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#757575]">Saldo</div>
                        <div
                          className={`text-sm font-bold ${
                            p.saldo > 0 ? 'text-[#0D47A1]' : 'text-neutral-400'
                          }`}
                        >
                          {p.saldo}d
                        </div>
                      </div>
                    </div>

                    {/* Barra de progresso do saldo */}
                    <div className="space-y-1">
                      <div className="w-full bg-[#E0E0E0] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#0D47A1] h-1.5 rounded-full transition-all"
                          style={{ width: `${percUtilizado}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#757575]">
                        <span>Utilizado: {p.diasGozados} dias</span>
                        <span>Disponível: {p.saldo} dias</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. Tabela / Lista de Solicitações do Colaborador */}
      <Card className="border border-[#E0E0E0] shadow-sm bg-white">
        <CardHeader className="p-5 border-b border-[#E0E0E0] flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-lg font-bold text-[#212121] flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-[#0D47A1]" />
              Minhas Solicitações de Férias
            </CardTitle>
            <CardDescription className="text-xs text-[#757575]">
              Acompanhe suas solicitações enviadas, o parecer do gestor e eventuais observações.
            </CardDescription>
          </div>
          <span className="text-xs text-[#757575]">
            Total: <strong>{solicitacoes.length}</strong> registro(s)
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : solicitacoes.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1] mx-auto">
                <Palmtree className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-[#212121]">
                Nenhuma solicitação de férias cadastrada.
              </p>
              <p className="text-xs text-[#757575] max-w-md mx-auto">
                Quando você planejar seu descanso, clique em &ldquo;Solicitar Férias&rdquo; para
                programar seus dias com antecedência de pelo menos 30 dias.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-[#F8F9FA] text-[#616161] font-semibold text-xs border-b border-[#E0E0E0]">
                  <tr>
                    <th className="py-3 px-4">Período de Gozo</th>
                    <th className="py-3 px-4 text-center">Dias</th>
                    <th className="py-3 px-4">Abono Pecuniário</th>
                    <th className="py-3 px-4">Data da Solicitação</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Parecer do Gestor</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E0] text-xs">
                  {solicitacoes.map((sol) => {
                    const dataInicioFormatada = formatData(sol.data_inicio)
                    const dataFimFormatada = formatData(sol.data_fim)

                    return (
                      <tr key={sol.id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-[#212121]">
                          <div className="flex items-center gap-1.5">
                            <span>{dataInicioFormatada}</span>
                            <span className="text-[#9E9E9E] font-normal">até</span>
                            <span>{dataFimFormatada}</span>
                          </div>
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
                        <td className="py-3.5 px-4 text-center">{renderBadgeStatus(sol.status)}</td>
                        <td className="py-3.5 px-4 text-[#616161] max-w-xs truncate">
                          {sol.comentario_gestor ? (
                            <span title={sol.comentario_gestor} className="italic text-[#424242]">
                              &ldquo;{sol.comentario_gestor}&rdquo;
                            </span>
                          ) : (
                            <span className="text-[#9E9E9E]">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {sol.status === 'pendente' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={cancelingId === sol.id}
                              onClick={() => handleCancelarSolicitacao(sol.id)}
                              className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              {cancelingId === sol.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <Ban className="w-3 h-3 mr-1" />
                              )}
                              Cancelar
                            </Button>
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

      {/* 4. Modal de Solicitação de Férias */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white border border-[#E0E0E0] p-6">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2 text-[#0D47A1]">
              <Palmtree className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold text-[#212121]">
                Solicitar Período de Férias
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#757575]">
              Informe a data de início e a duração do período. Conforme CLT, férias devem ser
              solicitadas com no mínimo 30 dias de antecedência.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitSolicitacao} className="space-y-4 pt-2">
            {/* Aviso sobre Período Aquisitivo Ativo */}
            {periodoDisponivelAtivo ? (
              <div className="bg-[#E8EEF7] border border-[#BBDEFB] p-3 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-[#0D47A1] flex items-center gap-1.5">
                  <Info className="w-4 h-4" />
                  Período Aquisitivo em Aberto
                </div>
                <div className="text-[#37474F]">
                  Aquisitivo: <strong>
                    {formatData(periodoDisponivelAtivo.inicioAquisitivo)}
                  </strong>{' '}
                  a <strong>{formatData(periodoDisponivelAtivo.fimAquisitivo)}</strong>
                  <br />
                  Limite concessivo:{' '}
                  <strong>{formatData(periodoDisponivelAtivo.limiteConcessivo)}</strong>
                  <br />
                  Saldo remanescente:{' '}
                  <strong className="text-[#0D47A1]">
                    {periodoDisponivelAtivo.saldo} dias disponíveis
                  </strong>
                </div>
              </div>
            ) : (
              <div className="bg-[#FFF9C4]/60 border border-[#FBC02D] p-3 rounded-lg text-xs text-[#7F6000] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  Atenção: Não há saldo liberado de períodos aquisitivos concluídos ou o período
                  ainda está em aquisição. Solicitações antecipadas dependem de autorização do RH e
                  da gestão.
                </div>
              </div>
            )}

            {/* Data de Início */}
            <div className="space-y-1.5">
              <Label htmlFor="data_inicio" className="text-xs font-semibold text-[#212121]">
                Data de Início das Férias <span className="text-red-500">*</span>
              </Label>
              <Input
                id="data_inicio"
                type="date"
                required
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border-[#E0E0E0] text-sm h-10 focus:border-[#0D47A1]"
              />
              <p className="text-[11px] text-[#757575]">
                Exige mínimo 30 dias a contar de hoje (início sugerido a partir de{' '}
                {new Date(Date.now() + 30 * 86400000).toLocaleDateString('pt-BR')}).
              </p>
            </div>

            {/* Duração dos Dias */}
            <div className="space-y-1.5">
              <Label htmlFor="opcao_dias" className="text-xs font-semibold text-[#212121]">
                Duração do Período (Dias de Gozo) <span className="text-red-500">*</span>
              </Label>
              <Select value={opcaoDias} onValueChange={setOpcaoDias}>
                <SelectTrigger id="opcao_dias" className="h-10 text-sm border-[#E0E0E0]">
                  <SelectValue placeholder="Selecione os dias" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="30">30 dias integrais</SelectItem>
                  <SelectItem value="20">20 dias corridos</SelectItem>
                  <SelectItem value="15">15 dias corridos</SelectItem>
                  <SelectItem value="10">10 dias corridos</SelectItem>
                  <SelectItem value="5">5 dias corridos (mínimo CLT)</SelectItem>
                  <SelectItem value="custom">Personalizado (5 a 30 dias)...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campo custom se selecionado */}
            {opcaoDias === 'custom' && (
              <div className="space-y-1.5 pl-2 border-l-2 border-[#0D47A1]">
                <Label htmlFor="dias_custom" className="text-xs font-semibold text-[#212121]">
                  Quantidade exata de dias (5 a 30)
                </Label>
                <Input
                  id="dias_custom"
                  type="number"
                  min="5"
                  max="30"
                  value={diasCustom}
                  onChange={(e) => setDiasCustom(parseInt(e.target.value, 10) || 0)}
                  className="border-[#E0E0E0] text-sm h-10 focus:border-[#0D47A1]"
                />
              </div>
            )}

            {/* Toggles de Abono Pecuniário */}
            <div className="space-y-3 pt-2 border-t border-[#E0E0E0]">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="abono"
                    className="text-xs font-semibold text-[#212121] cursor-pointer"
                  >
                    Abono pecuniário (Vender 10 dias / 1/3 das férias)
                  </Label>
                  <p className="text-[11px] text-[#757575]">
                    Converte 10 dias de férias em remuneração financeira conforme CLT art. 143.
                  </p>
                </div>
                <Switch
                  id="abono"
                  checked={abonoPecuniario}
                  onCheckedChange={(checked) => {
                    setAbonoPecuniario(checked)
                    if (checked && opcaoDias === '30') {
                      setOpcaoDias('20')
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="vender20"
                    className="text-xs font-semibold text-[#212121] cursor-pointer"
                  >
                    Vender saldo adicional (abono diferenciado)
                  </Label>
                  <p className="text-[11px] text-[#757575]">
                    Opção sujeita a convenção coletiva / acordo sindical vigente.
                  </p>
                </div>
                <Switch id="vender20" checked={vender20Dias} onCheckedChange={setVender20Dias} />
              </div>
            </div>

            {/* Resumo do Período Calculado */}
            {dataFimEstimada && (
              <div className="p-3 bg-[#F5F5F5] rounded-lg text-xs space-y-1">
                <div className="flex justify-between text-[#424242]">
                  <span>Início do descanso:</span>
                  <strong className="text-[#212121]">{formatData(dataInicio)}</strong>
                </div>
                <div className="flex justify-between text-[#424242]">
                  <span>Término previsto:</span>
                  <strong className="text-[#212121]">{dataFimEstimada}</strong>
                </div>
                <div className="flex justify-between text-[#424242]">
                  <span>Total de dias corridos:</span>
                  <strong className="text-[#0D47A1]">{diasEfetivos} dias</strong>
                </div>
              </div>
            )}

            {/* Mensagens de erro de validação */}
            {!validacao.valido && dataInicio && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
                {validacao.erros.map((erro, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{erro}</span>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || !validacao.valido}
                className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  'Confirmar Solicitação'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
