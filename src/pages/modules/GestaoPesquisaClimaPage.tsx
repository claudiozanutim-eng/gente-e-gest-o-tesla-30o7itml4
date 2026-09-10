import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  HeartHandshake,
  BarChart3,
  Users,
  CheckCircle2,
  Calendar,
  Plus,
  FileDown,
  RefreshCw,
  Star,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Clock,
  Send,
  PieChart as PieIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { colaboradorService } from '@/services/api'
import { PesquisaClima, PesquisaClimaResposta, PesquisaClimaEscala, Colaborador } from '@/types'
import { pesquisaClimaService, EstatisticasPesquisaClima } from '@/services/pesquisaClimaService'
import { exportToExcel, exportToPdf, ColumnDefinition } from '@/lib/exportReports'

export const GestaoPesquisaClimaPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [pesquisas, setPesquisas] = useState<PesquisaClima[]>([])
  const [pesquisaSelecionadaId, setPesquisaSelecionadaId] = useState<string>('')
  const [respostas, setRespostas] = useState<PesquisaClimaResposta[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)

  // Modal de Criação de Pesquisa
  const [modalNovaAberto, setModalNovaAberto] = useState(false)
  const [formPergunta, setFormPergunta] = useState('')
  const [formEscala, setFormEscala] = useState<PesquisaClimaEscala>('1-5')
  const [formDataInicio, setFormDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [formDataFim, setFormDataFim] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  )
  const [salvando, setSalvando] = useState(false)

  // Regras de perfil
  const perfil = user?.perfil
  const isAdminOrRH = perfil === 'admin_rh' || perfil === 'admin'
  const isRH = perfil === 'rh' || isAdminOrRH

  const carregarDados = useCallback(async () => {
    if (!user?.tenant_id) return
    setLoading(true)
    try {
      const [listPesquisas, listColabs] = await Promise.all([
        pesquisaClimaService.getPesquisasTenant(user.tenant_id),
        colaboradorService.getColaboradores(user.tenant_id),
      ])

      setPesquisas(listPesquisas)
      setColaboradores(listColabs)

      let pId = pesquisaSelecionadaId
      if (!pId || !listPesquisas.some((p) => p.id === pId)) {
        pId = listPesquisas[0]?.id || ''
        setPesquisaSelecionadaId(pId)
      }

      if (pId) {
        const respList = await pesquisaClimaService.getRespostasPesquisa(user.tenant_id, pId)
        setRespostas(respList)
      } else {
        setRespostas([])
      }
    } catch (err) {
      console.error('Erro ao carregar dados de pesquisas de clima:', err)
      toast({
        title: 'Erro de comunicação',
        description: 'Não foi possível carregar as pesquisas de clima.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user?.tenant_id, pesquisaSelecionadaId, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Trata troca de pesquisa ativa
  const handleSelecionarPesquisa = async (id: string) => {
    setPesquisaSelecionadaId(id)
    if (!user?.tenant_id) return
    try {
      const respList = await pesquisaClimaService.getRespostasPesquisa(user.tenant_id, id)
      setRespostas(respList)
    } catch (err) {
      console.warn('Erro ao buscar respostas da pesquisa:', err)
    }
  }

  const pesquisaAtual = useMemo(() => {
    return pesquisas.find((p) => p.id === pesquisaSelecionadaId) || null
  }, [pesquisas, pesquisaSelecionadaId])

  // Estatísticas calculadas
  const estatisticas: EstatisticasPesquisaClima = useMemo(() => {
    const totalElegiveis = colaboradores.filter((c) => c.status === 'ativo').length
    return pesquisaClimaService.calcularEstatisticas(
      respostas,
      totalElegiveis,
      pesquisaAtual?.escala || '1-5',
    )
  }, [respostas, colaboradores, pesquisaAtual?.escala])

  // Salvar nova pesquisa
  const handleCriarPesquisa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.tenant_id || !formPergunta.trim()) {
      toast({
        title: 'Pergunta obrigatória',
        description: 'Insira a pergunta da enquete de clima.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const nova = await pesquisaClimaService.criarPesquisa({
        tenantId: user.tenant_id,
        pergunta: formPergunta.trim(),
        escala: formEscala,
        dataInicio: formDataInicio,
        dataFim: formDataFim,
        status: 'ativa',
        userId: user.id,
      })

      toast({
        title: 'Pesquisa de clima criada',
        description: 'A nova enquete já está disponível no Portal do Colaborador.',
      })

      setModalNovaAberto(false)
      setFormPergunta('')
      setPesquisaSelecionadaId(nova.id)
      await carregarDados()
    } catch (err) {
      console.error('Erro ao criar pesquisa de clima:', err)
      toast({
        title: 'Erro ao cadastrar',
        description: 'Não foi possível criar a pesquisa. Verifique suas permissões.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Encerrar pesquisa
  const handleEncerrarPesquisa = async () => {
    if (!pesquisaAtual || !user?.tenant_id) return
    try {
      await pesquisaClimaService.atualizarStatusPesquisa(
        pesquisaAtual.id,
        'encerrada',
        user.tenant_id,
        user.id,
      )
      toast({
        title: 'Pesquisa encerrada',
        description: 'A pesquisa não receberá novas respostas no Portal do Colaborador.',
      })
      await carregarDados()
    } catch (err) {
      console.error('Erro ao encerrar pesquisa:', err)
      toast({
        title: 'Erro ao atualizar status',
        description: 'Não foi possível alterar o status da pesquisa.',
        variant: 'destructive',
      })
    }
  }

  // Exportar Relatório em PDF / Excel
  const colunasExportacao: ColumnDefinition[] = useMemo(() => {
    const cols: ColumnDefinition[] = [
      { header: 'Nota', key: 'nota', width: 25 },
      { header: 'Comentário', key: 'comentario', width: 140 },
      { header: 'Data do Envio', key: 'created', width: 35 },
    ]

    // Apenas admin_rh e admin visualizam o nome do colaborador
    if (isAdminOrRH) {
      cols.unshift(
        { header: 'Colaborador', key: 'colaborador_nome', width: 60 },
        { header: 'Departamento', key: 'colaborador_depto', width: 45 },
      )
    }

    return cols
  }, [isAdminOrRH])

  const dadosExportacao = useMemo(() => {
    return respostas.map((r) => ({
      colaborador_nome:
        r.expand?.colaborador_id?.nome_completo || r.expand?.colaborador_id?.nome || '—',
      colaborador_depto: r.expand?.colaborador_id?.departamento || '—',
      nota: `${r.nota} / ${pesquisaAtual?.escala === '1-10' ? '10' : '5'}`,
      comentario: r.comentario || '(Sem comentário)',
      created: new Date(r.created).toLocaleDateString('pt-BR'),
    }))
  }, [respostas, pesquisaAtual?.escala])

  const handleExportar = async (tipo: 'pdf' | 'excel') => {
    if (!pesquisaAtual) return
    const titulo = `Pesquisa de Clima - ${pesquisaAtual.pergunta.slice(0, 45)}`

    if (tipo === 'pdf') {
      await exportToPdf({
        reportTitle: titulo,
        filePrefix: 'PesquisaClima',
        columns: colunasExportacao,
        data: dadosExportacao,
      })
    } else {
      await exportToExcel({
        reportTitle: titulo,
        filePrefix: 'PesquisaClima',
        columns: colunasExportacao,
        data: dadosExportacao,
      })
    }

    toast({
      title: 'Exportação concluída',
      description: `Arquivo ${tipo.toUpperCase()} gerado no padrão corporativo Tesla.`,
    })
  }

  // Cores do gráfico de notas
  const coresBarras = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#0D47A1']

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-16">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100/70 text-[#0D47A1] rounded-xl shadow-xs">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Pesquisa de Clima Organizacional
              </h1>
              <Badge
                variant="outline"
                className="border-blue-300 text-[#0D47A1] bg-blue-50 font-bold text-xs"
              >
                Gestão &amp; Liderança
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Acompanhamento de satisfação, engajamento e percepção do ambiente de trabalho pelos
              colaboradores.
            </p>
          </div>
        </div>

        {/* Ações do Topo */}
        <div className="flex flex-wrap items-center gap-2.5">
          {pesquisas.length > 0 && (
            <Select value={pesquisaSelecionadaId} onValueChange={handleSelecionarPesquisa}>
              <SelectTrigger className="h-9 w-64 text-xs font-semibold bg-white border-slate-300">
                <SelectValue placeholder="Selecione a pesquisa" />
              </SelectTrigger>
              <SelectContent>
                {pesquisas.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.pergunta.slice(0, 45)}... ({p.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isRH && (
            <Button
              size="sm"
              onClick={() => setModalNovaAberto(true)}
              className="h-9 gap-1.5 bg-[#0D47A1] hover:bg-[#0b3c8a] text-white font-semibold text-xs shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Nova Pesquisa
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={carregarDados}
            disabled={loading}
            className="h-9 w-9 text-slate-600 hover:text-[#0D47A1]"
            title="Recarregar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : !pesquisaAtual ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <HeartHandshake className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            Nenhuma pesquisa de clima cadastrada
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Crie sua primeira enquete de clima para coletar feedbacks anônimos ou identificados da
            equipe.
          </p>
          {isRH && (
            <Button
              onClick={() => setModalNovaAberto(true)}
              className="mt-4 text-xs bg-[#0D47A1] text-white hover:bg-[#0b3c8a]"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Criar Pesquisa de Clima
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Pergunta e Status Ativo */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Pergunta da Pesquisa
                </span>
                <CardTitle className="text-lg font-extrabold text-[#0D47A1] mt-1">
                  &quot;{pesquisaAtual.pergunta}&quot;
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-1">
                  Vigência: {new Date(pesquisaAtual.data_inicio).toLocaleDateString('pt-BR')} até{' '}
                  {new Date(pesquisaAtual.data_fim).toLocaleDateString('pt-BR')} • Escala:{' '}
                  {pesquisaAtual.escala}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  className={`text-xs font-bold px-2.5 py-0.5 ${
                    pesquisaAtual.status === 'ativa'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {pesquisaAtual.status === 'ativa' ? 'Ativa no Portal' : 'Encerrada'}
                </Badge>

                {isRH && pesquisaAtual.status === 'ativa' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEncerrarPesquisa}
                    className="h-8 text-xs text-rose-700 border-rose-300 hover:bg-rose-50 font-semibold"
                  >
                    Encerrar Enquete
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* 3 Cards de Indicadores Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Média Geral */}
            <Card className="border border-blue-200 bg-blue-50/40 shadow-xs">
              <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0D47A1]">
                  Média Geral
                </span>
                <div className="h-9 w-9 rounded-full bg-blue-100 text-[#0D47A1] flex items-center justify-center">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="text-3xl font-black text-[#0D47A1] font-mono">
                  {estatisticas.mediaGeral.toFixed(2)}
                  <span className="text-sm font-normal text-slate-500 ml-1.5">
                    / {pesquisaAtual.escala === '1-10' ? '10' : '5'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Índice global de satisfação apurado</p>
              </CardContent>
            </Card>

            {/* Card 2: Taxa de Participação */}
            <Card className="border border-emerald-200 bg-emerald-50/40 shadow-xs">
              <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Taxa de Participação
                </span>
                <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="text-3xl font-black text-emerald-700 font-mono">
                  {estatisticas.taxaParticipacaoPct}%
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {estatisticas.totalRespostas} de {estatisticas.totalColaboradoresElegiveis}{' '}
                  colaboradores responderam
                </p>
              </CardContent>
            </Card>

            {/* Card 3: Total de Comentários / Feedbacks */}
            <Card className="border border-slate-200 bg-white shadow-xs">
              <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Feedbacks Descritivos
                </span>
                <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="text-3xl font-black text-slate-900 font-mono">
                  {respostas.filter((r) => !!r.comentario?.trim()).length}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Colaboradores incluíram comentários voluntários
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Distribuição por Nota */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#0D47A1]" />
                  Distribuição de Notas dos Respondentes
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Frequência absoluta e percentual por faixa de nota na escala avaliada
                </CardDescription>
              </div>

              {/* Botões de Exportação */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportar('excel')}
                  disabled={respostas.length === 0}
                  className="h-8 gap-1 text-xs border-slate-300 text-slate-700 hover:text-[#0D47A1]"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Excel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleExportar('pdf')}
                  disabled={respostas.length === 0}
                  className="h-8 gap-1 text-xs bg-[#0D47A1] hover:bg-[#0b3c8a] text-white"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF Corporativo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {respostas.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                  Nenhuma resposta registrada para esta pesquisa até o momento.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={estatisticas.distribuicaoNotas}
                      margin={{ top: 15, right: 10, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <RechartsTooltip
                        formatter={(val: any, _name: any, item: any) => [
                          `${val} colaboradores (${item.payload.percentual}%)`,
                          'Respostas',
                        ]}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderColor: '#e2e8f0',
                          fontSize: '12px',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                      <Bar dataKey="quantidade" name="Respondentes" radius={[6, 6, 0, 0]}>
                        {estatisticas.distribuicaoNotas.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={coresBarras[index % coresBarras.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela de Comentários / Feedbacks */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-[#0D47A1]" />
                  Respostas e Comentários Registrados
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  {isAdminOrRH
                    ? 'Identificação do colaborador visível apenas para admin_rh e admin do tenant.'
                    : 'Visão de comentários consolidados para liderança.'}
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-slate-300 text-xs font-semibold self-start sm:self-auto"
              >
                {respostas.length} resposta(s)
              </Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {respostas.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  Nenhuma resposta recebida para esta enquete.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                      {isAdminOrRH && <TableHead className="w-56">Colaborador</TableHead>}
                      <TableHead className="w-24 text-center">Nota</TableHead>
                      <TableHead>Comentário</TableHead>
                      <TableHead className="w-32 text-right">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {respostas.map((r) => {
                      const colab = r.expand?.colaborador_id
                      return (
                        <TableRow
                          key={r.id}
                          className="border-b border-slate-100 hover:bg-blue-50/20"
                        >
                          {isAdminOrRH && (
                            <TableCell className="text-xs font-medium text-slate-900">
                              <div>
                                <p className="font-bold">
                                  {colab?.nome_completo || colab?.nome || '—'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {colab?.departamento || 'Geral'} • {colab?.cargo || 'Colaborador'}
                                </p>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="text-center">
                            <span className="inline-flex items-center gap-1 font-black font-mono text-xs px-2 py-0.5 rounded bg-blue-50 text-[#0D47A1] border border-blue-200">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                              {r.nota}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 leading-relaxed">
                            {r.comentario ? (
                              <p className="italic bg-slate-50/80 p-2 rounded border border-slate-100 max-w-2xl">
                                &quot;{r.comentario}&quot;
                              </p>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                (Apenas nota, sem comentário)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-500 font-mono">
                            {new Date(r.created).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal de Criação de Pesquisa */}
      <Dialog open={modalNovaAberto} onOpenChange={setModalNovaAberto}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-[#0D47A1]" />
              Nova Pesquisa de Clima
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre uma enquete para mensurar a satisfação do time no Portal do Colaborador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarPesquisa} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="pergunta" className="text-xs font-bold text-slate-700">
                Pergunta da Enquete <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pergunta"
                required
                value={formPergunta}
                onChange={(e) => setFormPergunta(e.target.value)}
                placeholder="Ex: Como você avalia seu ambiente de trabalho na Tesla?"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="escala" className="text-xs font-semibold text-slate-700">
                Escala de Avaliação
              </Label>
              <Select
                value={formEscala}
                onValueChange={(val: PesquisaClimaEscala) => setFormEscala(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-5" className="text-xs">
                    Escala de 1 a 5 (Estrelas / Satisfação padrão)
                  </SelectItem>
                  <SelectItem value="1-10" className="text-xs">
                    Escala de 1 a 10 (NPS / Pontuação ampliada)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dtIni" className="text-xs font-semibold text-slate-700">
                  Data de Início <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dtIni"
                  type="date"
                  required
                  value={formDataInicio}
                  onChange={(e) => setFormDataInicio(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dtFim" className="text-xs font-semibold text-slate-700">
                  Data de Término <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dtFim"
                  type="date"
                  required
                  value={formDataFim}
                  onChange={(e) => setFormDataFim(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovaAberto(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando}
                className="bg-[#0D47A1] hover:bg-[#0b3c8a] text-white text-xs font-semibold"
              >
                {salvando ? 'Criando...' : 'Publicar Pesquisa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default GestaoPesquisaClimaPage
