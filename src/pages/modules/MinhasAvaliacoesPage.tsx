import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Info,
  ChevronRight,
  ChevronLeft,
  Users,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { avaliacaoService } from '@/services/avaliacaoService'
import {
  CicloAvaliacao,
  Avaliacao,
  NotaCompetencia,
  CICLO_STATUS_CONFIG,
  Competencia,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'

export default function MinhasAvaliacoesPage() {
  const { user, colaborador } = useAuth()
  const tenantId = user?.tenant_id
  const colaboradorId = colaborador?.id

  const [loading, setLoading] = useState(true)
  const [ciclos, setCiclos] = useState<CicloAvaliacao[]>([])
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [competencias, setCompetencias] = useState<Competencia[]>([])

  // Ciclo selecionado para ver o detalhamento / resultado
  const [cicloSelecionado, setCicloSelecionado] = useState<CicloAvaliacao | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [notasCiclo, setNotasCiclo] = useState<NotaCompetencia[]>([])

  const carregarDados = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [listaCiclos, listaCompetencias] = await Promise.all([
        avaliacaoService.getCiclos(tenantId),
        avaliacaoService.getCompetencias(tenantId),
      ])
      setCiclos(listaCiclos)
      setCompetencias(listaCompetencias)

      if (colaboradorId) {
        const listaAvaliacoes = await avaliacaoService.getAvaliacoesDoColaborador(colaboradorId)
        setAvaliacoes(listaAvaliacoes)

        // Se houver ciclo concluído onde o colaborador foi avaliado, seleciona por padrão
        const ciclosConcluidos = listaCiclos.filter(
          (c) => c.status === 'concluido' && listaAvaliacoes.some((a) => a.ciclo_id === c.id),
        )
        if (ciclosConcluidos.length > 0) {
          setCicloSelecionado(ciclosConcluidos[0])
        }
      }
    } catch (err) {
      console.error('Erro ao carregar minhas avaliações:', err)
    } finally {
      setLoading(false)
    }
  }, [tenantId, colaboradorId])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Carregar notas de detalhe quando um ciclo é selecionado
  useEffect(() => {
    async function carregarDetalhesCiclo() {
      if (!cicloSelecionado || !colaboradorId) {
        setNotasCiclo([])
        return
      }
      try {
        setLoadingDetalhes(true)
        const avalsDoCiclo = avaliacoes.filter((a) => a.ciclo_id === cicloSelecionado.id)
        const ids = avalsDoCiclo.map((a) => a.id)
        if (ids.length > 0) {
          const notas = await avaliacaoService.getNotasPorAvaliacoes(ids)
          setNotasCiclo(notas)
        } else {
          setNotasCiclo([])
        }
      } catch (err) {
        console.error('Erro ao carregar detalhes do ciclo:', err)
      } finally {
        setLoadingDetalhes(false)
      }
    }
    carregarDetalhesCiclo()
  }, [cicloSelecionado, colaboradorId, avaliacoes])

  // Avaliações do ciclo selecionado
  const avaliacoesDoCicloSelecionado = useMemo(() => {
    if (!cicloSelecionado) return []
    return avaliacoes.filter((a) => a.ciclo_id === cicloSelecionado.id)
  }, [cicloSelecionado, avaliacoes])

  // Cálculo da Nota Final e Percentual
  // Fórmula especificada: Nota Final = Σ (Nota Média das Competências × Peso do Avaliador)
  // Percentual do resultado = Nota Final / 5. Ex.: 3.9 / 5 = 78%
  const calculoResultado = useMemo(() => {
    if (avaliacoesDoCicloSelecionado.length === 0) {
      return { notaFinal: 0, percentual: 0, somaPesos: 0 }
    }

    let somaPonderada = 0
    let somaPesos = 0

    for (const aval of avaliacoesDoCicloSelecionado) {
      if (aval.status === 'concluida' && aval.nota_final !== undefined) {
        const peso = Number(aval.peso) || 0
        somaPonderada += Number(aval.nota_final) * peso
        somaPesos += peso
      }
    }

    // Se a soma de pesos for menor que 1 (ex.: apenas principal ou normalização), ajusta se necessário
    const notaFinal = somaPesos > 0 ? somaPonderada / (somaPesos > 1 ? somaPesos : 1) : 0
    const notaFinalArredondada = Math.round(notaFinal * 10) / 10
    const percentual = Math.min(100, Math.round((notaFinalArredondada / 5) * 100))

    return {
      notaFinal: notaFinalArredondada,
      percentual,
      somaPesos,
    }
  }, [avaliacoesDoCicloSelecionado])

  // Cálculo por competência agregada no ciclo
  // Média ponderada por avaliador de cada competência, Nota Esperada e Delta
  const resultadoCompetencias = useMemo(() => {
    if (competencias.length === 0 || notasCiclo.length === 0) return []

    return competencias.map((comp) => {
      const notasDestaComp = notasCiclo.filter((n) => n.competencia_id === comp.id)
      let somaPonderada = 0
      let somaPesos = 0

      notasDestaComp.forEach((notaItem) => {
        const aval = avaliacoesDoCicloSelecionado.find((a) => a.id === notaItem.avaliacao_id)
        const peso = aval ? Number(aval.peso) || 1 : 1
        somaPonderada += Number(notaItem.nota) * peso
        somaPesos += peso
      })

      const notaObtida =
        somaPesos > 0
          ? Math.round((somaPonderada / somaPesos) * 10) / 10
          : notasDestaComp.length > 0
            ? Math.round(
                (notasDestaComp.reduce((acc, curr) => acc + Number(curr.nota), 0) /
                  notasDestaComp.length) *
                  10,
              ) / 10
            : 0

      const notaEsperada = Number(comp.nota_esperada) || 4.0
      const delta = Math.round((notaObtida - notaEsperada) * 10) / 10

      return {
        competencia: comp,
        notaObtida,
        notaEsperada,
        delta,
        percentualBarra: Math.min(100, Math.round((notaObtida / 5) * 100)),
      }
    })
  }, [competencias, notasCiclo, avaliacoesDoCicloSelecionado])

  const formatarDataBR = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    } catch {
      return dateStr
    }
  }

  // Avaliadores categorizados
  const avaliadorPrincipal = avaliacoesDoCicloSelecionado.find(
    (a) => a.tipo_avaliador === 'principal',
  )
  const avaliadoresApoio = avaliacoesDoCicloSelecionado.filter((a) => a.tipo_avaliador === 'apoio')
  const somaPesoApoio = avaliadoresApoio.reduce((acc, curr) => acc + (Number(curr.peso) || 0), 0)

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1]">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Minhas Avaliações de Desempenho
              </h1>
              <p className="text-xs text-[#757575] mt-0.5">
                Consulte seu histórico de ciclos avaliativos, feedbacks de liderança e resultado por
                competências.
              </p>
            </div>
          </div>
        </div>

        {cicloSelecionado && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-white border-[#0D47A1]/30 text-[#0D47A1] text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5 shadow-2xs"
            >
              <Calendar className="h-3.5 w-3.5" />
              Ciclo Ativo no Painel: {cicloSelecionado.nome}
            </Badge>
          </div>
        )}
      </div>

      {/* 2. Lista de Ciclos do Colaborador (Cards Superiores) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#212121] uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#0D47A1]" />
            Ciclos de Avaliação Registrados
          </h2>
          <span className="text-xs text-[#757575]">
            Clique em um ciclo concluído para inspecionar os resultados
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border border-[#E0E0E0] p-4">
                <Skeleton className="h-5 w-3/4 mb-2 bg-slate-100" />
                <Skeleton className="h-4 w-1/2 bg-slate-100" />
              </Card>
            ))}
          </div>
        ) : ciclos.length === 0 ? (
          <Card className="border border-dashed border-[#E0E0E0] p-8 text-center bg-white">
            <p className="text-sm text-[#757575]">
              Nenhum ciclo de avaliação cadastrado no tenant.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ciclos.map((ciclo) => {
              const statusCfg = CICLO_STATUS_CONFIG[ciclo.status] || CICLO_STATUS_CONFIG.pendente
              const avalsColab = avaliacoes.filter((a) => a.ciclo_id === ciclo.id)
              const estaSelecionado = cicloSelecionado?.id === ciclo.id

              return (
                <div
                  key={ciclo.id}
                  onClick={() => {
                    setCicloSelecionado(ciclo)
                  }}
                  className={`group relative rounded-xl border p-4 bg-white transition-all cursor-pointer shadow-2xs hover:shadow-sm ${
                    estaSelecionado
                      ? 'border-[#0D47A1] ring-2 ring-[#0D47A1]/20 bg-blue-50/20'
                      : 'border-[#E0E0E0] hover:border-[#0D47A1]/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#212121] group-hover:text-[#0D47A1] transition-colors line-clamp-2">
                      {ciclo.nome}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold shrink-0 ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full mr-1.5"
                        style={{ backgroundColor: statusCfg.dotColor }}
                      />
                      {statusCfg.label}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-[#757575]">
                    <Calendar className="h-3.5 w-3.5 text-[#0D47A1]" />
                    <span>
                      {formatarDataBR(ciclo.data_inicio)} até {formatarDataBR(ciclo.data_fim)}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs">
                    <span className="text-[#616161] font-medium">
                      {avalsColab.length > 0
                        ? `${avalsColab.length} ${avalsColab.length === 1 ? 'avaliador vinculado' : 'avaliadores vinculados'}`
                        : 'Aguardando designação'}
                    </span>
                    <span className="text-[#0D47A1] font-semibold flex items-center text-xs group-hover:translate-x-0.5 transition-transform">
                      {ciclo.status === 'concluido' ? 'Ver Resultados' : 'Detalhes'}
                      <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. Visualização Detalhada do Ciclo Concluído */}
      {cicloSelecionado && (
        <div className="space-y-6 pt-4 border-t border-[#E0E0E0]">
          {cicloSelecionado.status !== 'concluido' ? (
            <Card className="border border-[#E0E0E0] bg-white p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="h-12 w-12 rounded-xl bg-blue-50 text-[#0D47A1] flex items-center justify-center shrink-0">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#212121]">
                    Ciclo &quot;{cicloSelecionado.nome}&quot; está{' '}
                    {cicloSelecionado.status === 'em_andamento' ? 'em andamento' : 'pendente'}
                  </h3>
                  <p className="text-xs text-[#757575] mt-1">
                    Os resultados finais, percentual de aderência e delta de performance serão
                    liberados automaticamente assim que todos os avaliadores concluírem suas
                    análises e o RH encerrar o ciclo.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Sidebar do Colaborador e Resumo Geral */}
              <div className="lg:col-span-4 space-y-6">
                {/* Card Perfil do Colaborador Avaliado */}
                <Card className="border border-[#E0E0E0] bg-white shadow-xs overflow-hidden">
                  <div className="bg-[#0D47A1] p-5 text-white">
                    <div className="flex items-center gap-3.5">
                      <Avatar className="h-14 w-14 border-2 border-white shadow-sm">
                        <AvatarImage
                          src={colaborador?.foto_url}
                          alt={colaborador?.nome || user?.name}
                        />
                        <AvatarFallback className="bg-white/20 text-white font-bold text-lg">
                          {(colaborador?.nome || user?.name || 'C').charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-bold text-base leading-snug">
                          {colaborador?.nome || user?.name}
                        </h3>
                        <p className="text-xs text-blue-100">
                          {colaborador?.cargo || 'Colaborador'}
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 bg-white/10 text-white border-white/20 text-[10px]"
                        >
                          {colaborador?.departamento || 'Marketing'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-5 space-y-4">
                    {/* Nota Final e Percentual */}
                    <div className="rounded-xl border border-[#0D47A1]/20 bg-[#E8EEF7]/50 p-4 text-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D47A1] block">
                        Resultado Geral do Ciclo
                      </span>
                      <div className="flex items-baseline justify-center gap-2 mt-2">
                        <span className="text-4xl font-extrabold text-[#0D47A1]">
                          {calculoResultado.percentual}%
                        </span>
                        <span className="text-sm font-semibold text-[#616161]">
                          ({calculoResultado.notaFinal.toFixed(1)} / 5.0)
                        </span>
                      </div>
                      <p className="text-[11px] text-[#757575] mt-1.5">
                        Fórmula: Σ (Nota Média × Peso do Avaliador)
                      </p>
                    </div>

                    {/* Avaliadores Designados e Status */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#212121] flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[#0D47A1]" />
                        Composição da Avaliação
                      </h4>

                      {/* Avaliador Principal */}
                      <div className="rounded-lg border border-[#E0E0E0] p-3 bg-[#FAFAFA] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#0D47A1]">
                            Avaliador Principal (60%)
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              avaliadorPrincipal?.status === 'concluida'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {avaliadorPrincipal?.status === 'concluida' ? 'Realizada' : 'Pendente'}
                          </Badge>
                        </div>
                        <p className="text-xs font-semibold text-[#212121]">
                          {avaliadorPrincipal?.expand?.avaliador_id?.nome || 'Gestor Direto'}
                        </p>
                        {avaliadorPrincipal?.nota_final !== undefined && (
                          <p className="text-[11px] text-[#757575]">
                            Nota atribuída:{' '}
                            <strong>{Number(avaliadorPrincipal.nota_final).toFixed(1)}</strong>
                          </p>
                        )}
                        {avaliadorPrincipal?.comentario && (
                          <p className="text-[11px] text-[#616161] italic bg-white p-2 rounded border border-[#E0E0E0] mt-1">
                            &quot;{avaliadorPrincipal.comentario}&quot;
                          </p>
                        )}
                      </div>

                      {/* Avaliadores de Apoio */}
                      <div className="rounded-lg border border-[#E0E0E0] p-3 bg-[#FAFAFA] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#555]">
                            Avaliadores de Apoio ({Math.round(somaPesoApoio * 100)}% somado)
                          </span>
                          <span className="text-[10px] text-[#757575]">
                            {avaliadoresApoio.length} participante(s)
                          </span>
                        </div>

                        {avaliadoresApoio.length === 0 ? (
                          <p className="text-[11px] text-[#757575]">Nenhum avaliador de apoio.</p>
                        ) : (
                          avaliadoresApoio.map((apoio) => (
                            <div
                              key={apoio.id}
                              className="border-t border-[#E8EEF7] pt-2 first:border-0 first:pt-0 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[#212121]">
                                  {apoio.expand?.avaliador_id?.nome || 'Avaliador de Apoio'}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-white text-[#757575]"
                                >
                                  Peso: {Math.round((Number(apoio.peso) || 0) * 100)}%
                                </Badge>
                              </div>
                              {apoio.comentario && (
                                <p className="text-[11px] text-[#616161] italic">
                                  &quot;{apoio.comentario}&quot;
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Coluna Central / Direita: Detalhamento por Competência e Deltas */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                  <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-[#0D47A1]" />
                        <div>
                          <CardTitle className="text-base font-bold text-[#212121]">
                            Desempenho por Competência & Delta
                          </CardTitle>
                          <CardDescription className="text-xs text-[#757575]">
                            Delta de performance = Nota Obtida − Nota Esperada pelo perfil da função
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-[#0D47A1] border-[#0D47A1]/30 text-xs"
                      >
                        Escala 1.0 a 5.0
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-5 space-y-5">
                    {loadingDetalhes ? (
                      <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-16 w-full bg-slate-100" />
                        ))}
                      </div>
                    ) : resultadoCompetencias.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#757575]">
                        Nenhuma nota por competência consolidada para este colaborador.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {resultadoCompetencias.map((item) => {
                          const deltaPositivo = item.delta > 0
                          const deltaNeutro = item.delta === 0

                          return (
                            <div
                              key={item.competencia.id}
                              className="rounded-xl border border-[#E0E0E0] p-4 bg-[#FAFAFA] hover:bg-white hover:border-[#0D47A1]/40 transition-all space-y-2.5"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-[#212121]">
                                      {item.competencia.nome}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-white border-[#D0D7DE] text-[#616161]"
                                    >
                                      {item.competencia.tipo === 'geral' ? 'Geral' : 'Específica'} •{' '}
                                      {item.competencia.peso}%
                                    </Badge>
                                  </div>
                                  {item.competencia.descricao && (
                                    <p className="text-xs text-[#757575]">
                                      {item.competencia.descricao}
                                    </p>
                                  )}
                                </div>

                                {/* Bloco de Notas & Delta */}
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="text-right">
                                    <span className="text-xs text-[#757575] block">
                                      Esperada: {item.notaEsperada.toFixed(1)}
                                    </span>
                                    <span className="text-sm font-extrabold text-[#0D47A1]">
                                      Obtida: {item.notaObtida.toFixed(1)}
                                    </span>
                                  </div>

                                  {/* Badge Delta */}
                                  <div
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 border ${
                                      deltaPositivo
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                        : deltaNeutro
                                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                                          : 'bg-rose-50 text-rose-700 border-rose-300'
                                    }`}
                                  >
                                    {deltaPositivo ? (
                                      <TrendingUp className="h-3.5 w-3.5" />
                                    ) : deltaNeutro ? (
                                      <Minus className="h-3.5 w-3.5" />
                                    ) : (
                                      <TrendingDown className="h-3.5 w-3.5" />
                                    )}
                                    <span>
                                      Δ{' '}
                                      {item.delta > 0
                                        ? `+${item.delta.toFixed(1)}`
                                        : item.delta.toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Barra de Progresso Horizontal */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-[#757575]">
                                  <span>Progresso da Meta (Escala 1 a 5)</span>
                                  <span className="font-semibold text-[#212121]">
                                    {item.percentualBarra}%
                                  </span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${item.percentualBarra}%`,
                                      backgroundColor:
                                        item.notaObtida >= item.notaEsperada
                                          ? '#2E7D32'
                                          : '#0D47A1',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
