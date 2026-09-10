import React, { useState, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  Users,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Colaborador, SolicitacaoFerias } from '@/types'
import { formatDataPtBr } from '@/lib/exportReports'

export interface CalendarioFeriasEquipeProps {
  colaboradores: Colaborador[]
  solicitacoesFerias: SolicitacaoFerias[]
  departamentoNome?: string
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const DIAS_SEMANA_SIGLA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export const CalendarioFeriasEquipe: React.FC<CalendarioFeriasEquipeProps> = ({
  colaboradores,
  solicitacoesFerias,
  departamentoNome,
}) => {
  const hoje = new Date()
  const [ano, setAno] = useState<number>(hoje.getFullYear())
  const [mes, setMes] = useState<number>(hoje.getMonth()) // 0 a 11

  const navegarMesAnterior = () => {
    if (mes === 0) {
      setMes(11)
      setAno((a) => a - 1)
    } else {
      setMes((m) => m - 1)
    }
  }

  const navegarMesProximo = () => {
    if (mes === 11) {
      setMes(0)
      setAno((a) => a + 1)
    } else {
      setMes((m) => m + 1)
    }
  }

  const irParaHoje = () => {
    setAno(hoje.getFullYear())
    setMes(hoje.getMonth())
  }

  // Quantidade de dias no mês
  const totalDiasMes = useMemo(() => {
    return new Date(ano, mes + 1, 0).getDate()
  }, [ano, mes])

  const diasArray = useMemo(() => {
    return Array.from({ length: totalDiasMes }, (_, i) => i + 1)
  }, [totalDiasMes])

  // Normalização de datas de férias: data início e fim em YYYY-MM-DD
  const feriasValidas = useMemo(() => {
    return solicitacoesFerias.filter((f) => f.status === 'aprovada' || f.status === 'pendente')
  }, [solicitacoesFerias])

  // Função auxiliar para verificar se dia está dentro do intervalo
  const checarDiaEmFerias = (dataInicioStr: string, dataFimStr: string, diaNumero: number) => {
    const diaDateStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(diaNumero).padStart(2, '0')}`
    const ini = dataInicioStr.slice(0, 10)
    const fim = dataFimStr.slice(0, 10)
    return diaDateStr >= ini && diaDateStr <= fim
  }

  // Mapa de colaboradores por ID para resgatar nomes
  const colabMap = useMemo(() => {
    const map = new Map<string, Colaborador>()
    colaboradores.forEach((c) => map.set(c.id, c))
    return map
  }, [colaboradores])

  // Mapear dias do mês onde 2 ou mais colaboradores da equipe estão em férias (aprovadas ou pendentes)
  // com cálculo de severidade: 'critica' (3+ pessoas ou deixa 0 colaboradores ativos no departamento) ou 'atencao' (2 pessoas)
  const sobreposicoesPorDia = useMemo(() => {
    const map = new Map<
      number,
      {
        dia: number
        aprovadas: number
        pendentes: number
        colaboradoresIds: string[]
        colaboradoresNomes: string[]
        severidade: 'atencao' | 'critica'
        colaboradoresAtivosRestantes: number
      }
    >()

    const totalEquipe = colaboradores.length

    for (const d of diasArray) {
      const colabsNoDia = new Set<string>()
      let aprovadasCount = 0
      let pendentesCount = 0

      feriasValidas.forEach((f) => {
        if (checarDiaEmFerias(f.data_inicio, f.data_fim, d)) {
          colabsNoDia.add(f.colaborador_id)
          if (f.status === 'aprovada') aprovadasCount++
          else if (f.status === 'pendente') pendentesCount++
        }
      })

      // Sobreposição de 2+ colaboradores no mesmo dia
      if (colabsNoDia.size >= 2) {
        const colabIds = Array.from(colabsNoDia)
        const nomes = colabIds.map((id) => colabMap.get(id)?.nome || 'Colaborador')
        const ativosRestantes = Math.max(0, totalEquipe - colabIds.length)
        const isCritica = colabsNoDia.size >= 3 || (totalEquipe > 0 && ativosRestantes === 0)

        map.set(d, {
          dia: d,
          aprovadas: aprovadasCount,
          pendentes: pendentesCount,
          colaboradoresIds: colabIds,
          colaboradoresNomes: nomes,
          severidade: isCritica ? 'critica' : 'atencao',
          colaboradoresAtivosRestantes: ativosRestantes,
        })
      }
    }

    return map
  }, [diasArray, feriasValidas, ano, mes, colaboradores, colabMap])

  // Lista ordenada de sobreposições para o painel consolidado
  const listaSobreposicoes = useMemo(() => {
    return Array.from(sobreposicoesPorDia.values()).sort((a, b) => a.dia - b.dia)
  }, [sobreposicoesPorDia])

  // Mapa de ferias por colaborador
  const feriasPorColaborador = useMemo(() => {
    const map = new Map<string, SolicitacaoFerias[]>()
    colaboradores.forEach((c) => {
      const solicitacoes = feriasValidas.filter((f) => f.colaborador_id === c.id)
      map.set(c.id, solicitacoes)
    })
    return map
  }, [colaboradores, feriasValidas])

  // Total de sobreposições encontradas no mês e contagem de críticas
  const totalDiasSobrepostos = sobreposicoesPorDia.size
  const totalCriticas = useMemo(() => {
    return Array.from(sobreposicoesPorDia.values()).filter((s) => s.severidade === 'critica').length
  }, [sobreposicoesPorDia])

  return (
    <Card className="border border-slate-200 bg-white shadow-xs">
      <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-[#0D47A1]" />
              Calendário de Férias da Equipe
              {departamentoNome && (
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-[#0D47A1] border-blue-200 font-semibold text-xs"
                >
                  {departamentoNome}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Visão mensal das férias da equipe para planejamento de escala, detecção antecipada de
              conflitos e cobertura de postos de trabalho.
            </CardDescription>
          </div>

          {/* Navegação de Mês */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={irParaHoje}
              className="h-8 text-xs font-semibold border-slate-300 text-slate-700 hover:text-[#0D47A1]"
            >
              Hoje
            </Button>
            <div className="flex items-center border border-slate-300 rounded-md bg-white shadow-xs overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={navegarMesAnterior}
                className="h-8 w-8 text-slate-600 hover:text-[#0D47A1] rounded-none border-r border-slate-200"
                title="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3.5 py-1 text-xs font-bold text-slate-800 min-w-[130px] text-center select-none">
                {MESES[mes]} {ano}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={navegarMesProximo}
                className="h-8 w-8 text-slate-600 hover:text-[#0D47A1] rounded-none border-l border-slate-200"
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Barra de Legendas e Alerta de Conflitos */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-1 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded bg-emerald-500 inline-block shadow-2xs" />
              <span className="text-slate-700 font-medium text-[11px]">Férias Aprovadas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded bg-amber-200 border border-dashed border-amber-500 inline-block" />
              <span className="text-slate-700 font-medium text-[11px]">
                Férias Pendentes (Em Análise)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-500 inline-block" />
              <span className="text-slate-700 font-medium text-[11px]">Atenção (2 ausentes)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-600 inline-block animate-pulse" />
              <span className="text-slate-700 font-medium text-[11px]">
                Crítica (3+ ausentes ou 0 ativos)
              </span>
            </div>
          </div>

          {totalDiasSobrepostos > 0 ? (
            <div className="flex items-center gap-2">
              {totalCriticas > 0 && (
                <Badge
                  variant="outline"
                  className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-xs flex items-center gap-1.5 py-0.5 px-2"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                  {totalCriticas} sobreposição(ões) crítica(s)
                </Badge>
              )}
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 font-semibold text-xs flex items-center gap-1.5 py-0.5 px-2"
              >
                {totalDiasSobrepostos} dia(s) com sobreposição
              </Badge>
            </div>
          ) : (
            <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Nenhum conflito de férias no mês selecionado
            </span>
          )}
        </div>

        {/* Painel/Box de Sobreposições no período exibido */}
        {listaSobreposicoes.length > 0 && (
          <div className="mt-4 p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                Sobreposições no período exibido ({MESES[mes]} de {ano})
              </h4>
              <span className="text-[11px] text-slate-500">
                {listaSobreposicoes.length} dia(s) com concorrência identificada
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {listaSobreposicoes.map((sob) => {
                const diaFormatado = `${String(sob.dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}`
                const isCritica = sob.severidade === 'critica'

                return (
                  <div
                    key={sob.dia}
                    className={`p-2.5 rounded-md border text-xs flex flex-col justify-between ${
                      isCritica
                        ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                        : 'bg-amber-50/80 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-xs flex items-center gap-1">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isCritica ? 'bg-rose-600' : 'bg-amber-500'
                          }`}
                        />
                        Dia {diaFormatado}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-bold uppercase ${
                          isCritica
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {isCritica ? 'Crítica (3+ ou 0 ativos)' : 'Atenção (2 pessoas)'}
                      </Badge>
                    </div>

                    <p className="text-[11px] leading-tight font-medium opacity-90 line-clamp-2">
                      {sob.colaboradoresNomes.join(', ')}
                    </p>

                    <div className="mt-1.5 pt-1 border-t border-black/5 text-[10px] opacity-75 flex items-center justify-between">
                      <span>{sob.colaboradoresIds.length} ausentes</span>
                      {sob.colaboradoresAtivosRestantes === 0 ? (
                        <strong className="text-rose-700">Setor sem cobertura!</strong>
                      ) : (
                        <span>{sob.colaboradoresAtivosRestantes} ativo(s) restantes</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {colaboradores.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            Nenhum colaborador encontrado na equipe selecionada.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200">
                  {/* Coluna fixa do Colaborador */}
                  <th className="sticky left-0 z-20 bg-slate-100 text-left font-bold text-slate-700 p-2.5 min-w-[180px] sm:min-w-[220px] border-r border-slate-200 shadow-xs">
                    Colaborador
                  </th>

                  {/* Colunas dos Dias do Mês */}
                  {diasArray.map((dia) => {
                    const dataDoDia = new Date(ano, mes, dia)
                    const diaSemanaIndex = dataDoDia.getDay()
                    const isFimDeSemana = diaSemanaIndex === 0 || diaSemanaIndex === 6
                    const isHoje =
                      dia === hoje.getDate() &&
                      mes === hoje.getMonth() &&
                      ano === hoje.getFullYear()
                    const dadosSobreposicao = sobreposicoesPorDia.get(dia)
                    const temSobreposicao = Boolean(dadosSobreposicao)
                    const isCritica = dadosSobreposicao?.severidade === 'critica'

                    return (
                      <th
                        key={dia}
                        className={`p-1.5 text-center font-semibold min-w-[34px] sm:min-w-[38px] border-r border-slate-200 transition-colors select-none ${
                          isHoje
                            ? 'bg-[#0D47A1] text-white'
                            : isCritica
                              ? 'bg-rose-100 text-rose-900 font-bold'
                              : temSobreposicao
                                ? 'bg-amber-100 text-amber-900 font-bold'
                                : isFimDeSemana
                                  ? 'bg-slate-200/60 text-slate-500'
                                  : 'bg-slate-50 text-slate-700'
                        }`}
                        title={`${dia}/${mes + 1}/${ano} (${DIAS_SEMANA_SIGLA[diaSemanaIndex]})${
                          isCritica
                            ? ' • SOBREPOSIÇÃO CRÍTICA (3+ colaboradores ou 0 ativos)'
                            : temSobreposicao
                              ? ' • ATENÇÃO: Sobreposição de 2 colaboradores em férias'
                              : ''
                        }`}
                      >
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-[10px] uppercase font-bold opacity-80">
                            {DIAS_SEMANA_SIGLA[diaSemanaIndex]}
                          </span>
                          <span className="text-xs">{dia}</span>
                          {temSobreposicao && (
                            <span
                              className={`h-1.5 w-1.5 rounded-full mt-0.5 ${
                                isCritica ? 'bg-rose-600 animate-ping' : 'bg-amber-600'
                              }`}
                              title={isCritica ? 'Conflito Crítico' : 'Conflito Atenção'}
                            />
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {colaboradores.map((colab) => {
                  const solicitacoes = feriasPorColaborador.get(colab.id) || []

                  return (
                    <tr key={colab.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Célula do Colaborador (fixa na rolagem horizontal) */}
                      <td className="sticky left-0 z-10 bg-white p-2.5 border-r border-slate-200 shadow-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-blue-100 text-[#0D47A1] flex items-center justify-center font-bold text-xs shrink-0">
                            {(colab.nome || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="font-semibold text-slate-900 truncate max-w-[140px] sm:max-w-[180px]"
                              title={colab.nome}
                            >
                              {colab.nome}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate max-w-[140px] sm:max-w-[180px]">
                              {colab.cargo || colab.departamento || 'Colaborador'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Células dos Dias */}
                      {diasArray.map((dia) => {
                        const dataDoDia = new Date(ano, mes, dia)
                        const diaSemanaIndex = dataDoDia.getDay()
                        const isFimDeSemana = diaSemanaIndex === 0 || diaSemanaIndex === 6
                        const temSobreposicaoNoDia = sobreposicoesPorDia.has(dia)

                        // Encontra se este colaborador tem solicitação neste dia
                        const feriasAtiva = solicitacoes.find((f) =>
                          checarDiaEmFerias(f.data_inicio, f.data_fim, dia),
                        )

                        if (!feriasAtiva) {
                          return (
                            <td
                              key={dia}
                              className={`p-1 text-center border-r border-slate-200 ${
                                temSobreposicaoNoDia
                                  ? 'bg-rose-50/30'
                                  : isFimDeSemana
                                    ? 'bg-slate-100/50'
                                    : 'bg-transparent'
                              }`}
                            >
                              <span className="text-[10px] text-slate-300">·</span>
                            </td>
                          )
                        }

                        // Colaborador tem férias neste dia (aprovada ou pendente)
                        const isAprovada = feriasAtiva.status === 'aprovada'
                        const isPendente = feriasAtiva.status === 'pendente'

                        return (
                          <td
                            key={dia}
                            className={`p-0.5 text-center border-r border-slate-200 ${
                              temSobreposicaoNoDia
                                ? 'bg-rose-100/60 ring-1 ring-rose-400 ring-inset'
                                : ''
                            }`}
                          >
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className={`w-full h-8 rounded text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                                    isAprovada
                                      ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-2xs'
                                      : 'bg-amber-200 text-amber-900 border border-dashed border-amber-600 hover:bg-amber-300'
                                  } ${temSobreposicaoNoDia ? 'ring-2 ring-rose-600' : ''}`}
                                  title={`${colab.nome} - ${isAprovada ? 'Férias Aprovadas' : 'Férias Pendentes'}`}
                                >
                                  {isAprovada ? 'F' : 'P'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                side="top"
                                align="center"
                                className="w-80 p-3.5 bg-white border border-slate-300 shadow-lg text-xs"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <span className="font-bold text-slate-900">{colab.nome}</span>
                                    <Badge
                                      variant="outline"
                                      className={
                                        isAprovada
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                                          : 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                                      }
                                    >
                                      {isAprovada ? 'Férias Aprovadas' : 'Solicitação Pendente'}
                                    </Badge>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                                    <div>
                                      <span className="text-slate-400 block">Início:</span>
                                      <strong className="text-slate-800">
                                        {formatDataPtBr(feriasAtiva.data_inicio)}
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block">Término:</span>
                                      <strong className="text-slate-800">
                                        {formatDataPtBr(feriasAtiva.data_fim)}
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block">Duração:</span>
                                      <strong className="text-slate-800">
                                        {feriasAtiva.dias} dias
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block">
                                        Abono Pecuniário:
                                      </span>
                                      <strong className="text-slate-800">
                                        {feriasAtiva.abono_pecuniario ? 'Sim (10 dias)' : 'Não'}
                                      </strong>
                                    </div>
                                  </div>

                                  {temSobreposicaoNoDia && (
                                    <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-1.5 mt-1">
                                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                      <div>
                                        <strong>Alerta de Cobertura:</strong> Outro(s)
                                        colaborador(es) da equipe também estão ausentes neste dia (
                                        {dia}/{mes + 1}).
                                      </div>
                                    </div>
                                  )}

                                  {feriasAtiva.comentario_gestor && (
                                    <p className="text-[10px] text-slate-500 italic border-t border-slate-100 pt-1.5">
                                      Obs: &quot;{feriasAtiva.comentario_gestor}&quot;
                                    </p>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
export default CalendarioFeriasEquipe
