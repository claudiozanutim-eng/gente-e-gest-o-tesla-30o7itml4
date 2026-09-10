import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calendar,
  Lock,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Users,
  Loader2,
  Building2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { Colaborador, BancoHorasFechamento } from '@/types'
import { colaboradorService } from '@/services/api'
import { bancoHorasService, FechamentoCalculadoItem } from '@/services/bancoHorasService'
import { formatDataPtBr } from '@/lib/exportReports'

const MESES = [
  { valor: '01', nome: 'Janeiro' },
  { valor: '02', nome: 'Fevereiro' },
  { valor: '03', nome: 'Março' },
  { valor: '04', nome: 'Abril' },
  { valor: '05', nome: 'Maio' },
  { valor: '06', nome: 'Junho' },
  { valor: '07', nome: 'Julho' },
  { valor: '08', nome: 'Agosto' },
  { valor: '09', nome: 'Setembro' },
  { valor: '10', nome: 'Outubro' },
  { valor: '11', nome: 'Novembro' },
  { valor: '12', nome: 'Dezembro' },
]

export const FechamentoBancoHorasPage: React.FC = () => {
  const { user } = useAuth()

  // Mês de referência padrão: 2026-09
  const [anoSelecionado, setAnoSelecionado] = useState<string>('2026')
  const [mesSelecionado, setMesSelecionado] = useState<string>('09')
  const competenciaAtual = `${anoSelecionado}-${mesSelecionado}`

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [fechamentosExistentes, setFechamentosExistentes] = useState<BancoHorasFechamento[]>([])
  const [itensCalculados, setItensCalculados] = useState<FechamentoCalculadoItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [calculando, setCalculando] = useState<boolean>(false)

  // Filtros
  const [busca, setBusca] = useState('')
  const [departamentoFiltro, setDepartamentoFiltro] = useState<string>('todos')

  // Modal Fechamento Individual
  const [colaboradorParaFechar, setColaboradorParaFechar] =
    useState<FechamentoCalculadoItem | null>(null)
  const [comentarioFechamento, setComentarioFechamento] = useState('')
  const [salvandoFechamento, setSalvandoFechamento] = useState(false)

  // Modal Fechamento em Lote (Departamento ou Todos)
  const [modalLoteAberto, setModalLoteAberto] = useState(false)
  const [comentarioLote, setComentarioLote] = useState('')
  const [processandoLote, setProcessandoLote] = useState(false)

  const carregarDados = useCallback(async () => {
    if (!user?.tenant_id) return
    setLoading(true)
    try {
      // 1. Carregar colaboradores ativos do tenant
      const colabs = await colaboradorService.getColaboradores(user.tenant_id)
      const ativos = colabs.filter((c) => c.status === 'ativo')
      setColaboradores(ativos)

      // 2. Carregar fechamentos já existentes nesta competência
      const fechados = await bancoHorasService.getFechamentosTenantCompetencia(
        user.tenant_id,
        competenciaAtual,
      )
      setFechamentosExistentes(fechados)

      // 3. Apurar saldo de cada colaborador na competência
      setCalculando(true)
      const ano = parseInt(anoSelecionado, 10)
      const mes = parseInt(mesSelecionado, 10)

      const mapaFechados = new Map<string, BancoHorasFechamento>()
      fechados.forEach((f) => mapaFechados.set(f.colaborador_id, f))

      const resultados: FechamentoCalculadoItem[] = []

      // Executa os cálculos em paralelo com Promise.all
      const apuracoes = await Promise.all(
        ativos.map(async (colab) => {
          const jaFechado = mapaFechados.has(colab.id)
          const fechamentoExistente = mapaFechados.get(colab.id)

          if (jaFechado && fechamentoExistente) {
            // Se já fechado, usa o saldo congelado
            return {
              colaboradorId: colab.id,
              colaboradorNome: colab.nome_completo || colab.nome,
              colaboradorCargo: colab.cargo,
              departamento: colab.departamento || 'Geral',
              competencia: competenciaAtual,
              horasTrabalhadasMs: fechamentoExistente.horas_trabalhadas_ms,
              horasEscaladasMs: fechamentoExistente.horas_escaladas_ms,
              saldoMs: fechamentoExistente.saldo_ms,
              horasCreditoMs: fechamentoExistente.horas_credito_ms,
              horasDebitoMs: fechamentoExistente.horas_debito_ms,
              jaFechado: true,
              fechamentoExistente,
            }
          }

          // Se não fechado, calcula em tempo real com pontoService
          try {
            const saldoCalc = await bancoHorasService.calcularSaldoMes(
              user.tenant_id,
              colab.id,
              ano,
              mes,
            )
            return {
              colaboradorId: colab.id,
              colaboradorNome: colab.nome_completo || colab.nome,
              colaboradorCargo: colab.cargo,
              departamento: colab.departamento || 'Geral',
              competencia: competenciaAtual,
              horasTrabalhadasMs: saldoCalc.horasTrabalhadasMs,
              horasEscaladasMs: saldoCalc.horasEscaladasMs,
              saldoMs: saldoCalc.saldoMs,
              horasCreditoMs: saldoCalc.horasCreditoMs,
              horasDebitoMs: saldoCalc.horasDebitoMs,
              jaFechado: false,
            }
          } catch (e) {
            return {
              colaboradorId: colab.id,
              colaboradorNome: colab.nome_completo || colab.nome,
              colaboradorCargo: colab.cargo,
              departamento: colab.departamento || 'Geral',
              competencia: competenciaAtual,
              horasTrabalhadasMs: 0,
              horasEscaladasMs: 0,
              saldoMs: 0,
              horasCreditoMs: 0,
              horasDebitoMs: 0,
              jaFechado: false,
            }
          }
        }),
      )

      setItensCalculados(apuracoes)
    } catch (err) {
      console.error('Erro ao carregar dados de fechamento de banco de horas:', err)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar colaboradores e saldos de ponto.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setCalculando(false)
    }
  }, [user?.tenant_id, competenciaAtual, anoSelecionado, mesSelecionado])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Lista de Departamentos únicos para filtro
  const departamentos = useMemo(() => {
    const deps = new Set<string>()
    colaboradores.forEach((c) => {
      if (c.departamento) deps.add(c.departamento)
    })
    return Array.from(deps).sort()
  }, [colaboradores])

  // Filtragem
  const itensFiltrados = useMemo(() => {
    return itensCalculados.filter((item) => {
      const matchBusca =
        !busca ||
        item.colaboradorNome.toLowerCase().includes(busca.toLowerCase()) ||
        item.colaboradorCargo?.toLowerCase().includes(busca.toLowerCase())
      const matchDepto = departamentoFiltro === 'todos' || item.departamento === departamentoFiltro
      return matchBusca && matchDepto
    })
  }, [itensCalculados, busca, departamentoFiltro])

  const totalPendentes = useMemo(() => {
    return itensFiltrados.filter((i) => !i.jaFechado).length
  }, [itensFiltrados])

  // Fechar Mês Individual
  const handleConfirmarFechamentoIndividual = async () => {
    if (!colaboradorParaFechar || !user?.tenant_id || !user?.id) return

    setSalvandoFechamento(true)
    try {
      await bancoHorasService.fecharMesColaborador({
        tenantId: user.tenant_id,
        colaboradorId: colaboradorParaFechar.colaboradorId,
        competencia: competenciaAtual,
        comentarioRh: comentarioFechamento,
        userId: user.id,
      })

      toast({
        title: 'Mês fechado com sucesso',
        description: `Banco de horas de ${colaboradorParaFechar.colaboradorNome} consolidado para ${bancoHorasService.formatarCompetenciaLabel(competenciaAtual)}.`,
      })

      setColaboradorParaFechar(null)
      setComentarioFechamento('')
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro no fechamento',
        description: err?.message || 'Falha ao consolidar o banco de horas.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoFechamento(false)
    }
  }

  // Fechar Mês em Lote
  const handleConfirmarFechamentoLote = async () => {
    if (!user?.tenant_id || !user?.id) return
    const pendentes = itensFiltrados.filter((i) => !i.jaFechado)
    if (pendentes.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há colaboradores pendentes de fechamento no filtro atual.',
      })
      setModalLoteAberto(false)
      return
    }

    setProcessandoLote(true)
    let sucessos = 0
    let falhas = 0

    for (const item of pendentes) {
      try {
        await bancoHorasService.fecharMesColaborador({
          tenantId: user.tenant_id,
          colaboradorId: item.colaboradorId,
          competencia: competenciaAtual,
          comentarioRh:
            comentarioLote || `Fechamento em lote por departamento (${departamentoFiltro})`,
          userId: user.id,
        })
        sucessos++
      } catch (e) {
        falhas++
      }
    }

    toast({
      title: 'Fechamento em lote concluído',
      description: `${sucessos} colaboradores fechados com sucesso.${falhas > 0 ? ` ${falhas} falharam ou já existiam.` : ''}`,
    })

    setModalLoteAberto(false)
    setComentarioLote('')
    setProcessandoLote(false)
    carregarDados()
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Lock className="h-6 w-6 text-[#0D47A1]" />
            Fechamento do Banco de Horas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Consolide e congele os saldos mensais apurados no espelho de ponto para os
            colaboradores. O fechamento é definitivo e não altera os registros de batidas de ponto.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading || calculando}
            className="gap-2 border-slate-300 text-slate-700 hover:text-[#0D47A1]"
          >
            <RefreshCw className={`h-4 w-4 ${loading || calculando ? 'animate-spin' : ''}`} />
            Recalcular
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setModalLoteAberto(true)}
            disabled={loading || totalPendentes === 0}
            className="bg-[#0D47A1] hover:bg-[#0B3D91] text-white gap-2 font-semibold shadow-xs"
          >
            <Lock className="h-4 w-4" />
            Fechar em Lote ({totalPendentes})
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Seleção de Competência */}
      <Card className="border border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Competência */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#0D47A1]" />
              <span className="text-xs font-bold text-slate-700">Competência:</span>
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger className="w-[130px] h-9 text-xs font-semibold bg-white border-slate-200">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => (
                    <SelectItem key={m.valor} value={m.valor} className="text-xs">
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                <SelectTrigger className="w-[90px] h-9 text-xs font-semibold bg-white border-slate-200">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {['2024', '2025', '2026', '2027'].map((ano) => (
                    <SelectItem key={ano} value={ano} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Departamento */}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              <Select value={departamentoFiltro} onValueChange={setDepartamentoFiltro}>
                <SelectTrigger className="w-[160px] h-9 text-xs bg-white border-slate-200">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos Departamentos
                  </SelectItem>
                  {departamentos.map((dep) => (
                    <SelectItem key={dep} value={dep} className="text-xs">
                      {dep}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Busca por Colaborador */}
          <div className="relative w-full md:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              placeholder="Buscar por colaborador..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 pl-9 text-xs border-slate-200"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quadro Informativo de Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase">Colaboradores</span>
            <Users className="h-4 w-4 text-[#0D47A1]" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{itensFiltrados.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Colaboradores ativos sob apuração</p>
        </Card>

        <Card className="border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase">Meses Fechados</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {itensFiltrados.filter((i) => i.jaFechado).length}
          </div>
          <p className="text-[11px] text-emerald-700/80 mt-0.5">
            Saldos congelados nesta competência
          </p>
        </Card>

        <Card className="border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase">
              Pendentes de Fechamento
            </span>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{totalPendentes}</div>
          <p className="text-[11px] text-amber-700/80 mt-0.5">
            Aguardando validação e fechamento pelo RH
          </p>
        </Card>
      </div>

      {/* Tabela de Colaboradores e Saldos */}
      <Card className="border border-slate-200 bg-white shadow-xs">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#0D47A1]" />
              <CardTitle className="text-base font-bold text-slate-900">
                Apuração de Banco de Horas —{' '}
                {bancoHorasService.formatarCompetenciaLabel(competenciaAtual)}
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Valores calculados com base no espelho de ponto oficial do mês. O fechamento congela
              os valores informados.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading || calculando ? (
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#0D47A1] mb-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Apurando espelhos de ponto da competência {competenciaAtual}...</span>
              </div>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              Nenhum colaborador encontrado com os filtros aplicados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Colaborador
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Departamento
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
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-center">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensFiltrados.map((item) => {
                  const saldoPositivo = item.saldoMs >= 0

                  return (
                    <TableRow
                      key={item.colaboradorId}
                      className={`text-xs border-b border-slate-100 transition-colors ${
                        item.jaFechado ? 'bg-slate-50/50' : 'hover:bg-blue-50/30'
                      }`}
                    >
                      <TableCell className="py-3 font-semibold text-slate-900">
                        <div>
                          <span>{item.colaboradorNome}</span>
                          {item.colaboradorCargo && (
                            <p className="text-[11px] font-normal text-slate-500">
                              {item.colaboradorCargo}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-slate-600">{item.departamento}</TableCell>
                      <TableCell className="py-3 font-mono text-slate-700 text-right">
                        {bancoHorasService.formatarHorasMs(item.horasTrabalhadasMs)}
                      </TableCell>
                      <TableCell className="py-3 font-mono text-slate-700 text-right">
                        {bancoHorasService.formatarHorasMs(item.horasEscaladasMs)}
                      </TableCell>
                      <TableCell
                        className={`py-3 font-mono font-bold text-right ${
                          saldoPositivo ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {bancoHorasService.formatarSaldoMs(item.saldoMs)}
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        {item.jaFechado ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold gap-1"
                          >
                            <Lock className="h-3 w-3" />
                            Fechado em{' '}
                            {item.fechamentoExistente
                              ? formatDataPtBr(item.fechamentoExistente.data_fechamento)
                              : ''}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-medium"
                          >
                            Aberto
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        {item.jaFechado ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-8 text-xs text-slate-400 gap-1 opacity-70"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Fechado
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setColaboradorParaFechar(item)
                              setComentarioFechamento('')
                            }}
                            className="h-8 text-xs border-[#0D47A1] text-[#0D47A1] hover:bg-[#E8EEF7] gap-1 font-semibold"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Fechar Mês
                          </Button>
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

      {/* Modal de Fechamento Individual */}
      <Dialog
        open={Boolean(colaboradorParaFechar)}
        onOpenChange={(open) => !open && setColaboradorParaFechar(null)}
      >
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#0D47A1]" />
              Confirmar Fechamento de Banco de Horas
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Você está prestes a congelar e homologar o saldo do colaborador para a competência
              selecionada.
            </DialogDescription>
          </DialogHeader>

          {colaboradorParaFechar && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Colaborador:</span>
                  <span className="font-bold text-slate-900">
                    {colaboradorParaFechar.colaboradorNome}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Competência:</span>
                  <span className="font-bold text-[#0D47A1]">
                    {bancoHorasService.formatarCompetenciaLabel(colaboradorParaFechar.competencia)}{' '}
                    ({colaboradorParaFechar.competencia})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Horas Trabalhadas:</span>
                  <span className="font-mono font-medium text-slate-800">
                    {bancoHorasService.formatarHorasMs(colaboradorParaFechar.horasTrabalhadasMs)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Horas Previstas:</span>
                  <span className="font-mono font-medium text-slate-800">
                    {bancoHorasService.formatarHorasMs(colaboradorParaFechar.horasEscaladasMs)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">Saldo a Consolidar:</span>
                  <span
                    className={`font-mono font-black text-sm ${colaboradorParaFechar.saldoMs >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                  >
                    {bancoHorasService.formatarSaldoMs(colaboradorParaFechar.saldoMs)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Comentário do RH (opcional):
                </label>
                <Textarea
                  placeholder="Ex: Mês fechado regularmente após conferência dos atestados e espelho..."
                  value={comentarioFechamento}
                  onChange={(e) => setComentarioFechamento(e.target.value)}
                  className="text-xs min-h-[70px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              disabled={salvandoFechamento}
              onClick={() => setColaboradorParaFechar(null)}
              className="text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={salvandoFechamento}
              onClick={handleConfirmarFechamentoIndividual}
              className="bg-[#0D47A1] hover:bg-[#0B3D91] text-white text-xs h-9 font-semibold gap-1.5"
            >
              {salvandoFechamento ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {salvandoFechamento ? 'Fechando...' : 'Confirmar Fechamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Fechamento em Lote */}
      <Dialog open={modalLoteAberto} onOpenChange={setModalLoteAberto}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#0D47A1]" />
              Fechamento em Lote — {bancoHorasService.formatarCompetenciaLabel(competenciaAtual)}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Consolidar de uma só vez todos os {totalPendentes} colaboradores pendentes no filtro
              atual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
              <p className="font-semibold">Atenção:</p>
              <p className="text-[11px] mt-1 text-amber-800">
                Esta ação gerará registros de fechamento para todos os{' '}
                <strong>{totalPendentes}</strong> colaboradores pendentes. Após o fechamento, as
                competências não poderão ser reabertas sem intervenção do Administrador.
              </p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Comentário padrão do RH para os fechamentos (opcional):
              </label>
              <Textarea
                placeholder="Ex: Fechamento mensal em lote homologado pela gerência de RH..."
                value={comentarioLote}
                onChange={(e) => setComentarioLote(e.target.value)}
                className="text-xs min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              disabled={processandoLote}
              onClick={() => setModalLoteAberto(false)}
              className="text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={processandoLote || totalPendentes === 0}
              onClick={handleConfirmarFechamentoLote}
              className="bg-[#0D47A1] hover:bg-[#0B3D91] text-white text-xs h-9 font-semibold gap-1.5"
            >
              {processandoLote ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {processandoLote ? 'Processando...' : `Fechar ${totalPendentes} Colaboradores`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default FechamentoBancoHorasPage
