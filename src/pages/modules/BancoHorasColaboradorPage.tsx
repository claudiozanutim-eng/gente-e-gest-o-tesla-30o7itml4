import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  ShieldAlert,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  Lock,
  PlusCircle,
  AlertCircle,
  XCircle,
  HelpCircle,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BancoHorasFechamento, CompensacaoBancoHoras } from '@/types'
import { bancoHorasService } from '@/services/bancoHorasService'
import { compensacaoService } from '@/services/compensacaoService'
import { formatDataPtBr } from '@/lib/exportReports'
import { toast } from '@/hooks/use-toast'

export const BancoHorasColaboradorPage: React.FC = () => {
  const { user, colaborador } = useAuth()
  const [fechamentos, setFechamentos] = useState<BancoHorasFechamento[]>([])
  const [compensacoes, setCompensacoes] = useState<CompensacaoBancoHoras[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Modal de Solicitação de Compensação
  const [modalCompensacaoAberto, setModalCompensacaoAberto] = useState(false)
  const [dataCompensacao, setDataCompensacao] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [horasCompensacao, setHorasCompensacao] = useState('4.0')
  const [motivoCompensacao, setMotivoCompensacao] = useState('')
  const [salvandoCompensacao, setSalvandoCompensacao] = useState(false)
  const [erroFormulario, setErroFormulario] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    if (!user?.tenant_id || !colaborador?.id) return
    setLoading(true)
    try {
      const [listaFechamentos, listaCompensacoes] = await Promise.all([
        bancoHorasService.getFechamentosColaborador(user.tenant_id, colaborador.id),
        compensacaoService.getCompensacoesColaborador(user.tenant_id, colaborador.id),
      ])
      setFechamentos(listaFechamentos)
      setCompensacoes(listaCompensacoes)
    } catch (err) {
      console.error('Erro ao buscar dados do banco de horas:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.tenant_id, colaborador?.id])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Total de horas das compensações aprovadas (debitam do saldo)
  const totalHorasCompensadasAprovadas = useMemo(() => {
    return compensacoes
      .filter((c) => c.status === 'aprovada')
      .reduce((acc, curr) => acc + (curr.horas || 0), 0)
  }, [compensacoes])

  // Total de horas pendentes de aprovação
  const totalHorasCompensadasPendentes = useMemo(() => {
    return compensacoes
      .filter((c) => c.status === 'pendente')
      .reduce((acc, curr) => acc + (curr.horas || 0), 0)
  }, [compensacoes])

  // Cálculo do saldo acumulado baseado nos fechamentos mensais homologados e compensações aprovadas
  const { saldoAcumuladoBrutoMs, totalTrabalhadasMs, totalEscaladasMs } = useMemo(() => {
    let acum = 0
    let trab = 0
    let esc = 0
    fechamentos.forEach((f) => {
      acum += f.saldo_ms
      trab += f.horas_trabalhadas_ms
      esc += f.horas_escaladas_ms
    })
    return {
      saldoAcumuladoBrutoMs: acum,
      totalTrabalhadasMs: trab,
      totalEscaladasMs: esc,
    }
  }, [fechamentos])

  // Saldo Líquido Efetivo (após compensações aprovadas)
  const debitoCompensacoesMs = totalHorasCompensadasAprovadas * 3600 * 1000
  const saldoLiquidoAtualMs = saldoAcumuladoBrutoMs - debitoCompensacoesMs
  const saldoLiquidoEmHoras = saldoLiquidoAtualMs / (3600 * 1000)

  // Saldo Disponível para novas compensações (descontando também as que estão em análise)
  const saldoDisponivelNovasCompensacoesHoras = Math.max(
    0,
    saldoLiquidoEmHoras - totalHorasCompensadasPendentes,
  )

  const isSaldoPositivo = saldoLiquidoAtualMs >= 0

  // Histórico ordenado cronológico
  const fechamentosComAcumulado = useMemo(() => {
    const ordenadoCronologico = [...fechamentos].sort((a, b) =>
      a.competencia.localeCompare(b.competencia),
    )
    let saldoCorrido = 0
    const mapaAcumulado = new Map<string, number>()

    ordenadoCronologico.forEach((f) => {
      saldoCorrido += f.saldo_ms
      mapaAcumulado.set(f.id, saldoCorrido)
    })

    return fechamentos.map((f) => ({
      ...f,
      saldoAcumuladoAteMesMs: mapaAcumulado.get(f.id) || f.saldo_ms,
    }))
  }, [fechamentos])

  // Submissão do formulário de compensação
  const handleSolicitarCompensacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.tenant_id || !colaborador?.id || !user?.id) return

    setErroFormulario(null)
    const horasNum = parseFloat(horasCompensacao.replace(',', '.'))
    if (isNaN(horasNum) || horasNum <= 0) {
      setErroFormulario('Informe uma quantidade de horas válida (ex.: 0.5, 2, 4, 8).')
      return
    }

    if (!dataCompensacao) {
      setErroFormulario('Selecione a data pretendida para a compensação.')
      return
    }

    if (!motivoCompensacao.trim()) {
      setErroFormulario('Descreva o motivo ou justificativa da compensação.')
      return
    }

    setSalvandoCompensacao(true)
    try {
      await compensacaoService.solicitarCompensacao({
        tenantId: user.tenant_id,
        colaboradorId: colaborador.id,
        dataCompensacao,
        horas: horasNum,
        motivo: motivoCompensacao.trim(),
        userId: user.id,
      })

      toast({
        title: 'Compensação solicitada com sucesso',
        description: `Sua solicitação de ${horasNum}h para ${formatDataPtBr(dataCompensacao)} foi enviada para aprovação da liderança.`,
      })

      setModalCompensacaoAberto(false)
      setMotivoCompensacao('')
      setHorasCompensacao('4.0')
      carregarDados()
    } catch (err: any) {
      setErroFormulario(err?.message || 'Falha ao solicitar compensação de horas.')
    } finally {
      setSalvandoCompensacao(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Clock className="h-6 w-6 text-[#0D47A1]" />
            Banco de Horas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe o saldo consolidado de suas horas, solicitações de compensação e fechamentos
            homologados pelo RH.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="gap-2 border-slate-300 text-slate-700 hover:text-[#0D47A1]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setErroFormulario(null)
              setModalCompensacaoAberto(true)
            }}
            disabled={loading || saldoLiquidoEmHoras <= 0}
            className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white gap-2 font-semibold shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            Solicitar Compensação
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Saldo Líquido Consolidado (Verde Positivo / Vermelho Negativo) */}
          <Card
            className={`border-2 shadow-xs transition-colors ${
              isSaldoPositivo
                ? 'border-emerald-200 bg-linear-to-br from-emerald-50/70 to-white'
                : 'border-rose-200 bg-linear-to-br from-rose-50/70 to-white'
            }`}
          >
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isSaldoPositivo ? 'text-emerald-800' : 'text-rose-800'
                }`}
              >
                Saldo Líquido Consolidado
              </span>
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center ${
                  isSaldoPositivo ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {isSaldoPositivo ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div
                className={`text-3xl font-black font-mono tracking-tight ${
                  isSaldoPositivo ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {bancoHorasService.formatarSaldoMs(saldoLiquidoAtualMs)}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                {isSaldoPositivo ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      {saldoDisponivelNovasCompensacoesHoras.toFixed(1)}h livres para folga
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                    <span>Horas em débito a compensar</span>
                  </>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Horas Compensadas Aprovadas */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Compensadas (Debitado)
              </span>
              <div className="h-9 w-9 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {totalHorasCompensadasAprovadas.toFixed(1)}h
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {compensacoes.filter((c) => c.status === 'aprovada').length} folga(s) já aprovadas e
                abatidas
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Total de Horas Trabalhadas */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Horas Trabalhadas
              </span>
              <div className="h-9 w-9 rounded-full bg-blue-50 text-[#0D47A1] flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {bancoHorasService.formatarHorasMs(totalTrabalhadasMs)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Soma das jornadas apuradas nos meses fechados
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Total de Horas Previstas */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Horas Previstas
              </span>
              <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {bancoHorasService.formatarHorasMs(totalEscaladasMs)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Jornada contratual esperada na escala</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Seção 1: Minhas Solicitações de Compensação de Banco de Horas */}
      <Card className="border border-slate-200 bg-white shadow-xs">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#0D47A1]" />
              <CardTitle className="text-base font-bold text-slate-900">
                Minhas Solicitações de Compensação
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-blue-50 text-[#0D47A1] border-blue-200 text-xs font-semibold"
              >
                {compensacoes.length} {compensacoes.length === 1 ? 'registro' : 'registros'}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Histórico de solicitações de abono e folgas compensatórias debitadas do saldo
              positivo.
            </CardDescription>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setErroFormulario(null)
              setModalCompensacaoAberto(true)
            }}
            disabled={loading || saldoLiquidoEmHoras <= 0}
            className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs gap-1.5 h-8 font-medium"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Nova Solicitação
          </Button>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : compensacoes.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-2">
              <div className="h-10 w-10 rounded-full bg-blue-50 text-[#0D47A1] flex items-center justify-center mx-auto">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Nenhuma compensação solicitada
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Se você possui horas acumuladas positivas, clique em &ldquo;Nova Solicitação&rdquo;
                para utilizar seu saldo em folgas ou ausências combinadas.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Data da Compensação
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-right">
                    Horas
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Motivo / Justificativa
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-center">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Impacto no Saldo
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Parecer da Gestão
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compensacoes.map((item) => {
                  let badgeStatus = null
                  if (item.status === 'pendente') {
                    badgeStatus = (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-semibold gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        Pendente
                      </Badge>
                    )
                  } else if (item.status === 'aprovada') {
                    badgeStatus = (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-semibold gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Aprovada
                      </Badge>
                    )
                  } else {
                    badgeStatus = (
                      <Badge
                        variant="outline"
                        className="bg-rose-50 text-rose-800 border-rose-300 text-[10px] font-semibold gap-1"
                      >
                        <XCircle className="h-3 w-3 text-rose-600" />
                        Recusada
                      </Badge>
                    )
                  }

                  return (
                    <TableRow
                      key={item.id}
                      className="text-xs border-b border-slate-100 hover:bg-slate-50/50"
                    >
                      <TableCell className="font-bold text-slate-900 py-3">
                        {formatDataPtBr(item.data_compensacao)}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-right text-slate-800 py-3">
                        {item.horas.toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-slate-700 max-w-xs truncate py-3">
                        {item.motivo}
                      </TableCell>
                      <TableCell className="text-center py-3">{badgeStatus}</TableCell>
                      <TableCell className="py-3">
                        {item.status === 'aprovada' ? (
                          <span className="font-mono font-bold text-rose-700">
                            -{item.horas.toFixed(1)}h debitadas
                          </span>
                        ) : item.status === 'pendente' ? (
                          <span className="font-mono text-amber-700 text-[11px]">
                            {item.horas.toFixed(1)}h reservadas
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Sem débito mantido</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 max-w-xs truncate py-3">
                        {item.motivo_resposta || (
                          <span className="text-slate-400 italic">Aguardando análise</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Seção 2: Tabela de Fechamentos Mensais Homologados */}
      <Card className="border border-slate-200 bg-white shadow-xs">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#0D47A1]" />
              <CardTitle className="text-base font-bold text-slate-900">
                Histórico de Fechamentos Mensais
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-blue-50 text-[#0D47A1] border-blue-200 text-xs font-semibold"
              >
                {fechamentos.length} {fechamentos.length === 1 ? 'competência' : 'competências'}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Saldos mensais congelados pelo Recursos Humanos após apuração do espelho de ponto.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : fechamentosComAcumulado.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="h-12 w-12 rounded-full bg-blue-50 text-[#0D47A1] flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-sm font-semibold text-slate-900">Nenhum mês fechado ainda</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Assim que o RH consolidar o fechamento de uma competência mensal, o extrato e o
                  saldo acumulado aparecerão nesta listagem.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Competência
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-right">
                    Trabalhadas
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-right">
                    Escaladas
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-right">
                    Saldo do Mês
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-right">
                    Saldo Acumulado
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-center">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Fechamento em
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Observação RH
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fechamentosComAcumulado.map((item) => {
                  const saldoMesPositivo = item.saldo_ms >= 0
                  const saldoAcumPositivo = item.saldoAcumuladoAteMesMs >= 0

                  return (
                    <TableRow
                      key={item.id}
                      className="text-xs border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
                    >
                      <TableCell className="font-bold text-slate-900 py-3.5 flex items-center gap-1.5">
                        <Lock className="h-3 w-3 text-slate-400" />
                        <span>{bancoHorasService.formatarCompetenciaLabel(item.competencia)}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-normal">
                          ({item.competencia})
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-slate-700 text-right py-3.5">
                        {bancoHorasService.formatarHorasMs(item.horas_trabalhadas_ms)}
                      </TableCell>
                      <TableCell className="font-mono text-slate-700 text-right py-3.5">
                        {bancoHorasService.formatarHorasMs(item.horas_escaladas_ms)}
                      </TableCell>
                      <TableCell
                        className={`font-mono font-bold text-right py-3.5 ${
                          saldoMesPositivo ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {bancoHorasService.formatarSaldoMs(item.saldo_ms)}
                      </TableCell>
                      <TableCell
                        className={`font-mono font-black text-right py-3.5 ${
                          saldoAcumPositivo ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {bancoHorasService.formatarSaldoMs(item.saldoAcumuladoAteMesMs)}
                      </TableCell>
                      <TableCell className="text-center py-3.5">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold"
                        >
                          Fechado
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 font-mono text-[11px] py-3.5">
                        {formatDataPtBr(item.data_fechamento)}
                      </TableCell>
                      <TableCell className="text-slate-600 max-w-xs truncate py-3.5">
                        {item.comentario_rh || <span className="text-slate-400 italic">—</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Solicitação de Compensação */}
      <Dialog open={modalCompensacaoAberto} onOpenChange={setModalCompensacaoAberto}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#0D47A1]" />
              Solicitar Compensação de Banco de Horas
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Utilize suas horas excedentes acumuladas para compensar ausências ou planejar folgas
              parciais/inteiras.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSolicitarCompensacao} className="space-y-4 py-2 text-xs">
            {/* Saldo Disponível Info */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-slate-800 flex items-center justify-between">
              <span className="font-medium">Saldo Disponível para Solicitação:</span>
              <span className="font-mono font-bold text-[#0D47A1] text-sm">
                {saldoDisponivelNovasCompensacoesHoras.toFixed(1)}h
              </span>
            </div>

            {erroFormulario && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{erroFormulario}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="dataComp" className="text-xs font-semibold text-slate-700">
                Data da Compensação
              </Label>
              <Input
                id="dataComp"
                type="date"
                value={dataCompensacao}
                onChange={(e) => setDataCompensacao(e.target.value)}
                required
                className="text-xs h-9 border-slate-300"
              />
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-slate-400" />
                Válida para datas até no máximo 30 dias no futuro.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qtdHoras" className="text-xs font-semibold text-slate-700">
                Quantidade de Horas (decimal, ex.: 0.5, 2, 4, 8)
              </Label>
              <Input
                id="qtdHoras"
                type="number"
                step="0.5"
                min="0.5"
                max={Math.max(0.5, saldoDisponivelNovasCompensacoesHoras)}
                value={horasCompensacao}
                onChange={(e) => setHorasCompensacao(e.target.value)}
                required
                className="text-xs h-9 border-slate-300 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivoComp" className="text-xs font-semibold text-slate-700">
                Justificativa / Motivo
              </Label>
              <Textarea
                id="motivoComp"
                placeholder="Ex: Consulta médica agendada / Compensação de saída antecipada..."
                value={motivoCompensacao}
                onChange={(e) => setMotivoCompensacao(e.target.value)}
                required
                className="text-xs min-h-[70px] border-slate-300"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={salvandoCompensacao}
                onClick={() => setModalCompensacaoAberto(false)}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoCompensacao}
                className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs h-9 font-semibold gap-1.5"
              >
                {salvandoCompensacao ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                {salvandoCompensacao ? 'Enviando...' : 'Confirmar Solicitação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default BancoHorasColaboradorPage
