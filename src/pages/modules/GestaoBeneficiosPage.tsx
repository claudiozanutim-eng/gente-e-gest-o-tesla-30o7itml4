import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Gift,
  Plus,
  Edit,
  Trash2,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Building2,
  Briefcase,
  Layers,
  ArrowLeft,
  ChevronRight,
  Shield,
  FileDown,
  Info,
  Calendar,
  MoreVertical,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { beneficioService, colaboradorService, logAuditoriaService } from '@/services/api'
import {
  Beneficio,
  BeneficioTipo,
  Colaborador,
  ColaboradorBeneficio,
  DetalhesBeneficio,
  BENEFICIOS_CONFIG,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

export default function GestaoBeneficiosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  // Estados principais
  const [beneficios, setBeneficios] = useState<Beneficio[]>([])
  const [vinculos, setVinculos] = useState<ColaboradorBeneficio[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [termoBusca, setTermoBusca] = useState<string>('')
  const [tabAtiva, setTabAtiva] = useState<'vinculos' | 'tipos'>('vinculos')

  // Modais
  const [modalVinculoAberto, setModalVinculoAberto] = useState(false)
  const [vinculoEmEdicao, setVinculoEmEdicao] = useState<ColaboradorBeneficio | null>(null)

  const [modalTipoAberto, setModalTipoAberto] = useState(false)
  const [tipoEmEdicao, setTipoEmEdicao] = useState<Beneficio | null>(null)

  const [removerVinculoConfirm, setRemoverVinculoConfirm] = useState<ColaboradorBeneficio | null>(
    null,
  )

  // Formulário do vínculo
  const [formColaboradorId, setFormColaboradorId] = useState<string>('')
  const [formBeneficioId, setFormBeneficioId] = useState<string>('')
  const [formValor, setFormValor] = useState<string>('') // string formatada para moeda

  // Campos dinâmicos do formulário conforme o tipo
  const [formOperadora, setFormOperadora] = useState<string>('')
  const [formPlano, setFormPlano] = useState<string>('')
  const [formCarteirinha, setFormCarteirinha] = useState<string>('')
  const [formRedeCredenciada, setFormRedeCredenciada] = useState<string>('')
  const [formValorCobertura, setFormValorCobertura] = useState<string>('')
  const [formDocumentoUrl, setFormDocumentoUrl] = useState<string>('')
  const [formDocumentoNome, setFormDocumentoNome] = useState<string>('')
  const [formTipoTransporte, setFormTipoTransporte] = useState<string>('')
  const [formBandeira, setFormBandeira] = useState<string>('')
  const [formValorDiario, setFormValorDiario] = useState<string>('')

  // Formulário do cadastro de tipo de benefício
  const [formTipoBeneficio, setFormTipoBeneficio] = useState<BeneficioTipo>('vt')
  const [formDescricaoTipo, setFormDescricaoTipo] = useState<string>('')

  // Carregar dados
  const carregarDados = async () => {
    if (!user?.tenant_id) return
    try {
      setLoading(true)
      const [listaBeneficios, listaVinculos, listaColabs] = await Promise.all([
        beneficioService.getBeneficiosTenant(user.tenant_id),
        beneficioService.getTodosVinculosTenant(user.tenant_id),
        colaboradorService.getColaboradores(user.tenant_id),
      ])

      setBeneficios(listaBeneficios)
      setVinculos(listaVinculos)
      setColaboradores(listaColabs.filter((c) => c.status === 'ativo'))
    } catch (err) {
      console.error('Erro ao carregar dados de benefícios do RH:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as informações do tenant.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [user?.tenant_id])

  // Formatação de moeda BRL
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  // Parse de string moeda (ex: "350,50" ou "350") para number
  const parseCurrencyInput = (val: string): number => {
    if (!val) return 0
    const cleaned = val.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  // Obter o tipo selecionado no modal de vínculo
  const tipoBeneficioSelecionado = useMemo((): BeneficioTipo | null => {
    const ben = beneficios.find((b) => b.id === formBeneficioId)
    return ben ? ben.tipo : null
  }, [beneficios, formBeneficioId])

  // Abrir modal de novo vínculo
  const handleNovoVinculo = () => {
    setVinculoEmEdicao(null)
    setFormColaboradorId('')
    setFormBeneficioId(beneficios[0]?.id || '')
    setFormValor('')
    // Limpar dinâmicos
    setFormOperadora('')
    setFormPlano('')
    setFormCarteirinha('')
    setFormRedeCredenciada('')
    setFormValorCobertura('')
    setFormDocumentoUrl('')
    setFormDocumentoNome('')
    setFormTipoTransporte('')
    setFormBandeira('')
    setFormValorDiario('')
    setModalVinculoAberto(true)
  }

  // Abrir modal de edição de vínculo
  const handleEditarVinculo = (vinculo: ColaboradorBeneficio) => {
    setVinculoEmEdicao(vinculo)
    setFormColaboradorId(vinculo.colaborador_id)
    setFormBeneficioId(vinculo.beneficio_id)
    setFormValor(vinculo.valor !== undefined ? String(vinculo.valor).replace('.', ',') : '')

    const det = vinculo.detalhes_json || {}
    setFormOperadora(det.operadora || '')
    setFormPlano(det.plano || '')
    setFormCarteirinha(det.carteirinha || '')
    setFormRedeCredenciada(det.rede_credenciada || '')
    setFormValorCobertura(
      det.valor_cobertura !== undefined ? String(det.valor_cobertura).replace('.', ',') : '',
    )
    setFormDocumentoUrl(det.documento_beneficiario_url || '')
    setFormDocumentoNome(det.documento_beneficiario_nome || '')
    setFormTipoTransporte(det.tipo_transporte || '')
    setFormBandeira(det.bandeira || '')
    setFormValorDiario(
      det.valor_diario !== undefined ? String(det.valor_diario).replace('.', ',') : '',
    )

    setModalVinculoAberto(true)
  }

  // Salvar criação ou edição de vínculo
  const handleSalvarVinculo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.tenant_id) return

    if (!formColaboradorId) {
      toast({
        title: 'Selecione o colaborador',
        description: 'É necessário indicar qual colaborador receberá o benefício.',
        variant: 'destructive',
      })
      return
    }

    if (!formBeneficioId) {
      toast({
        title: 'Selecione o benefício',
        description: 'É necessário indicar o tipo de benefício.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)

      const valorNumerico = parseCurrencyInput(formValor)
      const valorCoberturaNumerico = formValorCobertura
        ? parseCurrencyInput(formValorCobertura)
        : undefined
      const valorDiarioNumerico = formValorDiario ? parseCurrencyInput(formValorDiario) : undefined

      // Montar objeto de detalhes_json conforme campos preenchidos
      const detalhes: DetalhesBeneficio = {}
      if (formOperadora) detalhes.operadora = formOperadora.trim()
      if (formPlano) detalhes.plano = formPlano.trim()
      if (formCarteirinha) detalhes.carteirinha = formCarteirinha.trim()
      if (formRedeCredenciada) detalhes.rede_credenciada = formRedeCredenciada.trim()
      if (valorCoberturaNumerico) detalhes.valor_cobertura = valorCoberturaNumerico
      if (formDocumentoUrl) detalhes.documento_beneficiario_url = formDocumentoUrl.trim()
      if (formDocumentoNome) detalhes.documento_beneficiario_nome = formDocumentoNome.trim()
      if (formTipoTransporte) detalhes.tipo_transporte = formTipoTransporte.trim()
      if (formBandeira) detalhes.bandeira = formBandeira.trim()
      if (valorDiarioNumerico) detalhes.valor_diario = valorDiarioNumerico

      const colabObj = colaboradores.find((c) => c.id === formColaboradorId)
      const benObj = beneficios.find((b) => b.id === formBeneficioId)

      if (vinculoEmEdicao) {
        // Atualizar
        const atualizado = await beneficioService.updateVinculo(vinculoEmEdicao.id, {
          colaborador_id: formColaboradorId,
          beneficio_id: formBeneficioId,
          valor: valorNumerico,
          detalhes_json: detalhes,
        })

        // Log de Auditoria
        await logAuditoriaService.registrarLog({
          tenant_id: user.tenant_id,
          user_id: user.id,
          acao: 'editar_colaborador_beneficio',
          entidade: 'colaborador_beneficio',
          entidade_id: vinculoEmEdicao.id,
          dados_json: {
            colaborador_id: formColaboradorId,
            colaborador_nome: colabObj?.nome || '',
            beneficio_id: formBeneficioId,
            beneficio_tipo: benObj?.tipo || '',
            valor: valorNumerico,
          },
        })

        toast({
          title: 'Vínculo atualizado',
          description: `O benefício de ${colabObj?.nome || 'colaborador'} foi atualizado com sucesso.`,
        })
      } else {
        // Criar novo
        const criado = await beneficioService.vincularBeneficio({
          tenant_id: user.tenant_id,
          colaborador_id: formColaboradorId,
          beneficio_id: formBeneficioId,
          valor: valorNumerico,
          detalhes_json: detalhes,
        })

        // Log de Auditoria
        await logAuditoriaService.registrarLog({
          tenant_id: user.tenant_id,
          user_id: user.id,
          acao: 'vincular_colaborador_beneficio',
          entidade: 'colaborador_beneficio',
          entidade_id: criado.id,
          dados_json: {
            colaborador_id: formColaboradorId,
            colaborador_nome: colabObj?.nome || '',
            beneficio_id: formBeneficioId,
            beneficio_tipo: benObj?.tipo || '',
            valor: valorNumerico,
          },
        })

        toast({
          title: 'Benefício vinculado com sucesso',
          description: `Vínculo cadastrado para ${colabObj?.nome || 'colaborador'}.`,
        })
      }

      setModalVinculoAberto(false)
      await carregarDados()
    } catch (err) {
      console.error('Erro ao salvar vínculo de benefício:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as alterações do vínculo.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Remover vínculo
  const handleConfirmarRemover = async () => {
    if (!removerVinculoConfirm || !user?.tenant_id) return
    try {
      setSaving(true)
      const id = removerVinculoConfirm.id
      const colabNome = removerVinculoConfirm.expand?.colaborador_id?.nome || ''
      const benTipo = removerVinculoConfirm.expand?.beneficio_id?.tipo || ''

      await beneficioService.removerVinculo(id)

      // Log de Auditoria
      await logAuditoriaService.registrarLog({
        tenant_id: user.tenant_id,
        user_id: user.id,
        acao: 'remover_colaborador_beneficio',
        entidade: 'colaborador_beneficio',
        entidade_id: id,
        dados_json: {
          colaborador_nome: colabNome,
          beneficio_tipo: benTipo,
        },
      })

      toast({
        title: 'Vínculo removido',
        description: 'O benefício foi desvinculado do colaborador.',
      })

      setRemoverVinculoConfirm(null)
      await carregarDados()
    } catch (err) {
      console.error('Erro ao remover vínculo:', err)
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover o vínculo do colaborador.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Abrir modal de criação/edição de tipo de benefício
  const handleNovoTipo = () => {
    setTipoEmEdicao(null)
    setFormTipoBeneficio('vt')
    setFormDescricaoTipo('')
    setModalTipoAberto(true)
  }

  const handleEditarTipo = (item: Beneficio) => {
    setTipoEmEdicao(item)
    setFormTipoBeneficio(item.tipo)
    setFormDescricaoTipo(item.descricao || '')
    setModalTipoAberto(true)
  }

  // Salvar tipo de benefício
  const handleSalvarTipo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.tenant_id) return

    try {
      setSaving(true)
      if (tipoEmEdicao) {
        await beneficioService.updateBeneficio(tipoEmEdicao.id, {
          descricao: formDescricaoTipo.trim(),
        })

        // Log de Auditoria
        await logAuditoriaService.registrarLog({
          tenant_id: user.tenant_id,
          user_id: user.id,
          acao: 'editar_beneficio_tipo',
          entidade: 'beneficio',
          entidade_id: tipoEmEdicao.id,
          dados_json: {
            tipo: tipoEmEdicao.tipo,
            descricao: formDescricaoTipo.trim(),
          },
        })

        toast({
          title: 'Tipo de benefício atualizado',
          description: 'A descrição foi atualizada com sucesso.',
        })
      } else {
        const criado = await beneficioService.createBeneficio({
          tenant_id: user.tenant_id,
          tipo: formTipoBeneficio,
          descricao: formDescricaoTipo.trim(),
        })

        // Log de Auditoria
        await logAuditoriaService.registrarLog({
          tenant_id: user.tenant_id,
          user_id: user.id,
          acao: 'criar_beneficio_tipo',
          entidade: 'beneficio',
          entidade_id: criado.id,
          dados_json: {
            tipo: formTipoBeneficio,
            descricao: formDescricaoTipo.trim(),
          },
        })

        toast({
          title: 'Tipo de benefício criado',
          description: 'Novo tipo de benefício adicionado ao catálogo do tenant.',
        })
      }

      setModalTipoAberto(false)
      await carregarDados()
    } catch (err) {
      console.error('Erro ao salvar tipo de benefício:', err)
      toast({
        title: 'Erro ao salvar tipo',
        description: 'Não foi possível cadastrar ou editar o tipo de benefício.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Filtro de vínculos
  const vinculosFiltrados = useMemo(() => {
    return vinculos.filter((item) => {
      const benTipo = item.expand?.beneficio_id?.tipo || ''
      const colabNome = (item.expand?.colaborador_id?.nome || '').toLowerCase()
      const colabDepto = (item.expand?.colaborador_id?.departamento || '').toLowerCase()

      // Filtro de tipo
      if (filtroTipo !== 'todos' && benTipo !== filtroTipo) {
        return false
      }

      // Filtro de busca textual
      if (termoBusca) {
        const q = termoBusca.toLowerCase()
        return colabNome.includes(q) || colabDepto.includes(q)
      }

      return true
    })
  }, [vinculos, filtroTipo, termoBusca])

  // Contagem de colaboradores vinculados por tipo
  const contagemPorTipo = useMemo(() => {
    const map: Record<string, number> = {}
    vinculos.forEach((v) => {
      const t = v.expand?.beneficio_id?.tipo || 'outro'
      map[t] = (map[t] || 0) + 1
    })
    return map
  }, [vinculos])

  // Total geral investido
  const totalInvestidoTenant = useMemo(() => {
    return vinculos.reduce((acc, curr) => acc + (curr.valor || 0), 0)
  }, [vinculos])

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header do Painel RH */}
      <div className="relative overflow-hidden rounded-2xl border border-[#0D47A1]/20 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1E88E5] p-6 md:p-8 text-white shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Briefcase className="h-3.5 w-3.5 text-blue-200" />
              <span>Gestão de Pessoas & Benefícios • RH</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Gestão de Benefícios
            </h1>
            <p className="text-sm md:text-base text-white/90 max-w-2xl leading-relaxed">
              Gerencie os benefícios ativos da organização, vincule colaboradores, configure valores
              e detalhes de operadoras de saúde, odontologia e seguro de vida corporativo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/beneficios')}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs font-semibold h-10 px-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Visão Colaborador
            </Button>

            <Button
              onClick={handleNovoVinculo}
              className="bg-white text-[#0D47A1] hover:bg-white/90 font-bold shadow-xs text-xs gap-1.5 h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              Vincular Benefício
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Métricas e Indicadores Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E0E0E0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
              Vínculos Ativos
            </span>
            <div className="h-8 w-8 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center font-bold">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-[#212121] mt-2">{vinculos.length}</h3>
          <p className="text-[11px] text-[#757575] mt-0.5">
            Benefícios atribuídos aos colaboradores
          </p>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
              Tipos Cadastrados
            </span>
            <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Gift className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-[#212121] mt-2">{beneficios.length} de 6</h3>
          <p className="text-[11px] text-[#757575] mt-0.5">Catálogo disponível no tenant</p>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
              Colaboradores Ativos
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-[#0D47A1] flex items-center justify-center font-bold">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-[#212121] mt-2">{colaboradores.length}</h3>
          <p className="text-[11px] text-[#757575] mt-0.5">Base elegível para inclusão</p>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
              Folha Mensal de Benefícios
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-emerald-700 mt-2">
            {formatCurrency(totalInvestidoTenant)}
          </h3>
          <p className="text-[11px] text-[#757575] mt-0.5">Soma mensal dos subsídios</p>
        </div>
      </div>

      {/* 3. Navegação em Abas: Vínculos de Colaboradores e Catálogo de Tipos */}
      <Tabs
        value={tabAtiva}
        onValueChange={(val) => setTabAtiva(val as 'vinculos' | 'tipos')}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-2">
          <TabsList className="bg-[#EEEEEE] p-1 h-10">
            <TabsTrigger
              value="vinculos"
              className="text-xs font-bold data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white h-8 px-4"
            >
              Vínculos de Colaboradores ({vinculos.length})
            </TabsTrigger>
            <TabsTrigger
              value="tipos"
              className="text-xs font-bold data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white h-8 px-4"
            >
              Tipos de Benefício ({beneficios.length})
            </TabsTrigger>
          </TabsList>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="text-xs border-[#E0E0E0] text-[#757575] hover:text-[#212121] h-8 gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Recarregar
          </Button>
        </div>

        {/* ABA 1: VÍNCULOS DE COLABORADORES */}
        <TabsContent value="vinculos" className="space-y-5 m-0">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-xl border border-[#E0E0E0] shadow-xs">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9E9E9E]" />
              <Input
                placeholder="Buscar por nome do colaborador ou departamento..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="pl-9 h-9 text-xs border-[#E0E0E0] focus-visible:ring-[#0D47A1]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-[#757575] shrink-0" />
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-9 text-xs border-[#E0E0E0] w-full sm:w-[220px]">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="todos">Todos os tipos de benefício</SelectItem>
                  {Object.entries(BENEFICIOS_CONFIG).map(([chave, cfg]) => (
                    <SelectItem key={chave} value={chave}>
                      {cfg.emoji} {cfg.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela de Vínculos */}
          <div className="rounded-xl border border-[#E0E0E0] bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E0E0E0] text-[11px] font-semibold text-[#757575] uppercase tracking-wider">
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Benefício</th>
                    <th className="py-3 px-4">Valor Mensal</th>
                    <th className="py-3 px-4">Detalhes Cadastrados</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0] text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#757575]">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#0D47A1] mb-2" />
                        Carregando vínculos de benefícios...
                      </td>
                    </tr>
                  ) : vinculosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[#757575]">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F5F5] mb-2">
                          <Gift className="h-6 w-6 text-[#9E9E9E]" />
                        </div>
                        <p className="font-semibold text-[#212121]">Nenhum vínculo encontrado</p>
                        <p className="text-[11px] text-[#757575] mt-0.5">
                          {termoBusca || filtroTipo !== 'todos'
                            ? 'Tente ajustar os filtros de busca acima.'
                            : 'Clique em "Vincular Benefício" para atribuir benefícios aos colaboradores.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    vinculosFiltrados.map((item) => {
                      const colab = item.expand?.colaborador_id
                      const ben = item.expand?.beneficio_id
                      const tipo = (ben?.tipo || 'vt') as BeneficioTipo
                      const cfg = BENEFICIOS_CONFIG[tipo] || BENEFICIOS_CONFIG.vt
                      const det = item.detalhes_json || {}

                      return (
                        <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors group">
                          {/* Colaborador */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {colab?.foto_url ? (
                                <img
                                  src={colab.foto_url}
                                  alt={colab.nome}
                                  className="h-8 w-8 rounded-full object-cover border border-[#E0E0E0]"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center font-bold text-xs">
                                  {colab?.nome?.charAt(0) || 'C'}
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-[#212121] block">
                                  {colab?.nome || 'Colaborador não identificado'}
                                </span>
                                <span className="text-[11px] text-[#757575]">
                                  {colab?.departamento || 'Geral'} • {colab?.cargo || 'Efetivo'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Benefício */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{cfg.emoji}</span>
                              <div>
                                <span className="font-semibold text-[#212121] block">
                                  {cfg.nome}
                                </span>
                                <span className="text-[10px] text-[#757575]">{cfg.categoria}</span>
                              </div>
                            </div>
                          </td>

                          {/* Valor */}
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-[#0D47A1]">
                              {formatCurrency(item.valor)}
                            </span>
                          </td>

                          {/* Detalhes específicos */}
                          <td className="py-3 px-4 max-w-[280px]">
                            {tipo === 'plano_saude' && (
                              <div className="space-y-0.5 text-[11px]">
                                <div>
                                  <strong className="text-[#C62828]">
                                    {det.operadora || 'Operadora'}
                                  </strong>
                                  {' — '}
                                  <span className="text-[#424242]">{det.plano || 'Plano'}</span>
                                </div>
                                <div className="font-mono text-[10px] text-[#757575]">
                                  Cartão: {det.carteirinha || '—'}
                                </div>
                              </div>
                            )}

                            {tipo === 'seguro_vida' && (
                              <div className="space-y-0.5 text-[11px]">
                                <div className="text-[#0D47A1] font-semibold">
                                  {det.seguradora || 'MetLife'} • Apólice: {det.apolice || '—'}
                                </div>
                                <div className="text-[10px] text-[#757575]">
                                  Cobertura:{' '}
                                  {det.valor_cobertura
                                    ? formatCurrency(det.valor_cobertura as number)
                                    : det.cobertura_morte || '—'}
                                </div>
                              </div>
                            )}

                            {tipo === 'plano_odonto' && (
                              <div className="space-y-0.5 text-[11px]">
                                <div className="text-[#00695C] font-semibold">
                                  {det.operadora || 'OdontoPrev'}
                                </div>
                                <div className="font-mono text-[10px] text-[#757575]">
                                  Cartão: {det.carteirinha || '—'}
                                </div>
                              </div>
                            )}

                            {tipo === 'vt' && (
                              <div className="text-[11px] text-[#424242]">
                                {det.tipo_transporte || 'Transporte Público'}
                                {det.numero_cartao && (
                                  <span className="font-mono text-[10px] text-[#757575] block">
                                    Cartão: {det.numero_cartao}
                                  </span>
                                )}
                              </div>
                            )}

                            {(tipo === 'vr' || tipo === 'va') && (
                              <div className="text-[11px] text-[#424242]">
                                {det.bandeira || 'Flash Benefícios'}
                                {det.valor_diario && (
                                  <span className="text-[#E65100] font-semibold block">
                                    {formatCurrency(det.valor_diario as number)} / dia
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditarVinculo(item)}
                                className="h-7 text-xs px-2.5 border-[#E0E0E0] text-[#0D47A1] hover:bg-[#E8EEF7]"
                              >
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                Editar
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRemoverVinculoConfirm(item)}
                                className="h-7 text-xs px-2.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Remover
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ABA 2: CATÁLOGO DE TIPOS DE BENEFÍCIO */}
        <TabsContent value="tipos" className="space-y-5 m-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#212121]">
                Catálogo de Tipos de Benefício do Tenant
              </h3>
              <p className="text-xs text-[#757575]">
                Configure as descrições e diretrizes institucionais de cada tipo de benefício
                oferecido.
              </p>
            </div>

            <Button
              onClick={handleNovoTipo}
              className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-9 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Novo Tipo
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {beneficios.map((ben) => {
              const cfg = BENEFICIOS_CONFIG[ben.tipo] || BENEFICIOS_CONFIG.vt
              const vinculosDesteTipo = contagemPorTipo[ben.tipo] || 0

              return (
                <Card
                  key={ben.id}
                  className="border border-[#E0E0E0] bg-white shadow-xs flex flex-col justify-between"
                  style={{ borderTop: `3px solid ${cfg.cor}` }}
                >
                  <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{cfg.emoji}</span>
                        <div>
                          <CardTitle className="text-sm font-bold text-[#212121]">
                            {cfg.nome}
                          </CardTitle>
                          <span className="text-[10px] text-[#757575] font-mono">
                            Código: {ben.tipo}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-50 text-[#616161] border-slate-200"
                      >
                        {vinculosDesteTipo} {vinculosDesteTipo === 1 ? 'vinculado' : 'vinculados'}
                      </Badge>
                    </div>

                    <CardDescription className="text-xs text-[#616161] line-clamp-3">
                      {ben.descricao || cfg.descricaoPadrao}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-[#757575]">{cfg.categoria}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditarTipo(ben)}
                      className="text-xs font-semibold text-[#0D47A1] hover:text-[#0A3A82] hover:bg-[#E8EEF7] h-7 px-2 gap-1"
                    >
                      <Edit className="h-3 w-3" />
                      Editar Descrição
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL: VINCULAR OU EDITAR BENEFÍCIO */}
      <Dialog open={modalVinculoAberto} onOpenChange={setModalVinculoAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-white border border-[#E0E0E0]">
          <form onSubmit={handleSalvarVinculo}>
            <div className="h-2 w-full bg-[#0D47A1]" />

            <div className="p-6 space-y-5">
              <DialogHeader className="text-left space-y-1">
                <DialogTitle className="text-lg font-bold text-[#212121]">
                  {vinculoEmEdicao
                    ? 'Editar Vínculo de Benefício'
                    : 'Vincular Benefício ao Colaborador'}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#757575]">
                  Informe o colaborador, o tipo de benefício, o valor financeiro mensal e os campos
                  específicos.
                </DialogDescription>
              </DialogHeader>

              {/* Campos Principais: Colaborador, Benefício, Valor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dropdown de Colaborador */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#424242]">
                    Colaborador (Ativos do Tenant) *
                  </Label>
                  <Select
                    value={formColaboradorId}
                    onValueChange={setFormColaboradorId}
                    disabled={saving}
                  >
                    <SelectTrigger className="text-xs h-9 border-[#E0E0E0]">
                      <SelectValue placeholder="Selecione o colaborador..." />
                    </SelectTrigger>
                    <SelectContent className="text-xs max-h-56">
                      {colaboradores.map((colab) => (
                        <SelectItem key={colab.id} value={colab.id}>
                          {colab.nome} — {colab.departamento} ({colab.cargo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dropdown de Tipo de Benefício */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#424242]">Tipo de Benefício *</Label>
                  <Select
                    value={formBeneficioId}
                    onValueChange={setFormBeneficioId}
                    disabled={saving}
                  >
                    <SelectTrigger className="text-xs h-9 border-[#E0E0E0]">
                      <SelectValue placeholder="Selecione o benefício..." />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {beneficios.map((ben) => {
                        const cfg = BENEFICIOS_CONFIG[ben.tipo] || BENEFICIOS_CONFIG.vt
                        return (
                          <SelectItem key={ben.id} value={ben.id}>
                            {cfg.emoji} {cfg.nome}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Campo de Valor em Reais (BRL) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#424242]">
                    Valor Mensal Subsidiado (R$)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#757575]">
                      R$
                    </span>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={formValor}
                      onChange={(e) => setFormValor(e.target.value)}
                      className="pl-9 h-9 text-xs border-[#E0E0E0] focus-visible:ring-[#0D47A1]"
                    />
                  </div>
                  <span className="text-[10px] text-[#757575]">
                    Exemplo: 340,00 (use vírgula para centavos)
                  </span>
                </div>
              </div>

              {/* CAMPOS DINÂMICOS CONFORME O TIPO DO BENEFÍCIO SELECIONADO */}
              <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="text-lg">
                    {tipoBeneficioSelecionado
                      ? BENEFICIOS_CONFIG[tipoBeneficioSelecionado]?.emoji
                      : '⚙️'}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[#212121]">
                      Campos Específicos:{' '}
                      {tipoBeneficioSelecionado
                        ? BENEFICIOS_CONFIG[tipoBeneficioSelecionado]?.nome
                        : 'Selecione um benefício'}
                    </h4>
                    <span className="text-[10px] text-[#757575]">
                      Armazenados com segurança no formato JSON customizado
                    </span>
                  </div>
                </div>

                {/* Campos para Plano de Saúde (plano_saude) */}
                {tipoBeneficioSelecionado === 'plano_saude' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">Operadora</Label>
                      <Input
                        placeholder="Ex: Bradesco Saúde, Amil, SulAmérica"
                        value={formOperadora}
                        onChange={(e) => setFormOperadora(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Nome do Plano
                      </Label>
                      <Input
                        placeholder="Ex: Top Nacional Plus, Essencial Apartamento"
                        value={formPlano}
                        onChange={(e) => setFormPlano(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Número da Carteirinha
                      </Label>
                      <Input
                        placeholder="Ex: 892.401.829.102.001-4"
                        value={formCarteirinha}
                        onChange={(e) => setFormCarteirinha(e.target.value)}
                        className="h-8 text-xs bg-white font-mono border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Rede Credenciada / Hospitais de Destaque
                      </Label>
                      <Textarea
                        placeholder="Ex: Albert Einstein, Sírio-Libanês, Samaritano, Laboratórios Fleury..."
                        value={formRedeCredenciada}
                        onChange={(e) => setFormRedeCredenciada(e.target.value)}
                        rows={2}
                        className="text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                  </div>
                )}

                {/* Campos para Seguro de Vida (seguro_vida) */}
                {tipoBeneficioSelecionado === 'seguro_vida' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">Seguradora</Label>
                      <Input
                        placeholder="Ex: MetLife Seguros, Porto Seguro, Icatu"
                        value={formOperadora}
                        onChange={(e) => setFormOperadora(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Número da Apólice
                      </Label>
                      <Input
                        placeholder="Ex: AP-TESLA-89210-SP"
                        value={formPlano}
                        onChange={(e) => setFormPlano(e.target.value)}
                        className="h-8 text-xs bg-white font-mono border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Valor da Cobertura (R$)
                      </Label>
                      <Input
                        placeholder="Ex: 250000,00"
                        value={formValorCobertura}
                        onChange={(e) => setFormValorCobertura(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Nome do Documento / Apólice
                      </Label>
                      <Input
                        placeholder="Ex: Termo_Beneficiarios.pdf"
                        value={formDocumentoNome}
                        onChange={(e) => setFormDocumentoNome(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Link / URL do Documento de Beneficiário
                      </Label>
                      <Input
                        placeholder="https://... ou anexo de termo assinado"
                        value={formDocumentoUrl}
                        onChange={(e) => setFormDocumentoUrl(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                      <span className="text-[10px] text-[#757575]">
                        Permite que o colaborador faça o download direto no card do painel
                      </span>
                    </div>
                  </div>
                )}

                {/* Campos para Plano Odontológico (plano_odonto) */}
                {tipoBeneficioSelecionado === 'plano_odonto' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">Operadora</Label>
                      <Input
                        placeholder="Ex: OdontoPrev, Unimed Odonto"
                        value={formOperadora}
                        onChange={(e) => setFormOperadora(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Nome do Plano
                      </Label>
                      <Input
                        placeholder="Ex: Dental Master Premium"
                        value={formPlano}
                        onChange={(e) => setFormPlano(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Número da Carteirinha
                      </Label>
                      <Input
                        placeholder="Ex: OP-491.029.381-00"
                        value={formCarteirinha}
                        onChange={(e) => setFormCarteirinha(e.target.value)}
                        className="h-8 text-xs bg-white font-mono border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Rede / Abrangência
                      </Label>
                      <Input
                        placeholder="Ex: Rede OdontoPrev Nacional (28 mil clínicas)"
                        value={formRedeCredenciada}
                        onChange={(e) => setFormRedeCredenciada(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                  </div>
                )}

                {/* Campos para Vale Transporte (vt) */}
                {tipoBeneficioSelecionado === 'vt' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Modal / Tipo de Transporte
                      </Label>
                      <Input
                        placeholder="Ex: Metrô e Ônibus SPTrans, EMTU"
                        value={formTipoTransporte}
                        onChange={(e) => setFormTipoTransporte(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Número do Cartão Bilhete
                      </Label>
                      <Input
                        placeholder="Ex: 9821.4402.1902.8821"
                        value={formCarteirinha}
                        onChange={(e) => setFormCarteirinha(e.target.value)}
                        className="h-8 text-xs bg-white font-mono border-[#E0E0E0]"
                      />
                    </div>
                  </div>
                )}

                {/* Campos para VR / VA */}
                {(tipoBeneficioSelecionado === 'vr' || tipoBeneficioSelecionado === 'va') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Bandeira do Cartão
                      </Label>
                      <Input
                        placeholder="Ex: Flash Benefícios, Ticket, Alelo"
                        value={formBandeira}
                        onChange={(e) => setFormBandeira(e.target.value)}
                        className="h-8 text-xs bg-white border-[#E0E0E0]"
                      />
                    </div>
                    {tipoBeneficioSelecionado === 'vr' && (
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-[#424242]">
                          Valor Diário (R$)
                        </Label>
                        <Input
                          placeholder="Ex: 40,00"
                          value={formValorDiario}
                          onChange={(e) => setFormValorDiario(e.target.value)}
                          className="h-8 text-xs bg-white border-[#E0E0E0]"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#424242]">
                        Final do Cartão
                      </Label>
                      <Input
                        placeholder="Ex: 4091"
                        maxLength={4}
                        value={formCarteirinha}
                        onChange={(e) => setFormCarteirinha(e.target.value)}
                        className="h-8 text-xs bg-white font-mono border-[#E0E0E0]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#F0F0F0]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalVinculoAberto(false)}
                  disabled={saving}
                  className="text-xs border-[#E0E0E0]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold"
                >
                  {saving
                    ? 'Salvando vínculo...'
                    : vinculoEmEdicao
                      ? 'Salvar Alterações'
                      : 'Cadastrar Vínculo'}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CRIAR / EDITAR TIPO DE BENEFÍCIO */}
      <Dialog open={modalTipoAberto} onOpenChange={setModalTipoAberto}>
        <DialogContent className="max-w-md p-0 bg-white border border-[#E0E0E0]">
          <form onSubmit={handleSalvarTipo}>
            <div className="h-2 w-full bg-[#0D47A1]" />

            <div className="p-6 space-y-4">
              <DialogHeader className="text-left space-y-1">
                <DialogTitle className="text-lg font-bold text-[#212121]">
                  {tipoEmEdicao ? 'Editar Tipo de Benefício' : 'Novo Tipo de Benefício'}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#757575]">
                  {tipoEmEdicao
                    ? `Alterar descrição oficial para o tipo ${tipoEmEdicao.tipo.toUpperCase()}.`
                    : 'Cadastrar novo tipo de benefício no catálogo corporativo.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#424242]">Código do Tipo *</Label>
                  <Select
                    value={formTipoBeneficio}
                    onValueChange={(val) => setFormTipoBeneficio(val as BeneficioTipo)}
                    disabled={!!tipoEmEdicao || saving}
                  >
                    <SelectTrigger className="text-xs h-9 border-[#E0E0E0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {Object.entries(BENEFICIOS_CONFIG).map(([chave, cfg]) => (
                        <SelectItem key={chave} value={chave}>
                          {cfg.emoji} {cfg.nome} ({chave})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {tipoEmEdicao && (
                    <span className="text-[10px] text-[#757575]">
                      O código do tipo é fixo após a criação para manter a integridade com os
                      vínculos.
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#424242]">Descrição Corporativa</Label>
                  <Textarea
                    placeholder="Descreva as regras gerais, operadora padrão ou política da empresa..."
                    value={formDescricaoTipo}
                    onChange={(e) => setFormDescricaoTipo(e.target.value)}
                    rows={4}
                    className="text-xs border-[#E0E0E0]"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#F0F0F0]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalTipoAberto(false)}
                  disabled={saving}
                  className="text-xs border-[#E0E0E0]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold"
                >
                  {saving ? 'Gravando...' : 'Salvar Tipo'}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CONFIRMAÇÃO DE REMOÇÃO DE VÍNCULO */}
      <AlertDialog
        open={!!removerVinculoConfirm}
        onOpenChange={(open) => !open && setRemoverVinculoConfirm(null)}
      >
        <AlertDialogContent className="bg-white border border-[#E0E0E0] max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle className="text-base font-bold text-[#212121]">
                Remover Vínculo de Benefício?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-[#616161] leading-relaxed">
              Você está prestes a remover o benefício{' '}
              <strong className="text-[#212121]">
                {removerVinculoConfirm?.expand?.beneficio_id?.tipo
                  ? BENEFICIOS_CONFIG[
                      removerVinculoConfirm.expand.beneficio_id.tipo as BeneficioTipo
                    ]?.nome
                  : 'selecionado'}
              </strong>{' '}
              vinculado a{' '}
              <strong className="text-[#212121]">
                {removerVinculoConfirm?.expand?.colaborador_id?.nome || 'colaborador'}
              </strong>
              . Essa ação será registrada na trilha de auditoria do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={saving}
              className="text-xs border-[#E0E0E0] text-[#212121]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarRemover}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              {saving ? 'Removendo...' : 'Sim, Remover Vínculo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
