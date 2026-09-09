import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users,
  Award,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Star,
  MessageSquare,
  AlertCircle,
  Loader2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { avaliacaoService } from '@/services/avaliacaoService'
import { colaboradorService } from '@/services/api'
import {
  CicloAvaliacao,
  Avaliacao,
  Colaborador,
  Competencia,
  NotaCompetencia,
  CICLO_STATUS_CONFIG,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

interface ColaboradorEquipeItem {
  colaborador: Colaborador
  avaliacao?: Avaliacao
  statusAvaliacao: 'pendente' | 'concluida' | 'sem_designacao'
  notaFinal?: number
  tipoAvaliador?: 'principal' | 'apoio'
  peso?: number
}

export default function MinhaEquipePage() {
  const { user, colaborador: gestorColab } = useAuth()
  const { toast } = useToast()
  const tenantId = user?.tenant_id
  const gestorId = gestorColab?.id

  const [loading, setLoading] = useState(true)
  const [ciclos, setCiclos] = useState<CicloAvaliacao[]>([])
  const [cicloAtivo, setCicloAtivo] = useState<CicloAvaliacao | null>(null)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [avaliacoesCiclo, setAvaliacoesCiclo] = useState<Avaliacao[]>([])
  const [competencias, setCompetencias] = useState<Competencia[]>([])

  // Busca e filtro
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modal de Avaliação
  const [modalOpen, setModalOpen] = useState(false)
  const [avaliandoItem, setAvaliandoItem] = useState<ColaboradorEquipeItem | null>(null)
  const [notasForm, setNotasForm] = useState<Record<string, number>>({})
  const [comentariosCompForm, setComentariosCompForm] = useState<Record<string, string>>({})
  const [comentarioGeral, setComentarioGeral] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [carregandoNotasExistentes, setCarregandoNotasExistentes] = useState(false)

  const carregarDados = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [todosCiclos, todosColabs, todasCompetencias] = await Promise.all([
        avaliacaoService.getCiclos(tenantId),
        colaboradorService.getColaboradores(tenantId),
        avaliacaoService.getCompetencias(tenantId),
      ])

      setCiclos(todosCiclos)
      setColaboradores(todosColabs)
      setCompetencias(todasCompetencias)

      // Seleciona ciclo em andamento ou o primeiro
      const emAndamento = todosCiclos.find((c) => c.status === 'em_andamento')
      const cicloPadrao = emAndamento || todosCiclos[0] || null
      setCicloAtivo(cicloPadrao)

      if (cicloPadrao) {
        const avals = await avaliacaoService.getAvaliacoesPorCiclo(cicloPadrao.id)
        setAvaliacoesCiclo(avals)
      }
    } catch (err) {
      console.error('Erro ao carregar dados da equipe:', err)
      toast({
        title: 'Erro ao carregar equipe',
        description: 'Não foi possível carregar as informações do ciclo e colaboradores.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Quando o gestor troca o ciclo no seletor
  const handleTrocaCiclo = async (cicloId: string) => {
    const escolhido = ciclos.find((c) => c.id === cicloId) || null
    setCicloAtivo(escolhido)
    if (escolhido) {
      try {
        const avals = await avaliacaoService.getAvaliacoesPorCiclo(escolhido.id)
        setAvaliacoesCiclo(avals)
      } catch (err) {
        console.error('Erro ao buscar avaliações do ciclo:', err)
      }
    }
  }

  // Lista consolidada de membros da equipe no ciclo atual
  const equipeLista = useMemo<ColaboradorEquipeItem[]>(() => {
    // Para gestores: listar colaboradores do mesmo departamento ou que tenham avaliação com o gestor
    // Se o gestor não tiver departamento estrito ou for RH/Admin, exibe todos os colaboradores ativos do tenant
    const colabsFiltrados = colaboradores.filter((c) => {
      if (c.status !== 'ativo') return false
      // Se tiver vínculo direto com o gestor
      const temAvaliacaoComigo = avaliacoesCiclo.some(
        (a) => a.colaborador_id === c.id && a.avaliador_id === gestorId,
      )
      if (temAvaliacaoComigo) return true

      if (user?.perfil === 'admin' || user?.perfil === 'rh') return true
      if (gestorColab?.departamento && c.departamento === gestorColab.departamento) return true
      return false
    })

    return colabsFiltrados.map((colab) => {
      // Avaliação atribuída a este gestor para este colaborador
      const minhaAval = avaliacoesCiclo.find(
        (a) => a.colaborador_id === colab.id && (a.avaliador_id === gestorId || !gestorId),
      )
      // Ou qualquer avaliação do colaborador no ciclo
      const qualquerAval = minhaAval || avaliacoesCiclo.find((a) => a.colaborador_id === colab.id)

      let statusAval: 'pendente' | 'concluida' | 'sem_designacao' = 'sem_designacao'
      if (qualquerAval) {
        statusAval = qualquerAval.status === 'concluida' ? 'concluida' : 'pendente'
      }

      return {
        colaborador: colab,
        avaliacao: qualquerAval,
        statusAvaliacao: statusAval,
        notaFinal: qualquerAval?.nota_final,
        tipoAvaliador: qualquerAval?.tipo_avaliador,
        peso: qualquerAval ? Number(qualquerAval.peso) : undefined,
      }
    })
  }, [colaboradores, avaliacoesCiclo, gestorId, user?.perfil, gestorColab?.departamento])

  // Filtragem por busca e status
  const equipeFiltrada = useMemo(() => {
    return equipeLista.filter((item) => {
      const matchBusca =
        item.colaborador.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (item.colaborador.cargo &&
          item.colaborador.cargo.toLowerCase().includes(busca.toLowerCase())) ||
        (item.colaborador.departamento &&
          item.colaborador.departamento.toLowerCase().includes(busca.toLowerCase()))

      const matchStatus = filtroStatus === 'todos' ? true : item.statusAvaliacao === filtroStatus

      return matchBusca && matchStatus
    })
  }, [equipeLista, busca, filtroStatus])

  // Abrir modal de avaliação para um colaborador
  const handleAbrirAvaliacao = async (item: ColaboradorEquipeItem) => {
    setAvaliandoItem(item)
    setComentarioGeral(item.avaliacao?.comentario || '')

    // Inicializa notas com 4.0 por padrão ou carrega existentes
    const notasIniciais: Record<string, number> = {}
    const comentariosIniciais: Record<string, string> = {}
    competencias.forEach((comp) => {
      notasIniciais[comp.id] = Number(comp.nota_esperada) || 4.0
      comentariosIniciais[comp.id] = ''
    })

    if (item.avaliacao?.id) {
      try {
        setCarregandoNotasExistentes(true)
        const notasExistentes = await avaliacaoService.getNotasPorAvaliacao(item.avaliacao.id)
        notasExistentes.forEach((n) => {
          notasIniciais[n.competencia_id] = Number(n.nota)
          comentariosIniciais[n.competencia_id] = n.comentario || ''
        })
      } catch (err) {
        console.error('Erro ao buscar notas existentes:', err)
      } finally {
        setCarregandoNotasExistentes(false)
      }
    }

    setNotasForm(notasIniciais)
    setComentariosCompForm(comentariosIniciais)
    setModalOpen(true)
  }

  // Submeter avaliação
  const handleSalvarAvaliacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!avaliandoItem || !cicloAtivo) return

    try {
      setSalvando(true)

      let avaliacaoId = avaliandoItem.avaliacao?.id

      // Se ainda não existia registro em 'avaliacao' (ex: criada sob demanda)
      if (!avaliacaoId) {
        const novaAval = await avaliacaoService.createAvaliacao({
          ciclo_id: cicloAtivo.id,
          colaborador_id: avaliandoItem.colaborador.id,
          avaliador_id: gestorId || avaliandoItem.colaborador.id,
          tipo_avaliador: 'principal',
          peso: 0.6,
        })
        avaliacaoId = novaAval.id
      }

      // Montar array de notas por competência
      const arrayNotas = competencias.map((comp) => ({
        competencia_id: comp.id,
        nota: Number(notasForm[comp.id] || 4.0),
        comentario: comentariosCompForm[comp.id] || '',
      }))

      await avaliacaoService.salvarNotasAvaliacao(avaliacaoId, arrayNotas, comentarioGeral)

      toast({
        title: 'Avaliação concluída com sucesso',
        description: `A avaliação de ${avaliandoItem.colaborador.nome} foi finalizada e registrada.`,
      })

      setModalOpen(false)
      // Recarregar avaliações do ciclo
      const atualizadas = await avaliacaoService.getAvaliacoesPorCiclo(cicloAtivo.id)
      setAvaliacoesCiclo(atualizadas)
    } catch (err: unknown) {
      console.error('Erro ao salvar avaliação:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao registrar a avaliação.'
      toast({
        title: 'Erro ao salvar avaliação',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Média dinâmica calculada no formulário
  const mediaFormulario = useMemo(() => {
    const chaves = Object.keys(notasForm)
    if (chaves.length === 0) return 0
    const soma = chaves.reduce((acc, curr) => acc + (Number(notasForm[curr]) || 0), 0)
    return Math.round((soma / chaves.length) * 10) / 10
  }, [notasForm])

  // Contadores para os KPIs superiores
  const kpis = useMemo(() => {
    const total = equipeLista.length
    const concluidas = equipeLista.filter((i) => i.statusAvaliacao === 'concluida').length
    const pendentes = equipeLista.filter((i) => i.statusAvaliacao === 'pendente').length
    const semDesignacao = equipeLista.filter((i) => i.statusAvaliacao === 'sem_designacao').length
    const taxaConclusao = total > 0 ? Math.round((concluidas / total) * 100) : 0

    return { total, concluidas, pendentes, semDesignacao, taxaConclusao }
  }, [equipeLista])

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Minha Equipe — Avaliação de Desempenho
              </h1>
              <p className="text-xs text-[#757575] mt-0.5">
                Acompanhe o status das avaliações do seu time e realize o feedback por competências.
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de Ciclo */}
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold text-[#616161] whitespace-nowrap">
            Ciclo Avaliativo:
          </Label>
          <Select
            value={cicloAtivo?.id || ''}
            onValueChange={handleTrocaCiclo}
            disabled={ciclos.length === 0}
          >
            <SelectTrigger className="w-[280px] bg-white border-[#E0E0E0] text-xs h-9">
              <SelectValue placeholder="Selecione um ciclo..." />
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
      </div>

      {/* 2. Cards de KPIs de Conclusão da Equipe */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#E0E0E0] bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#757575]">
            Membros da Equipe
          </span>
          <div className="text-2xl font-extrabold text-[#212121] mt-1">{kpis.total}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Colaboradores ativos</p>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-3.5 shadow-2xs border-l-4 border-l-[#2E7D32]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#2E7D32]">
            Avaliações Concluídas
          </span>
          <div className="text-2xl font-extrabold text-[#2E7D32] mt-1">{kpis.concluidas}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">{kpis.taxaConclusao}% de conclusão</p>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-3.5 shadow-2xs border-l-4 border-l-[#0D47A1]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D47A1]">
            Pendentes de Avaliação
          </span>
          <div className="text-2xl font-extrabold text-[#0D47A1] mt-1">{kpis.pendentes}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Aguardando preenchimento</p>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-3.5 shadow-2xs border-l-4 border-l-slate-400">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Sem Vínculo no Ciclo
          </span>
          <div className="text-2xl font-extrabold text-[#616161] mt-1">{kpis.semDesignacao}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Aguardando RH</p>
        </div>
      </div>

      {/* 3. Tabela de Membros da Equipe */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs">
        <CardHeader className="pb-3 border-b border-[#F0F0F0]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-[#212121]">
                Colaboradores da Equipe
              </CardTitle>
              <CardDescription className="text-xs text-[#757575]">
                Ciclo Selecionado: {cicloAtivo ? cicloAtivo.nome : 'Nenhum ciclo ativo'}
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

              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-36 h-8 text-xs border-[#E0E0E0] bg-white">
                  <SelectValue placeholder="Status..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="todos" className="text-xs">
                    Todos os status
                  </SelectItem>
                  <SelectItem value="pendente" className="text-xs">
                    Pendente
                  </SelectItem>
                  <SelectItem value="concluida" className="text-xs">
                    Concluída
                  </SelectItem>
                  <SelectItem value="sem_designacao" className="text-xs">
                    Sem Designação
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-slate-100" />
              ))}
            </div>
          ) : equipeFiltrada.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#757575]">
              Nenhum colaborador encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA] text-[#757575] font-semibold uppercase text-[10px]">
                    <th className="py-3 pl-4">Colaborador</th>
                    <th className="py-3">Cargo / Depto</th>
                    <th className="py-3 text-center">Tipo Avaliador</th>
                    <th className="py-3 text-center">Status Avaliação</th>
                    <th className="py-3 text-center">Nota Final</th>
                    <th className="py-3 pr-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5]">
                  {equipeFiltrada.map((item) => {
                    const c = item.colaborador
                    const aval = item.avaliacao
                    const statusAval = item.statusAvaliacao

                    return (
                      <tr key={c.id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3 pl-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-[#E0E0E0]">
                              <AvatarImage src={c.foto_url} alt={c.nome} />
                              <AvatarFallback className="bg-[#E8EEF7] text-[#0D47A1] font-bold text-xs">
                                {c.nome.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-bold text-[#212121] text-xs leading-tight">
                                {c.nome}
                              </p>
                              <p className="text-[11px] text-[#757575]">{c.email || '—'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3">
                          <p className="font-semibold text-[#212121]">
                            {c.cargo || 'Não informado'}
                          </p>
                          <p className="text-[11px] text-[#757575]">{c.departamento || 'Geral'}</p>
                        </td>

                        <td className="py-3 text-center">
                          {item.tipoAvaliador ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                item.tipoAvaliador === 'principal'
                                  ? 'bg-blue-50 text-[#0D47A1] border-[#0D47A1]/30 font-bold'
                                  : 'bg-slate-50 text-slate-700'
                              }`}
                            >
                              {item.tipoAvaliador === 'principal' ? 'Principal (60%)' : 'Apoio'}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-[#9E9E9E]">—</span>
                          )}
                        </td>

                        <td className="py-3 text-center">
                          {statusAval === 'concluida' && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-semibold"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Concluída
                            </Badge>
                          )}
                          {statusAval === 'pendente' && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] font-semibold"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                          {statusAval === 'sem_designacao' && (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]"
                            >
                              Não vinculado
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 text-center">
                          {item.notaFinal !== undefined && statusAval === 'concluida' ? (
                            <span className="text-xs font-extrabold text-[#0D47A1]">
                              {Number(item.notaFinal).toFixed(1)} / 5.0
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#9E9E9E]">—</span>
                          )}
                        </td>

                        <td className="py-3 pr-4 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleAbrirAvaliacao(item)}
                            className={`h-8 text-xs font-semibold gap-1.5 ${
                              statusAval === 'pendente'
                                ? 'bg-[#0D47A1] hover:bg-[#0A3A82] text-white'
                                : 'bg-white hover:bg-[#F5F5F5] text-[#0D47A1] border border-[#0D47A1]/30'
                            }`}
                          >
                            <Star className="h-3.5 w-3.5" />
                            {statusAval === 'concluida' ? 'Revisar Nota' : 'Avaliar'}
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

      {/* 4. Modal de Avaliação por Competências (Slider/Input 1 a 5 + Comentário) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl bg-white border border-[#E0E0E0] p-6 max-h-[90vh] flex flex-col">
          <DialogHeader className="text-left space-y-1 pb-3 border-b border-[#E0E0E0]">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                <Star className="h-4 w-4 text-[#0D47A1]" />
                Avaliação de Desempenho — {avaliandoItem?.colaborador.nome}
              </DialogTitle>
              <Badge
                variant="outline"
                className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-xs font-bold"
              >
                Média Parcial: {mediaFormulario.toFixed(1)} / 5.0
              </Badge>
            </div>
            <DialogDescription className="text-xs text-[#757575]">
              Atribua uma nota de 1.0 a 5.0 para cada competência exigida no cargo de{' '}
              <strong>{avaliandoItem?.colaborador.cargo || 'Colaborador'}</strong>.
            </DialogDescription>
          </DialogHeader>

          {carregandoNotasExistentes ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-10 w-full bg-slate-100" />
              <Skeleton className="h-10 w-full bg-slate-100" />
              <Skeleton className="h-10 w-full bg-slate-100" />
            </div>
          ) : (
            <form
              onSubmit={handleSalvarAvaliacao}
              className="flex-1 overflow-y-auto pr-1 py-4 space-y-5"
            >
              {/* Lista de Competências */}
              <div className="space-y-4">
                {competencias.map((comp) => {
                  const valorAtual = Number(notasForm[comp.id] ?? 4.0)

                  return (
                    <div
                      key={comp.id}
                      className="rounded-xl border border-[#E0E0E0] p-4 bg-[#FAFAFA] space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#212121]">{comp.nome}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-white text-[#616161]"
                            >
                              {comp.tipo === 'geral' ? 'Geral' : 'Específica'} • Peso {comp.peso}%
                            </Badge>
                          </div>
                          {comp.descricao && (
                            <p className="text-[11px] text-[#757575] mt-0.5">{comp.descricao}</p>
                          )}
                        </div>

                        {/* Indicador Numérico da Nota */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-[#757575]">Nota:</span>
                          <span className="text-sm font-extrabold text-[#0D47A1] bg-white px-2.5 py-1 rounded border border-[#0D47A1]/30">
                            {valorAtual.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      {/* Slider de 1.0 a 5.0 com passo 0.1 ou 0.5 */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-[#757575] font-bold">1.0</span>
                          <input
                            type="range"
                            min="1.0"
                            max="5.0"
                            step="0.1"
                            value={valorAtual}
                            onChange={(e) =>
                              setNotasForm((prev) => ({
                                ...prev,
                                [comp.id]: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full accent-[#0D47A1] cursor-pointer"
                          />
                          <span className="text-[10px] text-[#757575] font-bold">5.0</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-[#9E9E9E] px-1">
                          <span>Abaixo do esperado</span>
                          <span>Atende expectativas</span>
                          <span>Supera expectativas</span>
                        </div>
                      </div>

                      {/* Comentário opcional da competência */}
                      <div className="pt-1">
                        <Input
                          placeholder="Evidência ou feedback pontual para esta competência (opcional)..."
                          value={comentariosCompForm[comp.id] || ''}
                          onChange={(e) =>
                            setComentariosCompForm((prev) => ({
                              ...prev,
                              [comp.id]: e.target.value,
                            }))
                          }
                          className="text-xs h-8 bg-white border-[#E0E0E0]"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Comentário Geral do Avaliador */}
              <div className="space-y-1.5 pt-2 border-t border-[#E0E0E0]">
                <Label
                  htmlFor="comentarioGeral"
                  className="text-xs font-bold text-[#212121] flex items-center gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#0D47A1]" />
                  Comentário e Feedback Geral do Avaliador
                </Label>
                <Textarea
                  id="comentarioGeral"
                  rows={3}
                  value={comentarioGeral}
                  onChange={(e) => setComentarioGeral(e.target.value)}
                  placeholder="Descreva pontos fortes observados no ciclo, entregas de destaque e áreas para desenvolvimento..."
                  className="text-xs bg-white border-[#E0E0E0]"
                />
              </div>

              {/* Rodapé e Botões */}
              <div className="pt-3 border-t border-[#E0E0E0] flex items-center justify-between">
                <div className="text-xs text-[#757575]">
                  Fórmula: Média Ponderada = <strong>{mediaFormulario.toFixed(1)}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalOpen(false)}
                    disabled={salvando}
                    className="h-9 text-xs border-[#E0E0E0]"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={salvando}
                    className="h-9 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white gap-1.5 min-w-[120px]"
                  >
                    {salvando ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Finalizando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Finalizar Avaliação
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
