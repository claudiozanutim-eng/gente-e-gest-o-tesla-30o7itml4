import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CalendarDays,
  Palmtree,
  Users,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  RefreshCw,
  Info,
  Building,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  Colaborador,
  SolicitacaoFerias,
  ColaboradorEscala,
  DepartamentoEscala,
  EscalaTrabalho,
} from '@/types'
import pb from '@/lib/pocketbase/client'
import { pontoService, escalaService } from '@/services/pontoService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'

interface ColaboradorEscalaInfo {
  colaborador: Colaborador
  escala?: EscalaTrabalho
  origemEscala: 'individual' | 'departamento' | 'padrao'
  dataInicioVinculo?: string
}

export const FeriasColetivoPage: React.FC = () => {
  const { user } = useAuth()
  const tenantId = user?.tenant_id || ''

  // Navegação de mês/ano
  const hoje = useMemo(() => new Date(), [])
  const [dataVisualizacao, setDataVisualizacao] = useState<Date>(
    new Date(hoje.getFullYear(), hoje.getMonth(), 1),
  )

  const anoAtual = dataVisualizacao.getFullYear()
  const mesAtualZeroIndexed = dataVisualizacao.getMonth()

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [feriasAprovadas, setFeriasAprovadas] = useState<SolicitacaoFerias[]>([])
  const [escalasInfo, setEscalasInfo] = useState<Map<string, ColaboradorEscalaInfo>>(new Map())
  const [departamentoFiltro, setDepartamentoFiltro] = useState<string>('todos')

  // Lista de departamentos disponíveis
  const departamentosDisponiveis = useMemo(() => {
    const deps = new Set<string>()
    colaboradores.forEach((c) => {
      if (c.departamento) deps.add(c.departamento)
    })
    return Array.from(deps).sort()
  }, [colaboradores])

  // Carregar dados
  const carregarDados = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    try {
      // 1. Colaboradores ativos
      const colabs = await pb.collection('colaborador').getFullList<Colaborador>({
        filter: `tenant_id = "${tenantId}" && status = "ativo"`,
        sort: 'departamento,nome',
      })
      setColaboradores(colabs)

      // 2. Férias aprovadas no mês corrente
      const primeiroDiaIso = `${anoAtual}-${String(mesAtualZeroIndexed + 1).padStart(2, '0')}-01`
      const ultimoDiaDoMes = new Date(anoAtual, mesAtualZeroIndexed + 1, 0).getDate()
      const ultimoDiaIso = `${anoAtual}-${String(mesAtualZeroIndexed + 1).padStart(2, '0')}-${String(
        ultimoDiaDoMes,
      ).padStart(2, '0')}`

      const ferias = await pb.collection('solicitacao_ferias').getFullList<SolicitacaoFerias>({
        filter: `tenant_id = "${tenantId}" && status = "aprovada" && data_inicio <= "${ultimoDiaIso}" && data_fim >= "${primeiroDiaIso}"`,
        sort: 'data_inicio',
      })
      setFeriasAprovadas(ferias)

      // 3. Carregar escalas: vínculos individuais + escalas de departamentos
      const [vinculosIndividuais, escalasDeptos] = await Promise.all([
        pb.collection('colaborador_escala').getFullList<ColaboradorEscala>({
          filter: `tenant_id = "${tenantId}"`,
          sort: '-data_inicio',
          expand: 'escala_id',
        }),
        escalaService.getEscalasDepartamento(tenantId),
      ])

      // Mapa de escalas por departamento
      const mapaDeptos = new Map<string, DepartamentoEscala>()
      for (const ed of escalasDeptos) {
        if (!mapaDeptos.has(ed.departamento)) {
          mapaDeptos.set(ed.departamento, ed)
        }
      }

      // Mapa de escalas individuais mais recentes por colaborador
      const mapaIndividuais = new Map<string, ColaboradorEscala>()
      for (const vi of vinculosIndividuais) {
        if (!mapaIndividuais.has(vi.colaborador_id)) {
          mapaIndividuais.set(vi.colaborador_id, vi)
        }
      }

      // Construir mapa final por colaborador (precedência: individual > depto > padrão)
      const novoMapaEscalas = new Map<string, ColaboradorEscalaInfo>()
      colabs.forEach((c) => {
        const ind = mapaIndividuais.get(c.id)
        if (ind && ind.expand?.escala_id) {
          novoMapaEscalas.set(c.id, {
            colaborador: c,
            escala: ind.expand.escala_id,
            origemEscala: 'individual',
            dataInicioVinculo: ind.data_inicio,
          })
          return
        }

        if (c.departamento) {
          const depEscala = mapaDeptos.get(c.departamento)
          if (depEscala && depEscala.expand?.escala_id) {
            novoMapaEscalas.set(c.id, {
              colaborador: c,
              escala: depEscala.expand.escala_id,
              origemEscala: 'departamento',
              dataInicioVinculo: depEscala.data_inicio,
            })
            return
          }
        }

        novoMapaEscalas.set(c.id, {
          colaborador: c,
          escala: undefined,
          origemEscala: 'padrao',
          dataInicioVinculo: undefined,
        })
      })

      setEscalasInfo(novoMapaEscalas)
    } catch (err) {
      console.error('Erro ao carregar espelho coletivo de férias:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar a grade de férias e escalas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, anoAtual, mesAtualZeroIndexed])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Controles de navegação de data
  const irMesAnterior = () => {
    setDataVisualizacao(new Date(anoAtual, mesAtualZeroIndexed - 1, 1))
  }

  const irMesSeguinte = () => {
    setDataVisualizacao(new Date(anoAtual, mesAtualZeroIndexed + 1, 1))
  }

  const irParaHoje = () => {
    setDataVisualizacao(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  }

  const totalDiasMes = new Date(anoAtual, mesAtualZeroIndexed + 1, 0).getDate()
  const nomeMesAno = dataVisualizacao.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  const nomeMesAnoCapitalizado = nomeMesAno.charAt(0).toUpperCase() + nomeMesAno.slice(1)

  // Array de dias do mês: 1..N
  const diasDoMes = useMemo(() => {
    const list: {
      dia: number
      diaSemanaIndex: number
      diaSemanaLabel: string
      diaIso: string
      isFimDeSemana: boolean
      isHoje: boolean
    }[] = []

    const diasSemanaShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const hojeStr = hoje.toISOString().slice(0, 10)

    for (let d = 1; d <= totalDiasMes; d++) {
      const dataObj = new Date(anoAtual, mesAtualZeroIndexed, d)
      const diaSemanaIndex = dataObj.getDay()
      const diaIso = `${anoAtual}-${String(mesAtualZeroIndexed + 1).padStart(2, '0')}-${String(
        d,
      ).padStart(2, '0')}`
      list.push({
        dia: d,
        diaSemanaIndex,
        diaSemanaLabel: diasSemanaShort[diaSemanaIndex],
        diaIso,
        isFimDeSemana: diaSemanaIndex === 0 || diaSemanaIndex === 6,
        isHoje: diaIso === hojeStr,
      })
    }
    return list
  }, [anoAtual, mesAtualZeroIndexed, totalDiasMes, hoje])

  // Colaboradores filtrados por departamento
  const colaboradoresFiltrados = useMemo(() => {
    if (departamentoFiltro === 'todos') {
      return colaboradores
    }
    return colaboradores.filter((c) => c.departamento === departamentoFiltro)
  }, [colaboradores, departamentoFiltro])

  // Agrupamento de colaboradores por departamento
  const colaboradoresPorDepartamento = useMemo(() => {
    const map = new Map<string, Colaborador[]>()
    colaboradoresFiltrados.forEach((c) => {
      const dep = c.departamento || 'Sem Departamento'
      const list = map.get(dep) || []
      list.push(c)
      map.set(dep, list)
    })
    return map
  }, [colaboradoresFiltrados])

  // Helper para verificar status de um colaborador num dia específico
  // Retorna se está em férias, em folga de escala (12x36/revezamento/semanal) ou dia útil de trabalho
  const avaliarDiaColaborador = useCallback(
    (colaboradorId: string, diaIso: string) => {
      // 1. Férias aprovadas
      const emFerias = feriasAprovadas.some((f) => {
        if (f.colaborador_id !== colaboradorId) return false
        const ini = f.data_inicio.slice(0, 10)
        const fim = f.data_fim.slice(0, 10)
        return diaIso >= ini && diaIso <= fim
      })

      if (emFerias) {
        return {
          tipo: 'ferias' as const,
          disponivel: false,
          label: 'Férias',
        }
      }

      // 2. Escala e folga
      const escInfo = escalasInfo.get(colaboradorId)
      const avaliacao = pontoService.isDiaDeTrabalho(
        diaIso,
        escInfo?.escala,
        escInfo?.dataInicioVinculo,
      )

      if (!avaliacao.trabalho) {
        // Folga de escala
        if (avaliacao.folgaEspecial === '12x36') {
          return {
            tipo: 'folga_12x36' as const,
            disponivel: false,
            badgeCurto: '12x36',
            label: 'Folga 12x36',
          }
        }
        if (avaliacao.folgaEspecial === 'revezamento') {
          return {
            tipo: 'folga_revezamento' as const,
            disponivel: false,
            badgeCurto: 'Rev.',
            label: 'Folga Revezamento',
          }
        }
        return {
          tipo: 'folga_semanal' as const,
          disponivel: false,
          badgeCurto: 'DSR',
          label: avaliacao.motivoFolga || 'Folga Semanal',
        }
      }

      // 3. Dia útil de trabalho disponível
      return {
        tipo: 'trabalho' as const,
        disponivel: true,
        label: 'Disponível',
      }
    },
    [feriasAprovadas, escalasInfo],
  )

  // Cálculo consolidado de cobertura por departamento para cada dia do mês
  // Cruzamento: disponível de fato = NÃO está de férias E dia de trabalho segundo a escala
  const coberturaPorDepartamento = useMemo(() => {
    const resultado = new Map<
      string,
      {
        totalEquipe: number
        dias: {
          diaIso: string
          diaNumero: number
          totalEquipe: number
          disponiveis: number
          percentualDisponivel: number
          isCritico: boolean // <= 20% ou zero
          isZero: boolean
        }[]
        diasCriticosCount: number
      }
    >()

    colaboradoresPorDepartamento.forEach((membros, depto) => {
      const totalEquipe = membros.length
      const diasDet = diasDoMes.map((d) => {
        let disponiveis = 0
        membros.forEach((m) => {
          const status = avaliarDiaColaborador(m.id, d.diaIso)
          if (status.disponivel) {
            disponiveis++
          }
        })

        const percentualDisponivel = totalEquipe > 0 ? (disponiveis / totalEquipe) * 100 : 0
        const isCritico = totalEquipe > 0 && percentualDisponivel <= 20
        const isZero = disponiveis === 0

        return {
          diaIso: d.diaIso,
          diaNumero: d.dia,
          totalEquipe,
          disponiveis,
          percentualDisponivel,
          isCritico,
          isZero,
        }
      })

      const diasCriticosCount = diasDet.filter((d) => d.isCritico).length

      resultado.set(depto, {
        totalEquipe,
        dias: diasDet,
        diasCriticosCount,
      })
    })

    return resultado
  }, [colaboradoresPorDepartamento, diasDoMes, avaliarDiaColaborador])

  return (
    <div className="space-y-6 max-w-[100rem] mx-auto p-4 sm:p-6 lg:p-8">
      {/* Cabeçalho da Tela */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100/70 text-[#0D47A1] rounded-xl shadow-xs">
            <Palmtree className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Espelho de Férias Coletivo por Departamento
              </h1>
              <Badge
                variant="outline"
                className="border-blue-300 text-[#0D47A1] bg-blue-50 font-bold"
              >
                Gestão de Cobertura
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Grade mensal com cruzamento de férias aprovadas e escalas vigentes (12x36, revezamento
              e semanal) para revelar a cobertura real da equipe.
            </p>
          </div>
        </div>

        {/* Controles de Mês e Filtro de Departamento */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Departamento */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-600 font-medium">Setor:</span>
            <Select value={departamentoFiltro} onValueChange={setDepartamentoFiltro}>
              <SelectTrigger className="h-7 border-none bg-transparent shadow-none text-xs font-bold text-slate-800 p-0 focus:ring-0 w-36">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {departamentosDisponiveis.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Navegador de Mês */}
          <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={irMesAnterior}
              className="h-8 w-8 text-slate-600 hover:text-slate-900"
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 min-w-[140px] text-center font-bold text-xs sm:text-sm text-slate-800 capitalize">
              {nomeMesAno}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={irMesSeguinte}
              className="h-8 w-8 text-slate-600 hover:text-slate-900"
              title="Mês seguinte"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Atalho Hoje */}
          <Button
            variant="outline"
            size="sm"
            onClick={irParaHoje}
            className="h-9 text-xs border-slate-300 text-slate-700 hover:text-[#0D47A1] font-medium"
          >
            Hoje
          </Button>

          {/* Botão Atualizar */}
          <Button
            variant="ghost"
            size="icon"
            onClick={carregarDados}
            disabled={loading}
            className="h-9 w-9 text-slate-600 hover:text-[#0D47A1]"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Legenda Corporativa */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold text-slate-700">Legenda da Grade:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-emerald-500 border border-emerald-600" />
            <span className="text-slate-600">Férias Aprovadas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-slate-200 border border-slate-300 flex items-center justify-center text-[9px] font-bold text-slate-700">
              12x36
            </div>
            <span className="text-slate-600">Folga de Escala Especial (12x36 / Revezamento)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200" />
            <span className="text-slate-600">Folga Semanal / DSR</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-white border border-slate-300" />
            <span className="text-slate-600">Dia Útil de Trabalho (Disponível)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-700">Alerta de Cobertura:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-rose-500 border border-rose-600" />
            <span className="text-rose-700 font-semibold">Crítico (≤ 20% da equipe ou zero)</span>
          </div>
        </div>
      </div>

      {/* Resumos Textuais de Cobertura por Departamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from(coberturaPorDepartamento.entries()).map(([depto, cob]) => {
          const temCriticos = cob.diasCriticosCount > 0

          return (
            <Card
              key={depto}
              className={`border transition-all ${
                temCriticos
                  ? 'border-rose-300 bg-rose-50/50 shadow-xs'
                  : 'border-slate-200 bg-white shadow-xs'
              }`}
            >
              <CardContent className="p-3.5 flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    temCriticos ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {temCriticos ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-bold text-slate-900 text-xs truncate">{depto}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        temCriticos
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {cob.totalEquipe} colaboradores
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-snug">
                    {temCriticos ? (
                      <span>
                        Em <strong>{nomeMesAnoCapitalizado}</strong>, o setor {depto} tem{' '}
                        <strong className="text-rose-700 font-black">
                          {cob.diasCriticosCount} dia(s) com cobertura crítica
                        </strong>{' '}
                        (folgas + férias reduzem a equipe para ≤ 20%).
                      </span>
                    ) : (
                      <span>
                        Em <strong>{nomeMesAnoCapitalizado}</strong>, o setor {depto} mantém
                        cobertura adequada em todos os dias do mês.
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Grade Mensal Consolidada por Departamento */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : colaboradoresFiltrados.length === 0 ? (
        <Card className="border border-slate-200 bg-white">
          <CardContent className="py-12 text-center text-slate-500">
            <Building className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">Nenhum colaborador encontrado</p>
            <p className="text-xs text-slate-500 mt-1">
              Não há colaboradores ativos para o filtro de departamento selecionado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Array.from(colaboradoresPorDepartamento.entries()).map(([depto, membros]) => {
            const cobDepto = coberturaPorDepartamento.get(depto)

            return (
              <Card
                key={depto}
                className="border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Building className="h-5 w-5 text-[#0D47A1]" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Departamento: {depto}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="text-xs border-slate-300 bg-white font-semibold"
                    >
                      {membros.length} colaborador(es)
                    </Badge>
                  </div>
                  {cobDepto && cobDepto.diasCriticosCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>
                        {cobDepto.diasCriticosCount} dia(s) com cobertura crítica neste mês
                      </span>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      {/* Cabeçalho da Tabela com Dias do Mês */}
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                          <th className="sticky left-0 z-20 bg-slate-100 p-3 font-bold min-w-[200px] border-r border-slate-200 shadow-xs">
                            Colaborador / Escala
                          </th>
                          {diasDoMes.map((d) => (
                            <th
                              key={d.diaIso}
                              className={`p-1.5 text-center min-w-[34px] font-bold border-r border-slate-200/80 ${
                                d.isHoje
                                  ? 'bg-blue-100/60 text-[#0D47A1]'
                                  : d.isFimDeSemana
                                    ? 'bg-slate-200/50 text-slate-500'
                                    : 'text-slate-700'
                              }`}
                            >
                              <div className="text-[10px] uppercase font-semibold leading-none">
                                {d.diaSemanaLabel}
                              </div>
                              <div className="text-xs font-bold mt-0.5">{d.dia}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {/* Linhas dos Colaboradores */}
                        {membros.map((colab) => {
                          const escInfo = escalasInfo.get(colab.id)
                          const escalaNome = escInfo?.escala?.nome || 'Escala Padrão (5x2)'
                          const modeloEspecial = escInfo?.escala?.modelo_especial

                          return (
                            <tr
                              key={colab.id}
                              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="sticky left-0 z-10 bg-white p-2.5 font-medium border-r border-slate-200 shadow-xs">
                                <div
                                  className="truncate font-semibold text-slate-900"
                                  title={colab.nome}
                                >
                                  {colab.nome}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span
                                    className="text-[10px] text-slate-500 truncate"
                                    title={colab.cargo || ''}
                                  >
                                    {colab.cargo || 'Cargo não informado'}
                                  </span>
                                  {modeloEspecial && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] px-1 py-0 h-4 border-slate-300 bg-slate-50 text-slate-600 font-mono"
                                    >
                                      {modeloEspecial}
                                    </Badge>
                                  )}
                                </div>
                              </td>

                              {/* Células diárias do colaborador */}
                              {diasDoMes.map((d) => {
                                const st = avaliarDiaColaborador(colab.id, d.diaIso)

                                let cellBg = 'bg-white'
                                let cellContent = null

                                if (st.tipo === 'ferias') {
                                  cellBg = 'bg-emerald-500 text-white'
                                  cellContent = (
                                    <Palmtree className="h-3 w-3 mx-auto text-white drop-shadow-xs" />
                                  )
                                } else if (st.tipo === 'folga_12x36') {
                                  cellBg = 'bg-slate-200/90 text-slate-800'
                                  cellContent = (
                                    <span className="text-[9px] font-bold font-mono">12x36</span>
                                  )
                                } else if (st.tipo === 'folga_revezamento') {
                                  cellBg = 'bg-slate-200/90 text-slate-800'
                                  cellContent = (
                                    <span className="text-[9px] font-bold font-mono">Rev.</span>
                                  )
                                } else if (st.tipo === 'folga_semanal') {
                                  cellBg = 'bg-slate-100 text-slate-400'
                                  cellContent = (
                                    <span className="text-[9px] font-normal text-slate-400">
                                      DSR
                                    </span>
                                  )
                                } else {
                                  // Trabalho disponível
                                  cellBg = d.isHoje ? 'bg-blue-50/50' : 'bg-white'
                                  cellContent = (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                                  )
                                }

                                return (
                                  <td
                                    key={d.diaIso}
                                    className={`p-1 text-center border-r border-slate-100 ${cellBg}`}
                                  >
                                    <Tooltip delayDuration={150}>
                                      <TooltipTrigger asChild>
                                        <div className="h-6 w-full flex items-center justify-center cursor-default">
                                          {cellContent}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        <div className="font-semibold">{colab.nome}</div>
                                        <div className="text-[11px] text-slate-300">
                                          {d.dia} de {nomeMesAnoCapitalizado} ({d.diaSemanaLabel})
                                        </div>
                                        <div className="mt-1 font-bold">{st.label}</div>
                                        <div className="text-[10px] text-slate-400">
                                          Escala: {escalaNome}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}

                        {/* Linha Consolidada de Cobertura do Departamento */}
                        {cobDepto && (
                          <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                            <td className="sticky left-0 z-10 bg-slate-100 p-2.5 font-bold border-r border-slate-200 shadow-xs text-slate-900">
                              <div className="flex items-center justify-between">
                                <span>Disponíveis de Fato</span>
                                <span className="text-[10px] text-slate-500 font-normal">
                                  / {cobDepto.totalEquipe} total
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-normal">
                                Não em férias E dia de trabalho
                              </p>
                            </td>

                            {cobDepto.dias.map((dCob, idx) => {
                              const isCritico = dCob.isCritico
                              const isZero = dCob.isZero

                              let cobCellBg = 'bg-slate-50 text-slate-700'
                              if (isZero) {
                                cobCellBg = 'bg-rose-600 text-white font-black'
                              } else if (isCritico) {
                                cobCellBg = 'bg-rose-500 text-white font-black'
                              } else if (dCob.percentualDisponivel <= 50) {
                                cobCellBg = 'bg-amber-100 text-amber-900 font-bold'
                              }

                              return (
                                <td
                                  key={dCob.diaIso}
                                  className={`p-1 text-center border-r border-slate-200/80 ${cobCellBg}`}
                                >
                                  <Tooltip delayDuration={150}>
                                    <TooltipTrigger asChild>
                                      <div className="h-8 w-full flex flex-col items-center justify-center cursor-default">
                                        <span className="text-xs leading-none">
                                          {dCob.disponiveis}
                                        </span>
                                        <span className="text-[9px] opacity-80 leading-none mt-0.5">
                                          {Math.round(dCob.percentualDisponivel)}%
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                      <div className="font-bold">
                                        Cobertura em {diasDoMes[idx]?.dia} de{' '}
                                        {nomeMesAnoCapitalizado}
                                      </div>
                                      <div>
                                        Disponíveis: {dCob.disponiveis} de {dCob.totalEquipe} (
                                        {Math.round(dCob.percentualDisponivel)}%)
                                      </div>
                                      {isCritico && (
                                        <div className="text-rose-300 font-bold mt-0.5 flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          Atenção: Disponibilidade crítica (≤ 20%)!
                                        </div>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </td>
                              )
                            })}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
