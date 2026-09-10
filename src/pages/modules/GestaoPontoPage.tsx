import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Clock,
  Users,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Download,
  ShieldCheck,
  Building2,
  Eye,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { pontoService, escalaService, DiaEspelhoPonto } from '@/services/pontoService'
import { colaboradorService, atestadoService, feriasService } from '@/services/api'
import {
  Colaborador,
  RegistroPonto,
  EscalaTrabalho,
  ColaboradorEscala,
  Atestado,
  SolicitacaoFerias,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'

interface LinhaGestaoPonto {
  colaborador: Colaborador
  escala?: EscalaTrabalho
  status: 'presente' | 'ausente' | 'nao_registrado' | 'atestado' | 'folga'
  registrosHoje: RegistroPonto[]
  primeiraEntrada?: string
  ultimaSaida?: string
  totalHorasHojeMs: number
  totalHorasFormatadas: string
  irregularidades: string[]
}

export default function GestaoPontoPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const tenantId = user?.tenant_id

  // Data selecionada para acompanhamento (default: hoje)
  const [dataSelecionada, setDataSelecionada] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroDepartamento, setFiltroDepartamento] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Dados carregados
  const [loading, setLoading] = useState(true)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [registrosDia, setRegistrosDia] = useState<RegistroPonto[]>([])
  const [escalas, setEscalas] = useState<EscalaTrabalho[]>([])
  const [vinculos, setVinculos] = useState<ColaboradorEscala[]>([])
  const [atestados, setAtestados] = useState<Atestado[]>([])
  const [feriasAprovadasMes, setFeriasAprovadasMes] = useState<SolicitacaoFerias[]>([])

  // Modal de Espelho de Ponto Individual
  const [modalEspelhoOpen, setModalEspelhoOpen] = useState(false)
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<Colaborador | null>(null)
  const [mesEspelho, setMesEspelho] = useState(() => {
    const d = new Date()
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })
  const [registrosMesSelecionado, setRegistrosMesSelecionado] = useState<RegistroPonto[]>([])
  const [carregandoEspelho, setCarregandoEspelho] = useState(false)

  // Carregar dados gerais do tenant para o dia
  const carregarDados = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const [colabs, regs, escList, vincList, atests, feriasList] = await Promise.all([
        colaboradorService.getColaboradores(tenantId),
        pontoService.getRegistrosDiaTenant(tenantId, dataSelecionada),
        escalaService.getEscalas(tenantId),
        escalaService.getVinculosColaboradorEscala(tenantId),
        atestadoService.getAtestadosTenant(tenantId),
        feriasService.listarSolicitacoes({
          tenantId,
          status: 'aprovada',
        }),
      ])

      setColaboradores(colabs)
      setRegistrosDia(regs)
      setEscalas(escList)
      setVinculos(vincList)
      setAtestados(atests)
      setFeriasAprovadasMes(feriasList)
    } catch (err) {
      console.error('Erro ao carregar gestão de ponto:', err)
      toast({
        title: 'Erro ao carregar gestão de ponto',
        description: 'Não foi possível buscar os registros dos colaboradores.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, dataSelecionada, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Lista de departamentos para o filtro
  const departamentos = useMemo(() => {
    const set = new Set<string>()
    colaboradores.forEach((c) => {
      if (c.departamento) set.add(c.departamento)
    })
    return Array.from(set).sort()
  }, [colaboradores])

  // Mapeamento e consolidação das linhas do dia
  const linhasConsolidadas = useMemo<LinhaGestaoPonto[]>(() => {
    const dataObj = new Date(`${dataSelecionada}T12:00:00Z`)
    const diasSemanaMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
    const diaSemanaTag = diasSemanaMap[dataObj.getUTCDay()]

    const hojeStr = new Date().toISOString().slice(0, 10)
    const isHoje = dataSelecionada === hojeStr

    return colaboradores
      .filter((c) => c.status === 'ativo')
      .map((colab) => {
        // Encontra vínculo de escala ativo
        const vinc = vinculos.find((v) => v.colaborador_id === colab.id)
        const escala = vinc?.expand?.escala_id || escalas.find((e) => e.id === vinc?.escala_id)

        // Registros deste colaborador neste dia
        const regs = registrosDia
          .filter((r) => r.colaborador_id === colab.id)
          .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())

        let primeiraEntrada: string | undefined
        let ultimaSaida: string | undefined

        regs.forEach((r) => {
          const d = new Date(r.data_hora)
          const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          if (r.tipo === 'entrada' && !primeiraEntrada) primeiraEntrada = hhmm
          if (r.tipo === 'saida') ultimaSaida = hhmm
        })

        const totalHorasHojeMs = pontoService.calcularHorasDia(regs)
        const totalHorasFormatadas = pontoService.formatarHorasMinutos(totalHorasHojeMs)

        // Verificar atestados validados
        // Verificar férias aprovadas cobrindo a data
        const diaIsoStr = dataSelecionada
        const feriasValida = feriasAprovadasMes.find((f) => {
          if (f.colaborador_id !== colab.id || f.status !== 'aprovada') return false
          const fIni = f.data_inicio.slice(0, 10)
          const fFim = f.data_fim.slice(0, 10)
          return diaIsoStr >= fIni && diaIsoStr <= fFim
        })

        const atestadoValido = atestados.find((at) => {
          if (at.colaborador_id !== colab.id || at.status !== 'validado') return false
          const dIni = new Date(at.data_inicio).getTime()
          const dFim = dIni + (at.qtd_dias || 1) * 24 * 60 * 60 * 1000
          const currTime = dataObj.getTime()
          return currTime >= dIni && currTime < dFim
        })

        // Escala e dia de trabalho
        const diasEscalados = escala?.dias_semana
          ? escala.dias_semana.toLowerCase().split(',')
          : ['seg', 'ter', 'qua', 'qui', 'sex']
        const isDiaEscalado = diasEscalados.includes(diaSemanaTag)

        let status: 'presente' | 'ausente' | 'nao_registrado' | 'atestado' | 'folga' | 'ferias' =
          'nao_registrado'
        const irregularidades: string[] = []

        if (feriasValida) {
          status = 'ferias'
        } else if (atestadoValido) {
          status = 'atestado'
        } else if (!isDiaEscalado) {
          status = 'folga'
        } else if (regs.length > 0) {
          status = 'presente'
          // Checar atraso
          if (escala?.horario_inicio && primeiraEntrada) {
            const [hExp, mExp] = escala.horario_inicio.split(':').map(Number)
            const [hReal, mReal] = primeiraEntrada.split(':').map(Number)
            const diffMin = hReal * 60 + mReal - (hExp * 60 + mExp)
            if (diffMin > 10) {
              irregularidades.push(`Atraso (+${diffMin} min)`)
            }
          }
          // Checar se bateu saída
          if (!isHoje && !ultimaSaida && regs.length % 2 !== 0) {
            irregularidades.push('Sem registro de saída')
          }
        } else {
          // Sem batida
          if (isHoje) {
            status = 'nao_registrado'
          } else {
            status = 'ausente'
            irregularidades.push('Falta não justificada')
          }
        }

        return {
          colaborador: colab,
          escala,
          status,
          registrosHoje: regs,
          primeiraEntrada,
          ultimaSaida,
          totalHorasHojeMs,
          totalHorasFormatadas,
          irregularidades,
        }
      })
  }, [colaboradores, vinculos, escalas, registrosDia, dataSelecionada, atestados])

  // Filtragem da tabela
  const linhasFiltradas = useMemo(() => {
    return linhasConsolidadas.filter((item) => {
      const matchBusca =
        item.colaborador.nome.toLowerCase().includes(busca.toLowerCase()) ||
        item.colaborador.cargo?.toLowerCase().includes(busca.toLowerCase()) ||
        item.colaborador.cpf.includes(busca)

      const matchDepto =
        filtroDepartamento === 'todos' || item.colaborador.departamento === filtroDepartamento

      const matchStatus = filtroStatus === 'todos' || item.status === filtroStatus

      return matchBusca && matchDepto && matchStatus
    })
  }, [linhasConsolidadas, busca, filtroDepartamento, filtroStatus])

  // KPIs superiores
  const kpis = useMemo(() => {
    const total = linhasConsolidadas.length
    const presentes = linhasConsolidadas.filter((l) => l.status === 'presente').length
    const ausentes = linhasConsolidadas.filter((l) => l.status === 'ausente').length
    const naoRegistrados = linhasConsolidadas.filter((l) => l.status === 'nao_registrado').length
    const atestadosCont = linhasConsolidadas.filter((l) => l.status === 'atestado').length
    const totalIrregularidades = linhasConsolidadas.reduce(
      (acc, l) => acc + l.irregularidades.length,
      0,
    )

    return { total, presentes, ausentes, naoRegistrados, atestadosCont, totalIrregularidades }
  }, [linhasConsolidadas])

  // Abrir espelho mensal de um colaborador
  const handleAbrirEspelho = async (colab: Colaborador) => {
    setColaboradorSelecionado(colab)
    setModalEspelhoOpen(true)
    if (!tenantId) return

    try {
      setCarregandoEspelho(true)
      const regs = await pontoService.getRegistrosMes(
        tenantId,
        colab.id,
        mesEspelho.ano,
        mesEspelho.mes,
      )
      setRegistrosMesSelecionado(regs)
    } catch (err) {
      console.error('Erro ao buscar espelho do colaborador:', err)
    } finally {
      setCarregandoEspelho(false)
    }
  }

  // Mudar mês no modal de espelho
  const handleMudarMesEspelho = async (direcao: number) => {
    const novaData = new Date(mesEspelho.ano, mesEspelho.mes + direcao, 1)
    const novoAno = novaData.getFullYear()
    const novoMes = novaData.getMonth()
    setMesEspelho({ ano: novoAno, mes: novoMes })

    if (tenantId && colaboradorSelecionado) {
      try {
        setCarregandoEspelho(true)
        const regs = await pontoService.getRegistrosMes(
          tenantId,
          colaboradorSelecionado.id,
          novoAno,
          novoMes,
        )
        setRegistrosMesSelecionado(regs)
      } finally {
        setCarregandoEspelho(false)
      }
    }
  }

  // Escala do colaborador aberto no modal
  const escalaColaboradorSelecionado = useMemo(() => {
    if (!colaboradorSelecionado) return undefined
    const vinc = vinculos.find((v) => v.colaborador_id === colaboradorSelecionado.id)
    return vinc?.expand?.escala_id || escalas.find((e) => e.id === vinc?.escala_id)
  }, [colaboradorSelecionado, vinculos, escalas])

  // Espelho montado para o modal
  const espelhoModalCalculado = useMemo<DiaEspelhoPonto[]>(() => {
    if (!colaboradorSelecionado) return []
    return pontoService.construirEspelhoMensal(
      mesEspelho.ano,
      mesEspelho.mes,
      registrosMesSelecionado,
      escalaColaboradorSelecionado,
      atestados,
      colaboradorSelecionado,
      feriasAprovadasMes.filter((f) => f.colaborador_id === colaboradorSelecionado.id),
    )
  }, [
    mesEspelho,
    registrosMesSelecionado,
    escalaColaboradorSelecionado,
    atestados,
    colaboradorSelecionado,
    feriasAprovadasMes,
  ])

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Gestão de Ponto dos Colaboradores
              </h1>
              <p className="text-xs text-[#757575] mt-0.5">
                Visão operacional do RH: acompanhamento diário em tempo real, inconsistências e
                espelhos individuais.
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de Data e Botão Atualizar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-[#E0E0E0] rounded-lg px-2.5 py-1">
            <Calendar className="h-4 w-4 text-[#0D47A1]" />
            <Input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="h-7 border-0 p-0 text-xs w-32 focus-visible:ring-0 focus-visible:outline-none"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="h-9 text-xs border-[#E0E0E0] gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* 2. Cards de Indicadores do Dia */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-[#E0E0E0] bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#757575]">
            Total Colaboradores
          </span>
          <div className="text-2xl font-extrabold text-[#212121] mt-1">{kpis.total}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Ativos na organização</p>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-3.5 shadow-2xs border-l-4 border-l-[#2E7D32]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#2E7D32]">
            Presentes
          </span>
          <div className="text-2xl font-extrabold text-[#2E7D32] mt-1">{kpis.presentes}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Batida registrada hoje</p>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-3.5 shadow-2xs border-l-4 border-l-[#E65100]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#E65100]">
            Não Registrados
          </span>
          <div className="text-2xl font-extrabold text-[#E65100] mt-1">{kpis.naoRegistrados}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Aguardando entrada</p>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-3.5 shadow-2xs border-l-4 border-l-[#C62828]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#C62828]">
            Ausentes / Faltas
          </span>
          <div className="text-2xl font-extrabold text-[#C62828] mt-1">{kpis.ausentes}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Sem justificativa</p>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-3.5 shadow-2xs border-l-4 border-l-[#0D47A1]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D47A1]">
            Irregularidades
          </span>
          <div className="text-2xl font-extrabold text-[#0D47A1] mt-1">
            {kpis.totalIrregularidades}
          </div>
          <p className="text-[11px] text-[#757575] mt-0.5">Atrasos e pendências</p>
        </div>
      </div>

      {/* 3. Tabela de Gestão de Colaboradores */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs">
        <CardHeader className="pb-3 border-b border-[#F0F0F0]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-[#212121]">
                Status Diário dos Colaboradores
              </CardTitle>
              <CardDescription className="text-xs text-[#757575]">
                Acompanhamento por colaborador, horários de batida e ocorrências da jornada
              </CardDescription>
            </div>

            {/* Barra de Filtros */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-56">
                <Search className="h-3.5 w-3.5 text-[#9E9E9E] absolute left-2.5 top-2.5" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar colaborador ou cargo..."
                  className="pl-8 text-xs h-8 border-[#E0E0E0]"
                />
              </div>

              {/* Filtro Departamento */}
              <Select value={filtroDepartamento} onValueChange={setFiltroDepartamento}>
                <SelectTrigger className="w-40 h-8 text-xs border-[#E0E0E0] bg-white">
                  <SelectValue placeholder="Departamento..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="todos" className="text-xs">
                    Todos os deptos
                  </SelectItem>
                  {departamentos.map((d) => (
                    <SelectItem key={d} value={d} className="text-xs">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro Status */}
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-36 h-8 text-xs border-[#E0E0E0] bg-white">
                  <SelectValue placeholder="Status..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="todos" className="text-xs">
                    Todos os status
                  </SelectItem>
                  <SelectItem value="presente" className="text-xs">
                    Presente
                  </SelectItem>
                  <SelectItem value="nao_registrado" className="text-xs">
                    Não Registrado
                  </SelectItem>
                  <SelectItem value="ausente" className="text-xs">
                    Ausente (Falta)
                  </SelectItem>
                  <SelectItem value="atestado" className="text-xs">
                    Atestado
                  </SelectItem>
                  <SelectItem value="folga" className="text-xs">
                    Folga
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-slate-100" />
              ))}
            </div>
          ) : linhasFiltradas.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#757575]">
              Nenhum colaborador encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA] text-[#757575] font-semibold uppercase text-[10px]">
                    <th className="py-3 pl-4">Colaborador</th>
                    <th className="py-3">Depto / Cargo</th>
                    <th className="py-3">Escala</th>
                    <th className="py-3 text-center">Status</th>
                    <th className="py-3 text-center">1ª Entrada</th>
                    <th className="py-3 text-center">Última Saída</th>
                    <th className="py-3 text-center">Total Horas</th>
                    <th className="py-3">Ocorrências</th>
                    <th className="py-3 pr-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5]">
                  {linhasFiltradas.map((item) => {
                    const c = item.colaborador
                    const esc = item.escala

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                        onClick={() => handleAbrirEspelho(c)}
                      >
                        <td className="py-3 pl-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 border border-[#E0E0E0]">
                              <AvatarImage src={c.foto_url} alt={c.nome} />
                              <AvatarFallback className="bg-[#E8EEF7] text-[#0D47A1] font-bold text-xs">
                                {c.nome.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-bold text-[#212121] text-xs leading-tight">
                                {c.nome}
                              </p>
                              <p className="text-[10px] text-[#757575]">CPF: {c.cpf}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3">
                          <p className="font-semibold text-[#212121]">{c.cargo || '—'}</p>
                          <p className="text-[11px] text-[#757575]">{c.departamento || 'Geral'}</p>
                        </td>

                        <td className="py-3">
                          {esc ? (
                            <div>
                              <p className="font-medium text-[#212121] text-[11px]">{esc.nome}</p>
                              <p className="text-[10px] text-[#757575]">
                                {esc.horario_inicio}–{esc.horario_fim}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#9E9E9E]">—</span>
                          )}
                        </td>

                        <td className="py-3 text-center">
                          {item.status === 'presente' && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-semibold"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Presente
                            </Badge>
                          )}
                          {item.status === 'nao_registrado' && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] font-semibold"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              Não Registrado
                            </Badge>
                          )}
                          {item.status === 'ausente' && (
                            <Badge
                              variant="outline"
                              className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] font-semibold"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Ausente
                            </Badge>
                          )}
                          {item.status === 'ferias' && (
                            <Badge
                              variant="outline"
                              className="bg-purple-50 text-purple-700 border-purple-300 text-[10px] font-semibold"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Férias
                            </Badge>
                          )}
                          {item.status === 'atestado' && (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-300 text-[10px] font-semibold"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Atestado
                            </Badge>
                          )}
                          {item.status === 'folga' && (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-600 border-slate-300 text-[10px]"
                            >
                              Folga
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 text-center font-mono font-medium text-[#212121]">
                          {item.primeiraEntrada || '—'}
                        </td>

                        <td className="py-3 text-center font-mono font-medium text-[#212121]">
                          {item.ultimaSaida || '—'}
                        </td>

                        <td className="py-3 text-center font-mono font-semibold text-[#0D47A1]">
                          {item.totalHorasHojeMs > 0 ? item.totalHorasFormatadas : '—'}
                        </td>

                        <td className="py-3">
                          {item.irregularidades.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {item.irregularidades.map((irr, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-[9px] bg-rose-50 text-rose-700 border-rose-300"
                                >
                                  {irr}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#757575]">Regular</span>
                          )}
                        </td>

                        <td className="py-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAbrirEspelho(c)}
                            className="h-8 text-xs border-[#0D47A1]/30 text-[#0D47A1] hover:bg-[#E8EEF7] gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Espelho Mensal
                          </Button>
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

      {/* 4. Modal com o Espelho de Ponto Mensal Completo do Colaborador */}
      <Dialog open={modalEspelhoOpen} onOpenChange={setModalEspelhoOpen}>
        <DialogContent className="max-w-4xl bg-white border border-[#E0E0E0] p-6 max-h-[90vh] flex flex-col">
          <DialogHeader className="text-left space-y-1 pb-3 border-b border-[#E0E0E0]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-9 w-9 border border-[#E0E0E0]">
                  <AvatarImage
                    src={colaboradorSelecionado?.foto_url}
                    alt={colaboradorSelecionado?.nome}
                  />
                  <AvatarFallback className="bg-[#E8EEF7] text-[#0D47A1] font-bold text-xs">
                    {colaboradorSelecionado?.nome?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-base font-bold text-[#212121]">
                    Espelho de Ponto — {colaboradorSelecionado?.nome}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#757575]">
                    {colaboradorSelecionado?.cargo || 'Colaborador'} •{' '}
                    {colaboradorSelecionado?.departamento || 'Departamento Geral'} • Escala:{' '}
                    {escalaColaboradorSelecionado?.nome || 'Padrão CLT'}
                  </DialogDescription>
                </div>
              </div>

              {/* Controles de mês */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleMudarMesEspelho(-1)}
                  className="h-7 w-7 border-[#E0E0E0]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-bold text-[#212121] capitalize min-w-[120px] text-center">
                  {new Date(mesEspelho.ano, mesEspelho.mes, 1).toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleMudarMesEspelho(1)}
                  className="h-7 w-7 border-[#E0E0E0]"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {carregandoEspelho ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-4">
              <div className="overflow-x-auto rounded-lg border border-[#E0E0E0]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA] text-[#757575] font-semibold uppercase text-[10px]">
                      <th className="py-2.5 pl-3">Data</th>
                      <th className="py-2.5">Dia</th>
                      <th className="py-2.5 text-center">Entrada</th>
                      <th className="py-2.5 text-center">Saída Almoço</th>
                      <th className="py-2.5 text-center">Volta Almoço</th>
                      <th className="py-2.5 text-center">Saída</th>
                      <th className="py-2.5 text-center">Total Horas</th>
                      <th className="py-2.5 text-center">Saldo</th>
                      <th className="py-2.5 pr-3 text-right">Ocorrência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F5]">
                    {espelhoModalCalculado.map((dia) => {
                      const isFolga = dia.ausenciaTipo === 'folga'
                      const isAtestado = dia.ausenciaTipo === 'atestado'

                      return (
                        <tr
                          key={dia.dataIso}
                          className={`hover:bg-[#FAFAFA] transition-colors ${
                            dia.isHoje
                              ? 'bg-blue-50/40 font-semibold'
                              : dia.isFimDeSemana
                                ? 'bg-[#FAFAFA]/60 text-[#757575]'
                                : ''
                          }`}
                        >
                          <td className="py-2 pl-3 font-mono font-medium text-[#212121]">
                            {String(dia.diaNumero).padStart(2, '0')}/
                            {String(mesEspelho.mes + 1).padStart(2, '0')}
                          </td>

                          <td className="py-2 font-medium text-[#616161]">{dia.diaSemanaLabel}</td>

                          {isAtestado ? (
                            <td colSpan={4} className="py-2 text-center">
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-bold"
                              >
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Atestado Médico Validado
                              </Badge>
                            </td>
                          ) : dia.ausenciaTipo === 'ferias' ? (
                            <td colSpan={4} className="py-2 text-center">
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-800 border-purple-300 text-[10px] font-bold"
                              >
                                <Sparkles className="h-3 w-3 mr-1" />
                                Férias Aprovadas
                              </Badge>
                            </td>
                          ) : isFolga ? (
                            <td colSpan={4} className="py-2 text-center text-[11px] text-[#9E9E9E]">
                              Folga semanal
                            </td>
                          ) : (
                            <>
                              <td className="py-2 text-center font-mono text-[#212121]">
                                {dia.entrada || '—'}
                              </td>
                              <td className="py-2 text-center font-mono text-[#212121]">
                                {dia.saidaAlmoco || '—'}
                              </td>
                              <td className="py-2 text-center font-mono text-[#212121]">
                                {dia.voltaAlmoco || '—'}
                              </td>
                              <td className="py-2 text-center font-mono text-[#212121]">
                                {dia.saida || '—'}
                              </td>
                            </>
                          )}

                          <td className="py-2 text-center font-semibold font-mono text-[#0D47A1]">
                            {dia.totalHorasMs > 0 ? dia.totalHorasFormatadas : '—'}
                          </td>

                          <td className="py-2 text-center font-mono text-[11px]">
                            {dia.isDiaEscalado && !dia.isFuturo && !dia.ausenciaTipo ? (
                              <span
                                className={
                                  dia.saldoMs > 0
                                    ? 'text-emerald-700 font-bold'
                                    : dia.saldoMs < 0
                                      ? 'text-rose-700 font-bold'
                                      : 'text-[#757575]'
                                }
                              >
                                {dia.saldoFormatado}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="py-2 pr-3 text-right">
                            {dia.irregularidades.length > 0 ? (
                              <div className="flex items-center justify-end gap-1 flex-wrap">
                                {dia.irregularidades.map((irr, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-[9px] bg-rose-50 text-rose-700 border-rose-300"
                                  >
                                    {irr}
                                  </Badge>
                                ))}
                              </div>
                            ) : dia.ausenciaDetalhe ? (
                              <span className="text-[10px] text-[#757575]">
                                {dia.ausenciaDetalhe}
                              </span>
                            ) : dia.totalHorasMs > 0 ? (
                              <span className="text-[10px] text-emerald-700 font-medium">
                                Regular
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#9E9E9E]">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
