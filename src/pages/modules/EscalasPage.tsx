import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CalendarDays,
  Plus,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Link2,
  Trash2,
  Edit2,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Layers,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { escalaService } from '@/services/pontoService'
import { colaboradorService } from '@/services/api'
import {
  EscalaTrabalho,
  ColaboradorEscala,
  Colaborador,
  DepartamentoEscala,
  EscalaTipo,
  EscalaModeloEspecial,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const DIAS_SEMANA_OPCOES = [
  { id: 'seg', label: 'Segunda-feira', sigla: 'Seg' },
  { id: 'ter', label: 'Terça-feira', sigla: 'Ter' },
  { id: 'qua', label: 'Quarta-feira', sigla: 'Qua' },
  { id: 'qui', label: 'Quinta-feira', sigla: 'Qui' },
  { id: 'sex', label: 'Sexta-feira', sigla: 'Sex' },
  { id: 'sab', label: 'Sábado', sigla: 'Sáb' },
  { id: 'dom', label: 'Domingo', sigla: 'Dom' },
]

export default function EscalasPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const tenantId = user?.tenant_id
  const userId = user?.id

  const [loading, setLoading] = useState(true)
  const [escalas, setEscalas] = useState<EscalaTrabalho[]>([])
  const [vinculos, setVinculos] = useState<ColaboradorEscala[]>([])
  const [escalasDepartamento, setEscalasDepartamento] = useState<DepartamentoEscala[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroEscala, setFiltroEscala] = useState<string>('todos')

  // Modal Nova / Editar Escala
  const [modalEscalaOpen, setModalEscalaOpen] = useState(false)
  const [escalaEditando, setEscalaEditando] = useState<EscalaTrabalho | null>(null)
  const [nomeEscala, setNomeEscala] = useState('')
  const [tipoEscala, setTipoEscala] = useState<EscalaTipo>('semanal')
  const [modeloEspecial, setModeloEspecial] = useState<EscalaModeloEspecial>('12x36')
  const [cicloDias, setCicloDias] = useState<number>(4)
  const [cicloDiasTrabalho, setCicloDiasTrabalho] = useState<number>(2)
  const [horarioInicio, setHorarioInicio] = useState('08:00')
  const [horarioFim, setHorarioFim] = useState('17:00')
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([
    'seg',
    'ter',
    'qua',
    'qui',
    'sex',
  ])
  const [salvandoEscala, setSalvandoEscala] = useState(false)

  // Modal Vincular Escala por Departamento
  const [modalDeptoOpen, setModalDeptoOpen] = useState(false)
  const [deptoEditando, setDeptoEditando] = useState<DepartamentoEscala | null>(null)
  const [departamentoSelecionado, setDepartamentoSelecionado] = useState('')
  const [escalaDeptoId, setEscalaDeptoId] = useState('')
  const [dataInicioDepto, setDataInicioDepto] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [dataFimDepto, setDataFimDepto] = useState('')
  const [salvandoDepto, setSalvandoDepto] = useState(false)

  // Modal Vincular Colaborador
  const [modalVinculoOpen, setModalVinculoOpen] = useState(false)
  const [colaboradorVinculoId, setColaboradorVinculoId] = useState('')
  const [escalaVinculoId, setEscalaVinculoId] = useState('')
  const [dataInicioVinculo, setDataInicioVinculo] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [salvandoVinculo, setSalvandoVinculo] = useState(false)

  // Carregar dados
  const carregarDados = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const [escList, vincList, colabList, depEscList] = await Promise.all([
        escalaService.getEscalas(tenantId),
        escalaService.getVinculosColaboradorEscala(tenantId),
        colaboradorService.getColaboradores(tenantId),
        escalaService.getEscalasDepartamento(tenantId),
      ])

      setEscalas(escList)
      setVinculos(vincList)
      setColaboradores(colabList)
      setEscalasDepartamento(depEscList)
    } catch (err) {
      console.error('Erro ao carregar escalas:', err)
      toast({
        title: 'Erro ao carregar escalas',
        description: 'Não foi possível carregar a lista de escalas e vínculos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Abrir modal de criação
  const handleNovaEscala = () => {
    setEscalaEditando(null)
    setNomeEscala('')
    setTipoEscala('semanal')
    setModeloEspecial('12x36')
    setCicloDias(4)
    setCicloDiasTrabalho(2)
    setHorarioInicio('08:00')
    setHorarioFim('17:00')
    setDiasSelecionados(['seg', 'ter', 'qua', 'qui', 'sex'])
    setModalEscalaOpen(true)
  }

  // Abrir modal de edição
  const handleEditarEscala = (escala: EscalaTrabalho) => {
    setEscalaEditando(escala)
    setNomeEscala(escala.nome)
    setTipoEscala(escala.tipo || 'semanal')
    setModeloEspecial(escala.modelo_especial || '12x36')
    setCicloDias(escala.ciclo_dias || 4)
    setCicloDiasTrabalho(escala.ciclo_dias_trabalho || 2)
    setHorarioInicio(escala.horario_inicio)
    setHorarioFim(escala.horario_fim)
    setDiasSelecionados(escala.dias_semana ? escala.dias_semana.split(',') : [])
    setModalEscalaOpen(true)
  }

  // Toggle dia da semana
  const handleToggleDia = (diaId: string) => {
    setDiasSelecionados((prev) =>
      prev.includes(diaId) ? prev.filter((d) => d !== diaId) : [...prev, diaId],
    )
  }

  // Salvar Escala (Criar ou Atualizar)
  const handleSalvarEscala = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !nomeEscala.trim()) {
      toast({ title: 'Preencha o nome da escala', variant: 'destructive' })
      return
    }

    if (tipoEscala === 'semanal' && diasSelecionados.length === 0) {
      toast({ title: 'Selecione ao menos um dia da semana', variant: 'destructive' })
      return
    }

    if (tipoEscala === 'especial' && modeloEspecial === 'revezamento') {
      if (cicloDias <= 0 || cicloDiasTrabalho <= 0 || cicloDiasTrabalho >= cicloDias) {
        toast({
          title: 'Configuração de ciclo inválida',
          description: 'Os dias de trabalho devem ser menores que o ciclo total de dias.',
          variant: 'destructive',
        })
        return
      }
    }

    try {
      setSalvandoEscala(true)
      const diasStr = tipoEscala === 'semanal' ? diasSelecionados.join(',') : 'especial'

      const payload = {
        nome: nomeEscala,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        dias_semana: diasStr,
        tipo: tipoEscala,
        modelo_especial: tipoEscala === 'especial' ? modeloEspecial : undefined,
        ciclo_dias:
          tipoEscala === 'especial' && modeloEspecial === 'revezamento' ? cicloDias : undefined,
        ciclo_dias_trabalho:
          tipoEscala === 'especial' && modeloEspecial === 'revezamento'
            ? cicloDiasTrabalho
            : undefined,
      }

      if (escalaEditando) {
        await escalaService.updateEscala(escalaEditando.id, payload, userId, tenantId)
        toast({ title: 'Escala atualizada com sucesso' })
      } else {
        await escalaService.createEscala(
          {
            tenant_id: tenantId,
            ...payload,
          },
          userId,
        )
        toast({ title: 'Nova escala criada com sucesso' })
      }

      setModalEscalaOpen(false)
      carregarDados()
    } catch (err: unknown) {
      console.error('Erro ao salvar escala:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao salvar a escala.'
      toast({ title: 'Erro ao salvar escala', description: msg, variant: 'destructive' })
    } finally {
      setSalvandoEscala(false)
    }
  }

  // Excluir Escala
  const handleExcluirEscala = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir a escala "${nome}"?`)) return
    try {
      await escalaService.deleteEscala(id, userId, tenantId)
      toast({ title: 'Escala excluída com sucesso' })
      carregarDados()
    } catch (err) {
      console.error('Erro ao excluir escala:', err)
      toast({ title: 'Erro ao excluir escala', variant: 'destructive' })
    }
  }

  // Salvar Vínculo Colaborador -> Escala
  const handleSalvarVinculo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !colaboradorVinculoId || !escalaVinculoId || !dataInicioVinculo) {
      toast({ title: 'Preencha todos os campos do vínculo', variant: 'destructive' })
      return
    }

    try {
      setSalvandoVinculo(true)
      await escalaService.vincularColaborador(
        {
          tenant_id: tenantId,
          colaborador_id: colaboradorVinculoId,
          escala_id: escalaVinculoId,
          data_inicio: `${dataInicioVinculo} 00:00:00.000Z`,
        },
        userId,
      )

      toast({
        title: 'Colaborador vinculado à escala',
        description: 'A nova escala já está em vigência para o colaborador.',
      })

      setModalVinculoOpen(false)
      setColaboradorVinculoId('')
      setEscalaVinculoId('')
      carregarDados()
    } catch (err: unknown) {
      console.error('Erro ao vincular colaborador:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao salvar o vínculo.'
      toast({ title: 'Erro ao vincular', description: msg, variant: 'destructive' })
    } finally {
      setSalvandoVinculo(false)
    }
  }

  // Remover Vínculo
  const handleRemoverVinculo = async (id: string) => {
    if (!confirm('Deseja desvincular o colaborador desta escala?')) return
    try {
      await escalaService.removerVinculo(id, userId, tenantId)
      toast({ title: 'Vínculo removido com sucesso' })
      carregarDados()
    } catch (err) {
      console.error('Erro ao remover vínculo:', err)
      toast({ title: 'Erro ao remover vínculo', variant: 'destructive' })
    }
  }

  // Salvar ou Editar Vínculo de Departamento
  const handleAbrirModalDepto = (depEsc?: DepartamentoEscala) => {
    if (depEsc) {
      setDeptoEditando(depEsc)
      setDepartamentoSelecionado(depEsc.departamento)
      setEscalaDeptoId(depEsc.escala_id)
      setDataInicioDepto(depEsc.data_inicio ? depEsc.data_inicio.slice(0, 10) : '')
      setDataFimDepto(depEsc.data_fim ? depEsc.data_fim.slice(0, 10) : '')
    } else {
      setDeptoEditando(null)
      setDepartamentoSelecionado('')
      setEscalaDeptoId('')
      setDataInicioDepto(new Date().toISOString().slice(0, 10))
      setDataFimDepto('')
    }
    setModalDeptoOpen(true)
  }

  const handleSalvarVinculoDepto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !departamentoSelecionado || !escalaDeptoId || !dataInicioDepto) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }

    try {
      setSalvandoDepto(true)
      const payload = {
        departamento: departamentoSelecionado,
        escala_id: escalaDeptoId,
        data_inicio: `${dataInicioDepto} 00:00:00.000Z`,
        data_fim: dataFimDepto ? `${dataFimDepto} 23:59:59.999Z` : undefined,
      }

      if (deptoEditando) {
        await escalaService.updateVinculoDepartamento(deptoEditando.id, payload, userId, tenantId)
        toast({ title: 'Escala do departamento atualizada' })
      } else {
        await escalaService.vincularDepartamento(
          {
            tenant_id: tenantId,
            ...payload,
          },
          userId,
        )
        toast({ title: 'Escala vinculada ao departamento com sucesso' })
      }

      setModalDeptoOpen(false)
      carregarDados()
    } catch (err: unknown) {
      console.error('Erro ao salvar escala do departamento:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao vincular escala ao departamento.'
      toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' })
    } finally {
      setSalvandoDepto(false)
    }
  }

  const handleRemoverVinculoDepto = async (id: string, deptoNome: string) => {
    if (!confirm(`Deseja remover a escala vinculada ao departamento "${deptoNome}"?`)) return
    try {
      await escalaService.removerVinculoDepartamento(id, userId, tenantId)
      toast({ title: 'Vínculo do departamento removido' })
      carregarDados()
    } catch (err) {
      console.error('Erro ao remover vínculo de departamento:', err)
      toast({ title: 'Erro ao remover vínculo', variant: 'destructive' })
    }
  }

  // Lista única de departamentos da organização
  const departamentosDisponiveis = useMemo(() => {
    const set = new Set<string>()
    colaboradores.forEach((c) => {
      if (c.departamento) set.add(c.departamento)
    })
    return Array.from(set).sort()
  }, [colaboradores])

  // Contagem de colaboradores cobertos por departamento
  const colaboradoresPorDeptoMap = useMemo(() => {
    const map = new Map<string, number>()
    colaboradores.forEach((c) => {
      if (c.status === 'ativo' && c.departamento) {
        map.set(c.departamento, (map.get(c.departamento) || 0) + 1)
      }
    })
    return map
  }, [colaboradores])

  // Grid Semanal de Colaboradores e Escalas com precedência (Individual > Departamento)
  const gridSemanalData = useMemo(() => {
    return colaboradores
      .filter((c) => c.status === 'ativo')
      .map((colab) => {
        const vinc = vinculos.find((v) => v.colaborador_id === colab.id)
        let esc = vinc?.expand?.escala_id || escalas.find((e) => e.id === vinc?.escala_id)
        let origemEscala: 'individual' | 'departamento' | 'nenhuma' = 'individual'

        if (!esc && colab.departamento) {
          const deptoVinc = escalasDepartamento.find((d) => d.departamento === colab.departamento)
          if (deptoVinc) {
            esc = deptoVinc.expand?.escala_id || escalas.find((e) => e.id === deptoVinc.escala_id)
            if (esc) {
              origemEscala = 'departamento'
            }
          }
        }

        if (!esc) {
          origemEscala = 'nenhuma'
        }

        const isEspecial = esc?.tipo === 'especial'
        const diasEscala = esc?.dias_semana ? esc.dias_semana.toLowerCase().split(',') : []

        return {
          colaborador: colab,
          vinculo: vinc,
          escala: esc,
          origemEscala,
          isEspecial,
          dias: {
            seg: diasEscala.includes('seg') ? `${esc?.horario_inicio}–${esc?.horario_fim}` : null,
            ter: diasEscala.includes('ter') ? `${esc?.horario_inicio}–${esc?.horario_fim}` : null,
            qua: diasEscala.includes('qua') ? `${esc?.horario_inicio}–${esc?.horario_fim}` : null,
            qui: diasEscala.includes('qui') ? `${esc?.horario_inicio}–${esc?.horario_fim}` : null,
            sex: diasEscala.includes('sex') ? `${esc?.horario_inicio}–${esc?.horario_fim}` : null,
            sab: diasEscala.includes('sab') ? `${esc?.horario_inicio}–${esc?.horario_fim}` : null,
            dom: diasEscala.includes('dom') ? `${esc?.horario_inicio}–${esc?.horario_fim}` : null,
          },
        }
      })
      .filter((item) => {
        const matchBusca =
          item.colaborador.nome.toLowerCase().includes(busca.toLowerCase()) ||
          item.colaborador.cargo?.toLowerCase().includes(busca.toLowerCase()) ||
          (item.colaborador.departamento || '').toLowerCase().includes(busca.toLowerCase())

        const matchEscala = filtroEscala === 'todos' || item.escala?.id === filtroEscala

        return matchBusca && matchEscala
      })
  }, [colaboradores, vinculos, escalas, escalasDepartamento, busca, filtroEscala])

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Escalas de Trabalho
              </h1>
              <p className="text-xs text-[#757575] mt-0.5">
                Cadastre turnos, vincule colaboradores com vigência e visualize a grade semanal de
                trabalho.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 flex-wrap">
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAbrirModalDepto()}
            disabled={escalas.length === 0}
            className="h-9 text-xs border-[#0D47A1]/30 text-[#0D47A1] hover:bg-[#E8EEF7] gap-1.5"
          >
            <Building2 className="h-3.5 w-3.5" />
            Escala por Departamento
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalVinculoOpen(true)}
            disabled={escalas.length === 0}
            className="h-9 text-xs border-[#0D47A1]/30 text-[#0D47A1] hover:bg-[#E8EEF7] gap-1.5"
          >
            <Link2 className="h-3.5 w-3.5" />
            Vincular Colaborador
          </Button>

          <Button
            size="sm"
            onClick={handleNovaEscala}
            className="h-9 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Nova Escala
          </Button>
        </div>
      </div>

      {/* 2. Visualização em Tabs: Grade Semanal, Cadastro de Escalas ou Escalas por Departamento */}
      <Tabs defaultValue="grade" className="space-y-4">
        <TabsList className="bg-white border border-[#E0E0E0] p-1">
          <TabsTrigger
            value="grade"
            className="text-xs data-[state=active]:bg-[#E8EEF7] data-[state=active]:text-[#0D47A1] font-semibold"
          >
            Visualização Semanal da Grade
          </TabsTrigger>
          <TabsTrigger
            value="escalas"
            className="text-xs data-[state=active]:bg-[#E8EEF7] data-[state=active]:text-[#0D47A1] font-semibold"
          >
            Escalas Cadastradas ({escalas.length})
          </TabsTrigger>
          <TabsTrigger
            value="departamentos"
            className="text-xs data-[state=active]:bg-[#E8EEF7] data-[state=active]:text-[#0D47A1] font-semibold"
          >
            Escalas por Departamento ({escalasDepartamento.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: GRID SEMANAL */}
        <TabsContent value="grade" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#212121]">
                    Grade Semanal dos Colaboradores
                  </CardTitle>
                  <CardDescription className="text-xs text-[#757575]">
                    Dias da semana nas colunas e colaboradores nas linhas com os horários de entrada
                    e saída
                  </CardDescription>
                </div>

                {/* Filtros da Grade */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative w-52">
                    <Search className="h-3.5 w-3.5 text-[#9E9E9E] absolute left-2.5 top-2.5" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar colaborador..."
                      className="pl-8 text-xs h-8 border-[#E0E0E0]"
                    />
                  </div>

                  <Select value={filtroEscala} onValueChange={setFiltroEscala}>
                    <SelectTrigger className="w-44 h-8 text-xs border-[#E0E0E0] bg-white">
                      <SelectValue placeholder="Filtrar por escala..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="todos" className="text-xs">
                        Todas as escalas
                      </SelectItem>
                      {escalas.map((e) => (
                        <SelectItem key={e.id} value={e.id} className="text-xs">
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full bg-slate-100" />
                  ))}
                </div>
              ) : gridSemanalData.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#757575]">
                  Nenhum colaborador encontrado com os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA] text-[#757575] font-semibold uppercase text-[10px]">
                        <th className="py-3 pl-4 min-w-[200px]">Colaborador</th>
                        <th className="py-3 min-w-[140px]">Escala Vigente</th>
                        <th className="py-3 text-center min-w-[90px]">Segunda</th>
                        <th className="py-3 text-center min-w-[90px]">Terça</th>
                        <th className="py-3 text-center min-w-[90px]">Quarta</th>
                        <th className="py-3 text-center min-w-[90px]">Quinta</th>
                        <th className="py-3 text-center min-w-[90px]">Sexta</th>
                        <th className="py-3 text-center min-w-[90px]">Sábado</th>
                        <th className="py-3 text-center min-w-[90px]">Domingo</th>
                        <th className="py-3 pr-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F5]">
                      {gridSemanalData.map((item) => {
                        const c = item.colaborador
                        const esc = item.escala

                        return (
                          <tr key={c.id} className="hover:bg-[#FAFAFA] transition-colors">
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
                                  <p className="text-[10px] text-[#757575]">{c.cargo || '—'}</p>
                                </div>
                              </div>
                            </td>

                            <td className="py-3">
                              {esc ? (
                                <div className="flex flex-col gap-1 items-start">
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 text-[#0D47A1] border-[#0D47A1]/30 text-[10px] font-semibold"
                                  >
                                    {esc.nome}
                                  </Badge>
                                  {item.origemEscala === 'departamento' && (
                                    <span className="text-[9px] text-amber-700 font-medium bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                                      Escala do Depto
                                    </span>
                                  )}
                                  {item.isEspecial && (
                                    <span className="text-[9px] text-purple-700 font-medium bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                                      {esc.modelo_especial === '12x36' ? '12x36' : 'Revezamento'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-[#9E9E9E]">Não vinculado</span>
                              )}
                            </td>

                            {/* Colunas dos dias da semana */}
                            {(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const).map(
                              (dia) => {
                                const horario = item.dias[dia]
                                return (
                                  <td key={dia} className="py-3 text-center">
                                    {horario ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-medium">
                                        {horario}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-[#BDBDBD] font-light">
                                        Folga
                                      </span>
                                    )}
                                  </td>
                                )
                              },
                            )}

                            <td className="py-3 pr-4 text-right">
                              {item.vinculo ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoverVinculo(item.vinculo!.id)}
                                  title="Remover vínculo de escala"
                                  className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setColaboradorVinculoId(c.id)
                                    setModalVinculoOpen(true)
                                  }}
                                  className="h-7 text-[11px] border-[#0D47A1]/30 text-[#0D47A1]"
                                >
                                  Vincular
                                </Button>
                              )}
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
        </TabsContent>

        {/* TAB 2: LISTA DE ESCALAS CADASTRADAS */}
        <TabsContent value="escalas" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {escalas.map((esc) => {
              const vinculosCont = vinculos.filter((v) => v.escala_id === esc.id).length
              const diasArray = esc.dias_semana ? esc.dias_semana.split(',') : []

              return (
                <Card
                  key={esc.id}
                  className="border border-[#E0E0E0] bg-white shadow-2xs hover:shadow-sm transition-shadow flex flex-col justify-between"
                >
                  <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-sm font-bold text-[#212121]">
                            {esc.nome}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={
                              esc.tipo === 'especial'
                                ? 'bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold'
                                : 'bg-blue-50 text-[#0D47A1] border-blue-200 text-[10px] font-semibold'
                            }
                          >
                            {esc.tipo === 'especial'
                              ? `Especial (${esc.modelo_especial === '12x36' ? '12x36' : 'Revezamento'})`
                              : 'Semanal'}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs text-[#757575] mt-1 flex items-center gap-1.5 font-mono">
                          <Clock className="h-3.5 w-3.5 text-[#0D47A1]" />
                          {esc.horario_inicio} às {esc.horario_fim}
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditarEscala(esc)}
                          className="h-7 w-7 text-[#616161] hover:text-[#0D47A1]"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleExcluirEscala(esc.id, esc.nome)}
                          className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-3 pb-3 space-y-3 flex-1">
                    {/* Regra de Atuação */}
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#757575] mb-1.5">
                        Regra de Atuação
                      </p>
                      {esc.tipo === 'especial' ? (
                        <div className="p-2.5 rounded-md bg-[#FAFAFA] border border-[#E0E0E0] text-xs text-[#424242]">
                          {esc.modelo_especial === '12x36' ? (
                            <p className="flex items-center gap-1.5 font-medium">
                              <span className="h-2 w-2 rounded-full bg-purple-600" />
                              Jornada de 12h de trabalho por 36h de descanso
                            </p>
                          ) : (
                            <div>
                              <p className="flex items-center gap-1.5 font-medium">
                                <span className="h-2 w-2 rounded-full bg-indigo-600" />
                                Revezamento contínuo: ciclo de {esc.ciclo_dias || 4} dias
                              </p>
                              <p className="text-[11px] text-[#757575] mt-0.5">
                                {esc.ciclo_dias_trabalho || 2} dias trabalhados seguidos por{' '}
                                {(esc.ciclo_dias || 4) - (esc.ciclo_dias_trabalho || 2)} dias de
                                folga
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-wrap">
                          {DIAS_SEMANA_OPCOES.map((d) => {
                            const ativo = diasArray.includes(d.id)
                            return (
                              <span
                                key={d.id}
                                className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                  ativo
                                    ? 'bg-[#E8EEF7] text-[#0D47A1] font-bold border border-[#0D47A1]/20'
                                    : 'bg-slate-100 text-slate-400 line-through'
                                }`}
                              >
                                {d.sigla}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <div className="p-3 border-t border-[#F0F0F0] bg-[#FAFAFA] flex items-center justify-between text-xs rounded-b-xl">
                    <span className="text-[#616161] flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[#0D47A1]" />
                      <strong>{vinculosCont}</strong> colaboradores vinculados
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEscalaVinculoId(esc.id)
                        setModalVinculoOpen(true)
                      }}
                      className="h-7 text-xs text-[#0D47A1] hover:bg-white font-semibold"
                    >
                      + Vincular
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* TAB 3: ESCALAS POR DEPARTAMENTO */}
        <TabsContent value="departamentos" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-2xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121]">
                  Escalas Padrão por Departamento
                </CardTitle>
                <CardDescription className="text-xs text-[#757575] mt-0.5">
                  Colaboradores do departamento herdam essa escala automaticamente quando não
                  possuem um vínculo individual específico.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => handleAbrirModalDepto()}
                className="h-8 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Vincular Departamento
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {escalasDepartamento.length === 0 ? (
                <div className="p-8 text-center">
                  <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-[#616161]">
                    Nenhum departamento com escala vinculada
                  </p>
                  <p className="text-[11px] text-[#9E9E9E] mt-1 max-w-sm mx-auto">
                    Vincule uma escala a um departamento para que todos os colaboradores desse setor
                    adotem os horários e jornadas definidos.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAbrirModalDepto()}
                    className="mt-3 text-xs border-[#0D47A1]/30 text-[#0D47A1]"
                  >
                    Vincular Primeiro Departamento
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA] text-[#757575] font-semibold">
                        <th className="py-2.5 pl-4">Departamento</th>
                        <th className="py-2.5">Escala Vinculada</th>
                        <th className="py-2.5">Tipo / Modelo</th>
                        <th className="py-2.5">Vigência</th>
                        <th className="py-2.5 text-center">Colaboradores Cobertos</th>
                        <th className="py-2.5 pr-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F5]">
                      {escalasDepartamento.map((depEsc) => {
                        const esc =
                          depEsc.expand?.escala_id || escalas.find((e) => e.id === depEsc.escala_id)
                        const cobertos = colaboradoresPorDeptoMap.get(depEsc.departamento) || 0

                        return (
                          <tr key={depEsc.id} className="hover:bg-[#FAFAFA] transition-colors">
                            <td className="py-3 pl-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-[#0D47A1]" />
                                <span className="font-bold text-[#212121]">
                                  {depEsc.departamento}
                                </span>
                              </div>
                            </td>

                            <td className="py-3">
                              {esc ? (
                                <div>
                                  <span className="font-semibold text-[#212121]">{esc.nome}</span>
                                  <p className="text-[10px] text-[#757575] font-mono">
                                    {esc.horario_inicio} às {esc.horario_fim}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-[#9E9E9E] italic">Escala não encontrada</span>
                              )}
                            </td>

                            <td className="py-3">
                              {esc?.tipo === 'especial' ? (
                                <Badge
                                  variant="outline"
                                  className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]"
                                >
                                  Especial (
                                  {esc.modelo_especial === '12x36' ? '12x36' : 'Revezamento'})
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-[#0D47A1] border-blue-200 text-[10px]"
                                >
                                  Semanal
                                </Badge>
                              )}
                            </td>

                            <td className="py-3 font-mono text-[11px] text-[#616161]">
                              <span>
                                Desde{' '}
                                {depEsc.data_inicio.slice(0, 10).split('-').reverse().join('/')}
                              </span>
                              {depEsc.data_fim && (
                                <span className="text-[#9E9E9E]">
                                  {' '}
                                  até {depEsc.data_fim.slice(0, 10).split('-').reverse().join('/')}
                                </span>
                              )}
                            </td>

                            <td className="py-3 text-center">
                              <Badge className="bg-[#E8EEF7] text-[#0D47A1] border-none text-[11px]">
                                {cobertos} {cobertos === 1 ? 'colaborador' : 'colaboradores'}
                              </Badge>
                            </td>

                            <td className="py-3 pr-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleAbrirModalDepto(depEsc)}
                                  className="h-7 w-7 text-[#616161] hover:text-[#0D47A1]"
                                  title="Editar vigência ou escala"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleRemoverVinculoDepto(depEsc.id, depEsc.departamento)
                                  }
                                  className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                                  title="Remover escala do departamento"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
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
        </TabsContent>
      </Tabs>

      {/* 3. Modal Nova / Editar Escala */}
      <Dialog open={modalEscalaOpen} onOpenChange={setModalEscalaOpen}>
        <DialogContent className="max-w-md bg-white border border-[#E0E0E0] p-6">
          <DialogHeader className="text-left space-y-1 pb-3 border-b border-[#E0E0E0]">
            <DialogTitle className="text-base font-bold text-[#212121]">
              {escalaEditando ? 'Editar Escala de Trabalho' : 'Nova Escala de Trabalho'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#757575]">
              Defina o nome da jornada, horários diários de entrada e saída e os dias da semana.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarEscala} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="nomeEscala" className="text-xs font-semibold text-[#212121]">
                Nome da Escala *
              </Label>
              <Input
                id="nomeEscala"
                value={nomeEscala}
                onChange={(e) => setNomeEscala(e.target.value)}
                placeholder="Ex: Administrativo 08h–17h, 12x36 Diurno, Plantão 6x2"
                required
                className="text-xs h-9 border-[#E0E0E0]"
              />
            </div>

            {/* Seletor Tipo de Escala: Semanal vs Especial */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#212121]">Tipo de Escala *</Label>
              <Select
                value={tipoEscala}
                onValueChange={(val: 'semanal' | 'especial') => setTipoEscala(val)}
              >
                <SelectTrigger className="w-full h-9 text-xs border-[#E0E0E0] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="semanal" className="text-xs font-medium">
                    Semanal (dias fixos da semana)
                  </SelectItem>
                  <SelectItem value="especial" className="text-xs font-medium">
                    Especial (12x36 ou Revezamento cíclico)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Se Especial: Dropdown de Modelo (12x36 ou Revezamento) */}
            {tipoEscala === 'especial' && (
              <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-200/60 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-purple-900">Modelo Especial *</Label>
                  <Select
                    value={modeloEspecial}
                    onValueChange={(val: '12x36' | 'revezamento') => setModeloEspecial(val)}
                  >
                    <SelectTrigger className="w-full h-9 text-xs border-purple-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="12x36" className="text-xs">
                        12x36 (12h de trabalho por 36h de descanso)
                      </SelectItem>
                      <SelectItem value="revezamento" className="text-xs">
                        Revezamento (ciclos customizados de trabalho e folga)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {modeloEspecial === 'revezamento' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-purple-900">
                        Dias Consecutivos de Trabalho *
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={cicloDiasTrabalho}
                        onChange={(e) => setCicloDiasTrabalho(Number(e.target.value))}
                        required
                        className="text-xs h-9 border-purple-200 bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-purple-900">
                        Ciclo Total de Dias *
                      </Label>
                      <Input
                        type="number"
                        min={cicloDiasTrabalho + 1}
                        max={60}
                        value={cicloDias}
                        onChange={(e) => setCicloDias(Number(e.target.value))}
                        required
                        className="text-xs h-9 border-purple-200 bg-white"
                      />
                    </div>
                    <div className="col-span-2 text-[11px] text-purple-700">
                      Exemplo: 4 dias no ciclo com 2 dias de trabalho = 2 dias trabalhados e 2 dias
                      de folga (2x2).
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="horarioInicio" className="text-xs font-semibold text-[#212121]">
                  Horário Início *
                </Label>
                <Input
                  id="horarioInicio"
                  type="time"
                  value={horarioInicio}
                  onChange={(e) => setHorarioInicio(e.target.value)}
                  required
                  className="text-xs h-9 border-[#E0E0E0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="horarioFim" className="text-xs font-semibold text-[#212121]">
                  Horário Fim *
                </Label>
                <Input
                  id="horarioFim"
                  type="time"
                  value={horarioFim}
                  onChange={(e) => setHorarioFim(e.target.value)}
                  required
                  className="text-xs h-9 border-[#E0E0E0]"
                />
              </div>
            </div>

            {/* Checkboxes de Dias da Semana (Apenas para escala Semanal) */}
            {tipoEscala === 'semanal' && (
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold text-[#212121]">
                  Dias da Semana de Trabalho *
                </Label>
                <div className="grid grid-cols-2 gap-2 bg-[#FAFAFA] p-3 rounded-lg border border-[#E0E0E0]">
                  {DIAS_SEMANA_OPCOES.map((d) => {
                    const marcado = diasSelecionados.includes(d.id)
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 text-xs cursor-pointer select-none text-[#212121]"
                      >
                        <Checkbox checked={marcado} onCheckedChange={() => handleToggleDia(d.id)} />
                        <span>{d.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#E0E0E0] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalEscalaOpen(false)}
                disabled={salvandoEscala}
                className="h-9 text-xs border-[#E0E0E0]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoEscala}
                className="h-9 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white"
              >
                {salvandoEscala
                  ? 'Salvando...'
                  : escalaEditando
                    ? 'Salvar Alterações'
                    : 'Criar Escala'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Modal Vincular Colaborador a Escala */}
      <Dialog open={modalVinculoOpen} onOpenChange={setModalVinculoOpen}>
        <DialogContent className="max-w-md bg-white border border-[#E0E0E0] p-6">
          <DialogHeader className="text-left space-y-1 pb-3 border-b border-[#E0E0E0]">
            <DialogTitle className="text-base font-bold text-[#212121]">
              Vincular Colaborador a Escala
            </DialogTitle>
            <DialogDescription className="text-xs text-[#757575]">
              Atribua uma escala com data de início para o colaborador cumprir a jornada.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarVinculo} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#212121]">Colaborador *</Label>
              <Select value={colaboradorVinculoId} onValueChange={setColaboradorVinculoId} required>
                <SelectTrigger className="w-full h-9 text-xs border-[#E0E0E0] bg-white">
                  <SelectValue placeholder="Selecione o colaborador..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {colaboradores
                    .filter((c) => c.status === 'ativo')
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.nome} ({c.cargo || 'Geral'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#212121]">Escala de Trabalho *</Label>
              <Select value={escalaVinculoId} onValueChange={setEscalaVinculoId} required>
                <SelectTrigger className="w-full h-9 text-xs border-[#E0E0E0] bg-white">
                  <SelectValue placeholder="Selecione a escala..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {escalas.map((esc) => (
                    <SelectItem key={esc.id} value={esc.id} className="text-xs">
                      {esc.nome} ({esc.horario_inicio}–{esc.horario_fim})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dtInicio" className="text-xs font-semibold text-[#212121]">
                Data de Início da Vigência *
              </Label>
              <Input
                id="dtInicio"
                type="date"
                value={dataInicioVinculo}
                onChange={(e) => setDataInicioVinculo(e.target.value)}
                required
                className="text-xs h-9 border-[#E0E0E0]"
              />
            </div>

            <div className="pt-3 border-t border-[#E0E0E0] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalVinculoOpen(false)}
                disabled={salvandoVinculo}
                className="h-9 text-xs border-[#E0E0E0]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoVinculo}
                className="h-9 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white"
              >
                {salvandoVinculo ? 'Salvando...' : 'Confirmar Vínculo'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Modal Vincular Escala a Departamento */}
      <Dialog open={modalDeptoOpen} onOpenChange={setModalDeptoOpen}>
        <DialogContent className="max-w-md bg-white border border-[#E0E0E0] p-6">
          <DialogHeader className="text-left space-y-1 pb-3 border-b border-[#E0E0E0]">
            <DialogTitle className="text-base font-bold text-[#212121]">
              {deptoEditando ? 'Editar Escala do Departamento' : 'Vincular Escala a Departamento'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#757575]">
              Todos os colaboradores do departamento selecionado herdarão esta escala, exceto se
              possuírem vínculo individual.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarVinculoDepto} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#212121]">Departamento *</Label>
              {departamentosDisponiveis.length > 0 ? (
                <Select
                  value={departamentoSelecionado}
                  onValueChange={setDepartamentoSelecionado}
                  required
                >
                  <SelectTrigger className="w-full h-9 text-xs border-[#E0E0E0] bg-white">
                    <SelectValue placeholder="Selecione o departamento..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {departamentosDisponiveis.map((dep) => (
                      <SelectItem key={dep} value={dep} className="text-xs">
                        {dep} ({colaboradoresPorDeptoMap.get(dep) || 0} colaboradores)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={departamentoSelecionado}
                  onChange={(e) => setDepartamentoSelecionado(e.target.value)}
                  placeholder="Nome do departamento..."
                  required
                  className="text-xs h-9 border-[#E0E0E0]"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#212121]">Escala de Trabalho *</Label>
              <Select value={escalaDeptoId} onValueChange={setEscalaDeptoId} required>
                <SelectTrigger className="w-full h-9 text-xs border-[#E0E0E0] bg-white">
                  <SelectValue placeholder="Selecione a escala..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {escalas.map((esc) => (
                    <SelectItem key={esc.id} value={esc.id} className="text-xs">
                      {esc.nome} (
                      {esc.tipo === 'especial' ? `Especial: ${esc.modelo_especial}` : 'Semanal'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dtInicioDepto" className="text-xs font-semibold text-[#212121]">
                  Data Início Vigência *
                </Label>
                <Input
                  id="dtInicioDepto"
                  type="date"
                  value={dataInicioDepto}
                  onChange={(e) => setDataInicioDepto(e.target.value)}
                  required
                  className="text-xs h-9 border-[#E0E0E0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dtFimDepto" className="text-xs font-semibold text-[#212121]">
                  Data Fim (Opcional)
                </Label>
                <Input
                  id="dtFimDepto"
                  type="date"
                  value={dataFimDepto}
                  onChange={(e) => setDataFimDepto(e.target.value)}
                  className="text-xs h-9 border-[#E0E0E0]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E0E0E0] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalDeptoOpen(false)}
                disabled={salvandoDepto}
                className="h-9 text-xs border-[#E0E0E0]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoDepto}
                className="h-9 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white"
              >
                {salvandoDepto
                  ? 'Salvando...'
                  : deptoEditando
                    ? 'Salvar Alterações'
                    : 'Vincular Departamento'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
