import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Briefcase,
  Users,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Plus,
  RefreshCw,
  FileText,
  BadgeAlert,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { folhaService } from '@/services/folhaService'
import { Colaborador, LancamentoPeriodico, LancamentoPontual, ResumoFinanceiroMes } from '@/types'
import { formatMoedaPtBr } from '@/lib/exportReports'
import { DemonstrativoFinanceiroView } from '@/components/folha/DemonstrativoFinanceiroView'
import { ModalLancamentoPeriodico } from '@/components/folha/ModalLancamentoPeriodico'
import { ModalLancamentoPontual } from '@/components/folha/ModalLancamentoPontual'
import { ModalImportarLancamentos } from '@/components/folha/ModalImportarLancamentos'
import { FileSpreadsheet } from 'lucide-react'

const MESES = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
]

export const GestaoFolhaPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const agora = new Date()
  const defaultAno = agora.getFullYear() < 2026 ? 2026 : agora.getFullYear()
  const defaultMes = agora.getFullYear() < 2026 ? 9 : agora.getMonth() + 1

  const [ano, setAno] = useState<number>(defaultAno)
  const [mes, setMes] = useState<number>(defaultMes)
  const [busca, setBusca] = useState<string>('')
  const [filtroDepartamento, setFiltroDepartamento] = useState<string>('todos')

  const [loading, setLoading] = useState<boolean>(true)
  const [itensGestao, setItensGestao] = useState<
    Array<{
      colaborador: Colaborador
      resumo: ResumoFinanceiroMes
      periodicos: LancamentoPeriodico[]
      pontuais: LancamentoPontual[]
    }>
  >([])

  // Colaborador atualmente selecionado para edição detalhada
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<Colaborador | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0)

  // Modais de Criação e Edição
  const [modalPeriodicoAberto, setModalPeriodicoAberto] = useState(false)
  const [periodicoParaEditar, setPeriodicoParaEditar] = useState<LancamentoPeriodico | null>(null)

  const [modalPontualAberto, setModalPontualAberto] = useState(false)
  const [pontualParaEditar, setPontualParaEditar] = useState<LancamentoPontual | null>(null)

  const [modalImportacaoAberto, setModalImportacaoAberto] = useState(false)

  // Permissão para importar planilha: apenas admin_rh e admin
  const podeImportarPlanilha = useMemo(() => {
    return user?.perfil === 'admin_rh' || user?.perfil === 'admin'
  }, [user?.perfil])

  const carregarDadosGestao = useCallback(async () => {
    if (!user?.tenant_id) return
    setLoading(true)
    try {
      const data = await folhaService.getResumoGestaoFolha(user.tenant_id, ano, mes)
      setItensGestao(data)
    } catch (err) {
      console.error('Erro ao carregar gestão da folha:', err)
      toast({
        variant: 'destructive',
        title: 'Erro de comunicação',
        description: 'Não foi possível carregar os dados de folha do tenant.',
      })
    } finally {
      setLoading(false)
    }
  }, [user?.tenant_id, ano, mes, toast])

  useEffect(() => {
    carregarDadosGestao()
  }, [carregarDadosGestao, refreshTrigger])

  // Departamentos únicos para filtro
  const departamentos = useMemo(() => {
    const deps = new Set<string>()
    for (const item of itensGestao) {
      if (item.colaborador.departamento) {
        deps.add(item.colaborador.departamento)
      }
    }
    return Array.from(deps).sort()
  }, [itensGestao])

  // Itens filtrados
  const itensFiltrados = useMemo(() => {
    return itensGestao.filter((item) => {
      const nomeMatch =
        (item.colaborador.nome_completo || item.colaborador.nome)
          .toLowerCase()
          .includes(busca.toLowerCase()) ||
        item.colaborador.cpf.includes(busca) ||
        (item.colaborador.cargo || '').toLowerCase().includes(busca.toLowerCase())

      const deptoMatch =
        filtroDepartamento === 'todos' || item.colaborador.departamento === filtroDepartamento

      return nomeMatch && deptoMatch
    })
  }, [itensGestao, busca, filtroDepartamento])

  // Totalizadores gerais do tenant para o mês
  const totaisTenant = useMemo(() => {
    let proventos = 0
    let descontos = 0
    let liquido = 0

    for (const item of itensGestao) {
      proventos += item.resumo.totalProventos
      descontos += item.resumo.totalDescontos
      liquido += item.resumo.valorLiquido
    }

    return {
      proventos: Math.round(proventos * 100) / 100,
      descontos: Math.round(descontos * 100) / 100,
      liquido: Math.round(liquido * 100) / 100,
      totalColaboradores: itensGestao.length,
    }
  }, [itensGestao])

  // -------------------------------------------------------------------------
  // Handlers de Ações em Lançamentos (com Auditoria)
  // -------------------------------------------------------------------------

  const handleSalvarPeriodico = async (dados: {
    descritivo: string
    quantidade: number
    periodicidade: import('@/types').PeriodicidadeLancamento
    data_recorrencia: number
    data_inicio_vigencia: string
    data_fim_vigencia?: string | null
  }) => {
    if (!user || !colaboradorSelecionado) return

    if (periodicoParaEditar) {
      await folhaService.atualizarLancamentoPeriodico(
        periodicoParaEditar.id,
        dados,
        user.tenant_id,
        user.id,
      )
      toast({
        title: 'Lançamento atualizado',
        description: `O lançamento "${dados.descritivo}" foi alterado com sucesso.`,
      })
    } else {
      await folhaService.criarLancamentoPeriodico(
        {
          tenant_id: user.tenant_id,
          colaborador_id: colaboradorSelecionado.id,
          ...dados,
        },
        user.id,
      )
      toast({
        title: 'Lançamento periódico criado',
        description: `O lançamento "${dados.descritivo}" foi adicionado com sucesso.`,
      })
    }
    setPeriodicoParaEditar(null)
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleRemoverPeriodico = async (item: LancamentoPeriodico) => {
    if (!user) return
    await folhaService.removerLancamentoPeriodico(item.id, user.tenant_id, user.id, {
      descritivo: item.descritivo,
      colaborador_id: item.colaborador_id,
    })
    toast({
      title: 'Lançamento removido',
      description: `O lançamento periódico "${item.descritivo}" foi excluído.`,
    })
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleSalvarPontual = async (dados: {
    descritivo: string
    quantidade: number
    data: string
    comentario?: string
  }) => {
    if (!user || !colaboradorSelecionado) return

    if (pontualParaEditar) {
      await folhaService.atualizarLancamentoPontual(
        pontualParaEditar.id,
        dados,
        user.tenant_id,
        user.id,
      )
      toast({
        title: 'Lançamento atualizado',
        description: `O lançamento pontual "${dados.descritivo}" foi alterado com sucesso.`,
      })
    } else {
      await folhaService.criarLancamentoPontual(
        {
          tenant_id: user.tenant_id,
          colaborador_id: colaboradorSelecionado.id,
          ...dados,
        },
        user.id,
      )
      toast({
        title: 'Lançamento pontual criado',
        description: `O lançamento pontual "${dados.descritivo}" foi registrado com sucesso.`,
      })
    }
    setPontualParaEditar(null)
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleRemoverPontual = async (item: LancamentoPontual) => {
    if (!user) return
    await folhaService.removerLancamentoPontual(item.id, user.tenant_id, user.id, {
      descritivo: item.descritivo,
      colaborador_id: item.colaborador_id,
    })
    toast({
      title: 'Lançamento removido',
      description: `O lançamento pontual "${item.descritivo}" foi excluído.`,
    })
    setRefreshTrigger((prev) => prev + 1)
  }

  // -------------------------------------------------------------------------
  // Renderização: Modo de Edição do Colaborador vs. Lista Geral de Colaboradores
  // -------------------------------------------------------------------------

  if (colaboradorSelecionado) {
    return (
      <div className="space-y-6 pb-12">
        {/* Barra de Navegação de Retorno */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColaboradorSelecionado(null)}
              className="h-9 px-3 border-[#E0E0E0] text-[#0D47A1] hover:bg-[#E8EEF7] gap-1.5 font-semibold text-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Lista da Folha
            </Button>
            <div>
              <h1 className="text-xl font-bold text-[#212121]">
                {colaboradorSelecionado.nome_completo || colaboradorSelecionado.nome}
              </h1>
              <p className="text-xs text-[#757575]">
                {colaboradorSelecionado.cargo} • {colaboradorSelecionado.departamento} • CPF:{' '}
                {colaboradorSelecionado.cpf}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setPeriodicoParaEditar(null)
                setModalPeriodicoAberto(true)
              }}
              className="bg-[#0D47A1] hover:bg-[#0B3D91] text-white text-xs h-9 gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Lançamento Periódico
            </Button>
            <Button
              onClick={() => {
                setPontualParaEditar(null)
                setModalPontualAberto(true)
              }}
              variant="outline"
              className="border-[#0D47A1] text-[#0D47A1] hover:bg-blue-50 text-xs h-9 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Lançamento Pontual
            </Button>
          </div>
        </div>

        {/* Componente Reutilizável com canManage = true */}
        {user && (
          <DemonstrativoFinanceiroView
            tenantId={user.tenant_id}
            colaboradorId={colaboradorSelecionado.id}
            colaborador={colaboradorSelecionado}
            canManage={true}
            onNovoPeriodico={() => {
              setPeriodicoParaEditar(null)
              setModalPeriodicoAberto(true)
            }}
            onEditarPeriodico={(item) => {
              setPeriodicoParaEditar(item)
              setModalPeriodicoAberto(true)
            }}
            onRemoverPeriodico={handleRemoverPeriodico}
            onNovoPontual={() => {
              setPontualParaEditar(null)
              setModalPontualAberto(true)
            }}
            onEditarPontual={(item) => {
              setPontualParaEditar(item)
              setModalPontualAberto(true)
            }}
            onRemoverPontual={handleRemoverPontual}
            onReload={() => setRefreshTrigger((prev) => prev + 1)}
            refreshTrigger={refreshTrigger}
          />
        )}

        {/* Modal de Criação / Edição de Periódico */}
        <ModalLancamentoPeriodico
          open={modalPeriodicoAberto}
          onClose={() => {
            setModalPeriodicoAberto(false)
            setPeriodicoParaEditar(null)
          }}
          onSave={handleSalvarPeriodico}
          initialData={periodicoParaEditar}
        />

        {/* Modal de Criação / Edição de Pontual */}
        <ModalLancamentoPontual
          open={modalPontualAberto}
          onClose={() => {
            setModalPontualAberto(false)
            setPontualParaEditar(null)
          }}
          onSave={handleSalvarPontual}
          initialData={pontualParaEditar}
        />
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // MODO LISTA GERAL DE GESTÃO DA FOLHA
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 pb-12">
      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0D47A1]">
            <Briefcase className="h-4 w-4" />
            <span>Gestão de Pessoas • Departamento Pessoal</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#212121] mt-1">
            Gestão da Folha e Demonstrativos
          </h1>
          <p className="text-sm text-[#757575] mt-0.5">
            Visão consolidada de folha por colaborador, proventos, descontos e lançamento de eventos
            periódicos e pontuais.
          </p>
        </div>

        {/* Seletor de Mês e Ano Geral */}
        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={(val) => setMes(Number(val))}>
            <SelectTrigger className="w-[140px] h-9 text-xs font-semibold bg-white border-[#E0E0E0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(ano)} onValueChange={(val) => setAno(Number(val))}>
            <SelectTrigger className="w-[100px] h-9 text-xs font-semibold bg-white border-[#E0E0E0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((a) => (
                <SelectItem key={a} value={String(a)} className="text-xs">
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => carregarDadosGestao()}
            className="h-9 px-3 border-[#E0E0E0] text-[#757575] hover:text-[#0D47A1]"
            title="Atualizar dados da folha"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Botão Importar Planilha (visível apenas para admin_rh e admin) */}
          {podeImportarPlanilha && (
            <Button
              size="sm"
              onClick={() => setModalImportacaoAberto(true)}
              className="h-9 gap-1.5 bg-[#0D47A1] hover:bg-[#0b3c8a] text-white text-xs font-semibold shadow-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importar Planilha
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Métricas Consolidadas do Tenant */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Colaboradores Ativos */}
        <Card className="border border-[#E0E0E0] bg-white shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[#757575]">
              Colaboradores na Folha
            </span>
            <Users className="h-4 w-4 text-[#0D47A1]" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-[#212121]">
              {totaisTenant.totalColaboradores}
            </div>
            <p className="text-[11px] text-[#757575] mt-0.5">Ativos com cadastro regular</p>
          </CardContent>
        </Card>

        {/* Card 2: Total de Proventos do Tenant */}
        <Card className="border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Total Bruto Proventos
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-700" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-emerald-700">
              {formatMoedaPtBr(totaisTenant.proventos)}
            </div>
            <p className="text-[11px] text-emerald-800/80 mt-0.5 font-medium">
              Salários e créditos do mês
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Total de Descontos do Tenant */}
        <Card className="border border-rose-200 bg-rose-50/50 shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Total de Descontos
            </span>
            <TrendingDown className="h-4 w-4 text-rose-700" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-rose-700">
              {formatMoedaPtBr(totaisTenant.descontos)}
            </div>
            <p className="text-[11px] text-rose-800/80 mt-0.5 font-medium">
              Deduções e coparticipações
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Total Líquido do Tenant */}
        <Card className="border border-blue-200 bg-[#E8EEF7] shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0D47A1]">
              Folha Líquida
            </span>
            <DollarSign className="h-4 w-4 text-[#0D47A1]" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-[#0D47A1]">
              {formatMoedaPtBr(totaisTenant.liquido)}
            </div>
            <p className="text-[11px] text-[#0D47A1]/80 mt-0.5 font-medium">
              Desembolso líquido previsto
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Importação de Planilha (CSV / Excel) */}
      {user && podeImportarPlanilha && (
        <ModalImportarLancamentos
          open={modalImportacaoAberto}
          onClose={() => setModalImportacaoAberto(false)}
          tenantId={user.tenant_id}
          userId={user.id}
          colaboradores={itensGestao.map((i) => i.colaborador)}
          onSuccess={() => carregarDadosGestao()}
        />
      )}

      {/* Tabela de Colaboradores com Resumo do Mês */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs">
        <CardHeader className="p-4 border-b border-[#F0F0F0]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-bold text-[#212121]">
                Demonstrativo por Colaborador — {MESES.find((m) => m.valor === mes)?.nome}/{ano}
              </CardTitle>
              <CardDescription className="text-xs text-[#757575] mt-0.5">
                Clique em uma linha ou no botão &quot;Editar Lançamentos&quot; para gerenciar os
                eventos financeiros do colaborador.
              </CardDescription>
            </div>

            {/* Barra de Filtros e Busca */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#757575]" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar colaborador ou cargo..."
                  className="pl-8 text-xs h-9 border-[#E0E0E0]"
                />
              </div>

              <Select
                value={filtroDepartamento}
                onValueChange={(val) => setFiltroDepartamento(val)}
              >
                <SelectTrigger className="w-[160px] h-9 text-xs border-[#E0E0E0]">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos os Setores
                  </SelectItem>
                  {departamentos.map((d) => (
                    <SelectItem key={d} value={d} className="text-xs">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="text-center py-12 text-xs text-[#757575]">
              Nenhum colaborador encontrado com os filtros aplicados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA] border-b border-[#E0E0E0]">
                  <TableHead className="text-xs font-bold text-[#212121] py-3">
                    Colaborador
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3">
                    Cargo / Setor
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3 text-right">
                    Total Proventos
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3 text-right">
                    Total Descontos
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3 text-right">
                    Valor Líquido
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3 text-center">
                    Lançamentos
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3 text-right">
                    Ação
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensFiltrados.map((item) => (
                  <TableRow
                    key={item.colaborador.id}
                    onClick={() => setColaboradorSelecionado(item.colaborador)}
                    className="cursor-pointer hover:bg-blue-50/40 border-b border-[#F0F0F0] transition-colors"
                  >
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#E8EEF7] text-[#0D47A1] font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                          {item.colaborador.foto_url ? (
                            <img
                              src={item.colaborador.foto_url}
                              alt={item.colaborador.nome}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            item.colaborador.nome.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#212121]">
                            {item.colaborador.nome_completo || item.colaborador.nome}
                          </p>
                          <p className="text-[11px] text-[#757575] font-mono">
                            {item.colaborador.cpf}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-xs text-[#616161]">
                      <p className="font-medium text-[#212121]">{item.colaborador.cargo || '—'}</p>
                      <p className="text-[11px] text-[#757575]">
                        {item.colaborador.departamento || '—'}
                      </p>
                    </TableCell>

                    <TableCell className="py-3 text-right font-mono font-bold text-xs text-emerald-700">
                      {formatMoedaPtBr(item.resumo.totalProventos)}
                    </TableCell>

                    <TableCell className="py-3 text-right font-mono font-bold text-xs text-rose-600">
                      {item.resumo.totalDescontos > 0
                        ? `- ${formatMoedaPtBr(item.resumo.totalDescontos)}`
                        : 'R$ 0,00'}
                    </TableCell>

                    <TableCell className="py-3 text-right font-mono font-black text-xs text-[#0D47A1]">
                      {formatMoedaPtBr(item.resumo.valorLiquido)}
                    </TableCell>

                    <TableCell className="py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#0D47A1] font-semibold border border-blue-200">
                          {item.resumo.quantidadePeriodicos} per.
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                          {item.resumo.quantidadePontuais} pont.
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs font-semibold text-[#0D47A1] hover:bg-[#E8EEF7] gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          setColaboradorSelecionado(item.colaborador)
                        }}
                      >
                        Editar Lançamentos
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default GestaoFolhaPage
