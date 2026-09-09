import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Award,
  Plus,
  Calendar,
  Layers,
  Users,
  BarChart3,
  CheckCircle2,
  Clock,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit,
  Loader2,
  Filter,
  Search,
  UserCheck,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { avaliacaoService } from '@/services/avaliacaoService'
import { colaboradorService } from '@/services/api'
import {
  CicloAvaliacao,
  CicloAvaliacaoStatus,
  Competencia,
  CompetenciaTipo,
  Avaliacao,
  Colaborador,
  CICLO_STATUS_CONFIG,
  NotaCompetencia,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'

export default function AvaliacoesAdminPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const tenantId = user?.tenant_id

  const [abaAtiva, setAbaAtiva] = useState<'ciclos' | 'competencias' | 'designacao' | 'relatorios'>(
    'ciclos',
  )
  const [loading, setLoading] = useState(true)

  // Dados globais
  const [ciclos, setCiclos] = useState<CicloAvaliacao[]>([])
  const [competencias, setCompetencias] = useState<Competencia[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [notas, setNotas] = useState<NotaCompetencia[]>([])

  // Modal Novo Ciclo
  const [modalNovoCiclo, setModalNovoCiclo] = useState(false)
  const [nomeCiclo, setNomeCiclo] = useState('')
  const [dataInicioCiclo, setDataInicioCiclo] = useState('')
  const [dataFimCiclo, setDataFimCiclo] = useState('')
  const [statusCiclo, setStatusCiclo] = useState<CicloAvaliacaoStatus>('pendente')
  const [salvandoCiclo, setSalvandoCiclo] = useState(false)

  // Modal Nova Competência
  const [modalNovaComp, setModalNovaComp] = useState(false)
  const [nomeComp, setNomeComp] = useState('')
  const [tipoComp, setTipoComp] = useState<CompetenciaTipo>('geral')
  const [pesoComp, setPesoComp] = useState<number | ''>(20)
  const [notaEsperadaComp, setNotaEsperadaComp] = useState<number | ''>(4.0)
  const [descricaoComp, setDescricaoComp] = useState('')
  const [salvandoComp, setSalvandoComp] = useState(false)

  // Designação de Avaliadores
  const [cicloDesignacaoId, setCicloDesignacaoId] = useState<string>('')
  const [colabDesignadoId, setColabDesignadoId] = useState<string>('')
  const [avaliadorPrincipalId, setAvaliadorPrincipalId] = useState<string>('')
  const [avaliadorApoioId, setAvaliadorApoioId] = useState<string>('')
  const [salvandoDesignacao, setSalvandoDesignacao] = useState(false)

  // Filtros em Relatórios
  const [cicloRelatorioId, setCicloRelatorioId] = useState<string>('')
  const [filtroDeptoRelatorio, setFiltroDeptoRelatorio] = useState<string>('todos')
  const [buscaRelatorio, setBuscaRelatorio] = useState('')

  const carregarTudo = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [listaCiclos, listaComps, listaColabs] = await Promise.all([
        avaliacaoService.getCiclos(tenantId),
        avaliacaoService.getCompetencias(tenantId),
        colaboradorService.getColaboradores(tenantId),
      ])

      setCiclos(listaCiclos)
      setCompetencias(listaComps)
      setColaboradores(listaColabs)

      if (listaCiclos.length > 0) {
        const ativo = listaCiclos.find((c) => c.status === 'em_andamento') || listaCiclos[0]
        setCicloDesignacaoId(ativo.id)
        const cicloRel = listaCiclos.find((c) => c.status === 'concluido') || ativo
        setCicloRelatorioId(cicloRel.id)

        // Carrega todas as avaliações
        const avals = await avaliacaoService.getAvaliacoesPorCiclo(ativo.id)
        setAvaliacoes(avals)
      }
    } catch (err) {
      console.error('Erro ao carregar dados de avaliação admin:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar as informações de ciclos e competências.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    carregarTudo()
  }, [carregarTudo])

  // Recarregar avaliações quando o ciclo de designação mudar
  useEffect(() => {
    async function carregarAvals() {
      if (!cicloDesignacaoId) return
      try {
        const avals = await avaliacaoService.getAvaliacoesPorCiclo(cicloDesignacaoId)
        setAvaliacoes(avals)
      } catch (err) {
        console.error('Erro ao carregar avaliações do ciclo:', err)
      }
    }
    carregarAvals()
  }, [cicloDesignacaoId])

  // Recarregar notas quando o ciclo do relatório mudar
  useEffect(() => {
    async function carregarNotasRelatorio() {
      if (!cicloRelatorioId) return
      try {
        const avals = await avaliacaoService.getAvaliacoesPorCiclo(cicloRelatorioId)
        const ids = avals.map((a) => a.id)
        if (ids.length > 0) {
          const listaNotas = await avaliacaoService.getNotasPorAvaliacoes(ids)
          setNotas(listaNotas)
        } else {
          setNotas([])
        }
      } catch (err) {
        console.error('Erro ao buscar notas do relatório:', err)
      }
    }
    carregarNotasRelatorio()
  }, [cicloRelatorioId])

  // --------------------------------------------------------------------------
  // CRIAR NOVO CICLO
  // --------------------------------------------------------------------------
  const handleCriarCiclo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !nomeCiclo || !dataInicioCiclo || !dataFimCiclo) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o nome do ciclo e o período de início e fim.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoCiclo(true)
      const novo = await avaliacaoService.createCiclo({
        tenant_id: tenantId,
        nome: nomeCiclo,
        data_inicio: new Date(dataInicioCiclo + 'T00:00:00Z').toISOString(),
        data_fim: new Date(dataFimCiclo + 'T00:00:00Z').toISOString(),
        status: statusCiclo,
      })

      setCiclos((prev) => [novo, ...prev])
      setNomeCiclo('')
      setDataInicioCiclo('')
      setDataFimCiclo('')
      setStatusCiclo('pendente')
      setModalNovoCiclo(false)

      toast({
        title: 'Ciclo criado com sucesso',
        description: `O ciclo "${novo.nome}" foi registrado no sistema.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao criar ciclo:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao registrar novo ciclo.'
      toast({ title: 'Erro ao criar ciclo', description: msg, variant: 'destructive' })
    } finally {
      setSalvandoCiclo(false)
    }
  }

  // --------------------------------------------------------------------------
  // CRIAR NOVA COMPETÊNCIA
  // --------------------------------------------------------------------------
  const handleCriarCompetencia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !nomeComp) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o título da competência.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoComp(true)
      const nova = await avaliacaoService.createCompetencia({
        tenant_id: tenantId,
        nome: nomeComp,
        tipo: tipoComp,
        peso: Number(pesoComp) || 20,
        nota_esperada: Number(notaEsperadaComp) || 4.0,
        descricao: descricaoComp,
      })

      setCompetencias((prev) => [...prev, nova])
      setNomeComp('')
      setTipoComp('geral')
      setPesoComp(20)
      setNotaEsperadaComp(4.0)
      setDescricaoComp('')
      setModalNovaComp(false)

      toast({
        title: 'Competência adicionada',
        description: `Competência "${nova.nome}" cadastrada com sucesso.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao criar competência:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao cadastrar competência.'
      toast({ title: 'Erro ao cadastrar competência', description: msg, variant: 'destructive' })
    } finally {
      setSalvandoComp(false)
    }
  }

  const handleExcluirCompetencia = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente remover a competência "${nome}"?`)) return
    try {
      await avaliacaoService.deleteCompetencia(id)
      setCompetencias((prev) => prev.filter((c) => c.id !== id))
      toast({
        title: 'Competência removida',
        description: `A competência "${nome}" foi excluída.`,
      })
    } catch (err) {
      console.error('Erro ao excluir competência:', err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover a competência.',
        variant: 'destructive',
      })
    }
  }

  // --------------------------------------------------------------------------
  // DESIGNAÇÃO DE AVALIADORES
  // --------------------------------------------------------------------------
  const handleSalvarDesignacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cicloDesignacaoId || !colabDesignadoId || !avaliadorPrincipalId) {
      toast({
        title: 'Seleção incompleta',
        description: 'Selecione o ciclo, o colaborador e o avaliador principal.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoDesignacao(true)

      // 1. Criar avaliador principal (peso 60%)
      const avalPrincipal = await avaliacaoService.createAvaliacao({
        ciclo_id: cicloDesignacaoId,
        colaborador_id: colabDesignadoId,
        avaliador_id: avaliadorPrincipalId,
        tipo_avaliador: 'principal',
        peso: 0.6,
      })

      // 2. Se houver avaliador de apoio selecionado (peso 30%)
      let avalApoio: Avaliacao | null = null
      if (avaliadorApoioId && avaliadorApoioId !== avaliadorPrincipalId) {
        avalApoio = await avaliacaoService.createAvaliacao({
          ciclo_id: cicloDesignacaoId,
          colaborador_id: colabDesignadoId,
          avaliador_id: avaliadorApoioId,
          tipo_avaliador: 'apoio',
          peso: 0.3,
        })
      }

      setAvaliacoes((prev) => [avalPrincipal, ...(avalApoio ? [avalApoio] : []), ...prev])

      setColabDesignadoId('')
      setAvaliadorPrincipalId('')
      setAvaliadorApoioId('')

      toast({
        title: 'Avaliadores designados com sucesso',
        description: 'O colaborador agora possui avaliadores vinculados para o ciclo.',
      })
    } catch (err: unknown) {
      console.error('Erro ao designar avaliadores:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao vincular avaliadores.'
      toast({ title: 'Erro na designação', description: msg, variant: 'destructive' })
    } finally {
      setSalvandoDesignacao(false)
    }
  }

  // Estatísticas de Progresso do Ciclo
  const progressoCiclo = useMemo(() => {
    if (!cicloDesignacaoId) return { total: 0, concluidas: 0, percentual: 0 }
    const avalsDoCiclo = avaliacoes.filter((a) => a.ciclo_id === cicloDesignacaoId)
    const total = avalsDoCiclo.length
    const concluidas = avalsDoCiclo.filter((a) => a.status === 'concluida').length
    const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0
    return { total, concluidas, percentual }
  }, [cicloDesignacaoId, avaliacoes])

  // --------------------------------------------------------------------------
  // RELATÓRIOS CONSOLIDADOS
  // --------------------------------------------------------------------------
  // Tabela com todos os colaboradores, nota final e delta, ordenada por nota (maior para menor)
  const relatorioColaboradores = useMemo(() => {
    const avalsDoCiclo = avaliacoes.filter((a) => a.ciclo_id === cicloRelatorioId)
    const departamentosSet = new Set<string>()

    colaboradores.forEach((c) => {
      if (c.departamento) departamentosSet.add(c.departamento)
    })

    const lista = colaboradores
      .filter((c) => c.status === 'ativo')
      .map((colab) => {
        const avalsColab = avalsDoCiclo.filter((a) => a.colaborador_id === colab.id)
        let somaPonderada = 0
        let somaPesos = 0
        let possuiConcluida = false

        avalsColab.forEach((aval) => {
          if (aval.status === 'concluida' && aval.nota_final !== undefined) {
            possuiConcluida = true
            const peso = Number(aval.peso) || 0
            somaPonderada += Number(aval.nota_final) * peso
            somaPesos += peso
          }
        })

        const notaFinalCalculada =
          somaPesos > 0
            ? Math.round((somaPonderada / (somaPesos > 1 ? somaPesos : 1)) * 10) / 10
            : 0

        // Meta esperada geral = média das competências cadastradas ou 4.0
        const notaEsperada =
          competencias.length > 0
            ? Math.round(
                (competencias.reduce((acc, c) => acc + (Number(c.nota_esperada) || 4.0), 0) /
                  competencias.length) *
                  10,
              ) / 10
            : 4.0

        const delta = possuiConcluida
          ? Math.round((notaFinalCalculada - notaEsperada) * 10) / 10
          : 0
        const percentual = Math.min(100, Math.round((notaFinalCalculada / 5) * 100))

        return {
          colaborador: colab,
          notaFinal: notaFinalCalculada,
          notaEsperada,
          delta,
          percentual,
          possuiConcluida,
          totalAvaliadores: avalsColab.length,
        }
      })
      // Ordenação: nota final maior para menor
      .sort((a, b) => b.notaFinal - a.notaFinal)

    // Filtros
    const filtrados = lista.filter((item) => {
      const matchDepto =
        filtroDeptoRelatorio === 'todos' || item.colaborador.departamento === filtroDeptoRelatorio

      const matchBusca =
        item.colaborador.nome.toLowerCase().includes(buscaRelatorio.toLowerCase()) ||
        (item.colaborador.cargo &&
          item.colaborador.cargo.toLowerCase().includes(buscaRelatorio.toLowerCase()))

      return matchDepto && matchBusca
    })

    return {
      dados: filtrados,
      departamentos: Array.from(departamentosSet),
    }
  }, [
    colaboradores,
    avaliacoes,
    cicloRelatorioId,
    competencias,
    filtroDeptoRelatorio,
    buscaRelatorio,
  ])

  const formatarDataBR = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Administração — Avaliação de Desempenho
              </h1>
              <p className="text-xs text-[#757575] mt-0.5">
                Gerencie ciclos avaliativos, configure competências e pesos, designe avaliadores e
                consulte relatórios consolidados.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tabs de Navegação */}
      <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as any)} className="space-y-6">
        <TabsList className="bg-white border border-[#E0E0E0] p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger
            value="ciclos"
            className="text-xs py-2 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5" />
            Ciclos de Avaliação
          </TabsTrigger>
          <TabsTrigger
            value="competencias"
            className="text-xs py-2 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            Competências e Pesos
          </TabsTrigger>
          <TabsTrigger
            value="designacao"
            className="text-xs py-2 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white gap-1.5"
          >
            <Users className="h-3.5 w-3.5" />
            Designar Avaliadores
          </TabsTrigger>
          <TabsTrigger
            value="relatorios"
            className="text-xs py-2 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Relatórios & Ranking
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            ABA 1: CICLOS DE AVALIAÇÃO
        ========================================================================= */}
        <TabsContent value="ciclos" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#212121]">Ciclos Avaliativos do Tenant</h2>
              <p className="text-xs text-[#757575]">
                Configure novos períodos semestrais ou anuais de avaliação.
              </p>
            </div>

            <Dialog open={modalNovoCiclo} onOpenChange={setModalNovoCiclo}>
              <DialogTrigger asChild>
                <Button className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-9 gap-1.5 shadow-sm">
                  <Plus className="h-4 w-4" />
                  Criar Novo Ciclo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white border border-[#E0E0E0] p-6">
                <DialogHeader className="text-left space-y-1">
                  <DialogTitle className="text-base font-bold text-[#212121]">
                    Criar Ciclo de Avaliação
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#757575]">
                    Defina o nome de identificação e o período de vigência.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCriarCiclo} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#212121]">
                      Nome do Ciclo <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="Ex: Ciclo 2026.2 — Avaliação Semestral"
                      value={nomeCiclo}
                      onChange={(e) => setNomeCiclo(e.target.value)}
                      className="text-xs h-9 border-[#E0E0E0]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#212121]">
                        Data Início <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        required
                        value={dataInicioCiclo}
                        onChange={(e) => setDataInicioCiclo(e.target.value)}
                        className="text-xs h-9 border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#212121]">
                        Data Fim <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        required
                        value={dataFimCiclo}
                        onChange={(e) => setDataFimCiclo(e.target.value)}
                        className="text-xs h-9 border-[#E0E0E0]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#212121]">Status Inicial</Label>
                    <Select
                      value={statusCiclo}
                      onValueChange={(v) => setStatusCiclo(v as CicloAvaliacaoStatus)}
                    >
                      <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="pendente" className="text-xs">
                          Pendente (planejamento)
                        </SelectItem>
                        <SelectItem value="em_andamento" className="text-xs">
                          Em Andamento (liberado para avaliação)
                        </SelectItem>
                        <SelectItem value="concluido" className="text-xs">
                          Concluído (encerrado para leitura)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-3 border-t border-[#E0E0E0] flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setModalNovoCiclo(false)}
                      className="h-9 text-xs border-[#E0E0E0]"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={salvandoCiclo}
                      className="h-9 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white min-w-[100px]"
                    >
                      {salvandoCiclo ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Criar Ciclo'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ciclos.map((ciclo) => {
              const cfg = CICLO_STATUS_CONFIG[ciclo.status] || CICLO_STATUS_CONFIG.pendente
              return (
                <Card
                  key={ciclo.id}
                  className="border border-[#E0E0E0] bg-white shadow-2xs hover:shadow-xs transition-all p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#212121]">{ciclo.nome}</h3>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${cfg.bg} ${cfg.text} ${cfg.border}`}
                    >
                      {cfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#757575]">
                    <Calendar className="h-3.5 w-3.5 text-[#0D47A1]" />
                    <span>
                      {formatarDataBR(ciclo.data_inicio)} até {formatarDataBR(ciclo.data_fim)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#F0F0F0] flex items-center justify-between text-xs">
                    <span className="text-[#757575]">Status do Ciclo</span>
                    <Select
                      value={ciclo.status}
                      onValueChange={async (novoStatus: CicloAvaliacaoStatus) => {
                        await avaliacaoService.updateCiclo(ciclo.id, { status: novoStatus })
                        setCiclos((prev) =>
                          prev.map((c) => (c.id === ciclo.id ? { ...c, status: novoStatus } : c)),
                        )
                        toast({
                          title: 'Status atualizado',
                          description: `Ciclo agora está "${CICLO_STATUS_CONFIG[novoStatus]?.label}".`,
                        })
                      }}
                    >
                      <SelectTrigger className="w-32 h-7 text-[11px] border-[#E0E0E0] bg-[#FAFAFA]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="pendente" className="text-xs">
                          Pendente
                        </SelectItem>
                        <SelectItem value="em_andamento" className="text-xs">
                          Em Andamento
                        </SelectItem>
                        <SelectItem value="concluido" className="text-xs">
                          Concluído
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* =========================================================================
            ABA 2: COMPETÊNCIAS E PESOS
        ========================================================================= */}
        <TabsContent value="competencias" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#212121]">Competências Avaliadas</h2>
              <p className="text-xs text-[#757575]">
                Configure competências gerais (todos os colaboradores) e específicas com seus pesos.
              </p>
            </div>

            <Dialog open={modalNovaComp} onOpenChange={setModalNovaComp}>
              <DialogTrigger asChild>
                <Button className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-9 gap-1.5 shadow-sm">
                  <Plus className="h-4 w-4" />
                  Nova Competência
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white border border-[#E0E0E0] p-6">
                <DialogHeader className="text-left space-y-1">
                  <DialogTitle className="text-base font-bold text-[#212121]">
                    Adicionar Competência
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#757575]">
                    Defina o título, peso percentual e nota esperada.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCriarCompetencia} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#212121]">
                      Nome da Competência <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="Ex: Comunicação Assertiva, Inovação..."
                      value={nomeComp}
                      onChange={(e) => setNomeComp(e.target.value)}
                      className="text-xs h-9 border-[#E0E0E0]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#212121]">Tipo</Label>
                      <Select
                        value={tipoComp}
                        onValueChange={(v) => setTipoComp(v as CompetenciaTipo)}
                      >
                        <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="geral" className="text-xs">
                            Geral (Todos)
                          </SelectItem>
                          <SelectItem value="especifica" className="text-xs">
                            Específica (Cargo/Depto)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#212121]">Peso (%)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={pesoComp}
                        onChange={(e) =>
                          setPesoComp(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                        }
                        className="text-xs h-9 border-[#E0E0E0]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#212121]">
                      Nota Esperada / Meta (1.0 a 5.0)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="5.0"
                      value={notaEsperadaComp}
                      onChange={(e) =>
                        setNotaEsperadaComp(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      className="text-xs h-9 border-[#E0E0E0]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#212121]">
                      Descrição dos Comportamentos Esperados
                    </Label>
                    <Textarea
                      rows={2}
                      placeholder="Breve descrição do que é esperado do colaborador..."
                      value={descricaoComp}
                      onChange={(e) => setDescricaoComp(e.target.value)}
                      className="text-xs border-[#E0E0E0]"
                    />
                  </div>

                  <div className="pt-3 border-t border-[#E0E0E0] flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setModalNovaComp(false)}
                      className="h-9 text-xs border-[#E0E0E0]"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={salvandoComp}
                      className="h-9 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white min-w-[100px]"
                    >
                      {salvandoComp ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Adicionar'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {competencias.map((comp) => (
              <Card
                key={comp.id}
                className="border border-[#E0E0E0] bg-white p-4 shadow-2xs hover:shadow-xs transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-bold text-[#212121]">{comp.nome}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          comp.tipo === 'geral'
                            ? 'bg-blue-50 text-[#0D47A1] border-[#0D47A1]/30'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {comp.tipo === 'geral' ? 'Competência Geral' : 'Competência Específica'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-slate-50 text-[#616161]">
                        Peso: {comp.peso}%
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-50 text-emerald-700"
                      >
                        Meta: {Number(comp.nota_esperada || 4.0).toFixed(1)}
                      </Badge>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleExcluirCompetencia(comp.id, comp.nome)}
                    className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {comp.descricao && (
                  <p className="text-xs text-[#757575] leading-relaxed pt-1 border-t border-[#F0F0F0]">
                    {comp.descricao}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* =========================================================================
            ABA 3: DESIGNAR AVALIADORES & PROGRESSO DO CICLO
        ========================================================================= */}
        <TabsContent value="designacao" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lado Esquerdo: Formulário de Designação */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                  <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-[#0D47A1]" />
                    Designar Avaliadores para o Ciclo
                  </CardTitle>
                  <CardDescription className="text-xs text-[#757575]">
                    Vincule avaliador principal (peso 60%) e avaliador de apoio (peso 30%).
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleSalvarDesignacao} className="space-y-4">
                    {/* Ciclo */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#212121]">Ciclo Alvo</Label>
                      <Select value={cicloDesignacaoId} onValueChange={setCicloDesignacaoId}>
                        <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                          <SelectValue placeholder="Selecione o ciclo..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {ciclos.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.nome} ({c.status})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Colaborador Avaliado */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#212121]">
                        Colaborador Avaliado <span className="text-red-500">*</span>
                      </Label>
                      <Select value={colabDesignadoId} onValueChange={setColabDesignadoId}>
                        <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                          <SelectValue placeholder="Selecione o colaborador..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {colaboradores
                            .filter((c) => c.status === 'ativo')
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.nome} — {c.cargo || c.departamento}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Avaliador Principal */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#212121]">
                        Avaliador Principal (Peso padrão 60%){' '}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Select value={avaliadorPrincipalId} onValueChange={setAvaliadorPrincipalId}>
                        <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                          <SelectValue placeholder="Selecione o gestor ou líder..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {colaboradores
                            .filter((c) => c.status === 'ativo' && c.id !== colabDesignadoId)
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.nome} ({c.cargo || 'Líder'})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Avaliador de Apoio (opcional) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#212121]">
                        Avaliador de Apoio (Peso 30%)
                      </Label>
                      <Select value={avaliadorApoioId} onValueChange={setAvaliadorApoioId}>
                        <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                          <SelectValue placeholder="Selecione avaliador de apoio (opcional)..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="none" className="text-xs text-[#757575]">
                            Nenhum avaliador de apoio
                          </SelectItem>
                          {colaboradores
                            .filter(
                              (c) =>
                                c.status === 'ativo' &&
                                c.id !== colabDesignadoId &&
                                c.id !== avaliadorPrincipalId,
                            )
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.nome} ({c.departamento || c.cargo})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="submit"
                      disabled={salvandoDesignacao}
                      className="w-full h-9 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white"
                    >
                      {salvandoDesignacao ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Salvar Designação'
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Card de Progresso do Ciclo */}
              <Card className="border border-[#E0E0E0] bg-white shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#212121]">
                    Progresso Geral do Ciclo
                  </h3>
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-[#0D47A1] border-[#0D47A1]/30 text-xs font-bold"
                  >
                    {progressoCiclo.percentual}% Concluído
                  </Badge>
                </div>

                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0D47A1] transition-all duration-500 rounded-full"
                    style={{ width: `${progressoCiclo.percentual}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#757575]">
                  <span>{progressoCiclo.concluidas} avaliações realizadas</span>
                  <span>{progressoCiclo.total} avaliações totais</span>
                </div>
              </Card>
            </div>

            {/* Lado Direito: Lista de Avaliações Designadas no Ciclo */}
            <div className="lg:col-span-7">
              <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                  <CardTitle className="text-base font-bold text-[#212121]">
                    Vínculos de Avaliação no Ciclo
                  </CardTitle>
                  <CardDescription className="text-xs text-[#757575]">
                    Total de {avaliacoes.filter((a) => a.ciclo_id === cicloDesignacaoId).length}{' '}
                    avaliações designadas
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA] text-[#757575] font-semibold uppercase text-[10px]">
                          <th className="py-3 pl-4">Colaborador</th>
                          <th className="py-3">Avaliador Designado</th>
                          <th className="py-3 text-center">Tipo / Peso</th>
                          <th className="py-3 text-center">Status</th>
                          <th className="py-3 text-center">Nota</th>
                          <th className="py-3 pr-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5F5F5]">
                        {avaliacoes
                          .filter((a) => a.ciclo_id === cicloDesignacaoId)
                          .map((aval) => {
                            const cNome =
                              aval.expand?.colaborador_id?.nome ||
                              colaboradores.find((c) => c.id === aval.colaborador_id)?.nome ||
                              'Colaborador'
                            const aNome =
                              aval.expand?.avaliador_id?.nome ||
                              colaboradores.find((c) => c.id === aval.avaliador_id)?.nome ||
                              'Avaliador'

                            return (
                              <tr key={aval.id} className="hover:bg-[#FAFAFA] transition-colors">
                                <td className="py-3 pl-4 font-bold text-[#212121]">{cNome}</td>
                                <td className="py-3 text-[#616161]">{aNome}</td>
                                <td className="py-3 text-center">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      aval.tipo_avaliador === 'principal'
                                        ? 'bg-blue-50 text-[#0D47A1] border-[#0D47A1]/30 font-bold'
                                        : 'bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    {aval.tipo_avaliador === 'principal' ? 'Principal' : 'Apoio'} (
                                    {Math.round(Number(aval.peso) * 100)}%)
                                  </Badge>
                                </td>
                                <td className="py-3 text-center">
                                  {aval.status === 'concluida' ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]"
                                    >
                                      Concluída
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]"
                                    >
                                      Pendente
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-3 text-center font-bold text-[#0D47A1]">
                                  {aval.nota_final !== undefined && aval.status === 'concluida'
                                    ? Number(aval.nota_final).toFixed(1)
                                    : '—'}
                                </td>
                                <td className="py-3 pr-4 text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={async () => {
                                      if (confirm('Deseja remover este vínculo avaliativo?')) {
                                        await avaliacaoService.deleteAvaliacao(aval.id)
                                        setAvaliacoes((prev) =>
                                          prev.filter((a) => a.id !== aval.id),
                                        )
                                      }
                                    }}
                                    className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* =========================================================================
            ABA 4: RELATÓRIOS & RANKING DE PERFORMANCE COM DELTA
        ========================================================================= */}
        <TabsContent value="relatorios" className="space-y-6">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#0D47A1]" />
                    Relatório Geral de Desempenho e Deltas
                  </CardTitle>
                  <CardDescription className="text-xs text-[#757575]">
                    Classificação ordenada por nota final decrescente com filtro por departamento.
                  </CardDescription>
                </div>

                {/* Filtros do Relatório */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Ciclo */}
                  <Select value={cicloRelatorioId} onValueChange={setCicloRelatorioId}>
                    <SelectTrigger className="w-48 h-8 text-xs border-[#E0E0E0] bg-white">
                      <SelectValue placeholder="Ciclo..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {ciclos.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Departamento */}
                  <Select value={filtroDeptoRelatorio} onValueChange={setFiltroDeptoRelatorio}>
                    <SelectTrigger className="w-40 h-8 text-xs border-[#E0E0E0] bg-white">
                      <SelectValue placeholder="Departamento..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="todos" className="text-xs">
                        Todos os Departamentos
                      </SelectItem>
                      {relatorioColaboradores.departamentos.map((d) => (
                        <SelectItem key={d} value={d} className="text-xs">
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Busca */}
                  <div className="relative w-44">
                    <Search className="h-3.5 w-3.5 text-[#9E9E9E] absolute left-2.5 top-2.5" />
                    <Input
                      value={buscaRelatorio}
                      onChange={(e) => setBuscaRelatorio(e.target.value)}
                      placeholder="Buscar colaborador..."
                      className="pl-8 text-xs h-8 border-[#E0E0E0]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA] text-[#757575] font-semibold uppercase text-[10px]">
                      <th className="py-3 pl-4 text-center w-12">#</th>
                      <th className="py-3">Colaborador</th>
                      <th className="py-3">Departamento / Cargo</th>
                      <th className="py-3 text-center">Nota Esperada</th>
                      <th className="py-3 text-center">Nota Final (1-5)</th>
                      <th className="py-3 text-center">Resultado %</th>
                      <th className="py-3 text-center">Delta Performance</th>
                      <th className="py-3 pr-4 text-center">Avaliadores</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F5]">
                    {relatorioColaboradores.dados.map((item, idx) => {
                      const deltaPositivo = item.delta > 0
                      const deltaNeutro = item.delta === 0

                      return (
                        <tr
                          key={item.colaborador.id}
                          className="hover:bg-[#FAFAFA] transition-colors"
                        >
                          <td className="py-3 pl-4 text-center font-bold text-[#757575]">
                            {idx + 1}º
                          </td>

                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 border border-[#E0E0E0]">
                                <AvatarImage
                                  src={item.colaborador.foto_url}
                                  alt={item.colaborador.nome}
                                />
                                <AvatarFallback className="bg-[#E8EEF7] text-[#0D47A1] font-bold text-xs">
                                  {item.colaborador.nome.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-[#212121]">{item.colaborador.nome}</p>
                                <p className="text-[11px] text-[#757575]">
                                  {item.colaborador.email || '—'}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3">
                            <p className="font-semibold text-[#212121]">
                              {item.colaborador.departamento || 'Geral'}
                            </p>
                            <p className="text-[11px] text-[#757575]">
                              {item.colaborador.cargo || '—'}
                            </p>
                          </td>

                          <td className="py-3 text-center text-[#616161] font-semibold">
                            {item.notaEsperada.toFixed(1)}
                          </td>

                          <td className="py-3 text-center">
                            {item.possuiConcluida ? (
                              <span className="text-sm font-extrabold text-[#0D47A1]">
                                {item.notaFinal.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#9E9E9E]">Pendente</span>
                            )}
                          </td>

                          <td className="py-3 text-center">
                            {item.possuiConcluida ? (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-[#0D47A1] border-[#0D47A1]/20 font-bold"
                              >
                                {item.percentual}%
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-[#9E9E9E]">—</span>
                            )}
                          </td>

                          <td className="py-3 text-center">
                            {item.possuiConcluida ? (
                              <span
                                className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs border ${
                                  deltaPositivo
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : deltaNeutro
                                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                                      : 'bg-rose-50 text-rose-700 border-rose-300'
                                }`}
                              >
                                {deltaPositivo ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : deltaNeutro ? (
                                  <Minus className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {item.delta > 0
                                  ? `+${item.delta.toFixed(1)}`
                                  : item.delta.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#9E9E9E]">—</span>
                            )}
                          </td>

                          <td className="py-3 pr-4 text-center text-xs text-[#757575]">
                            {item.totalAvaliadores} vinculado(s)
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
