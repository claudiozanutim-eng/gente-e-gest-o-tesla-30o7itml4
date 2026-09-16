import React, { useState, useEffect } from 'react'
import {
  Megaphone,
  Plus,
  Archive,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  Shield,
  Send,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  AlertTriangle,
  Pencil,
  Pin,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePermission } from '@/hooks/usePermission'
import { colaboradorService, comunicadoService, logAuditoriaService } from '@/services/api'
import {
  Colaborador,
  Comunicado,
  ComunicadoCategoria,
  ComunicadoLeitura,
  ComunicadoSegmentacaoTipo,
  ComunicadoStatus,
  COMUNICADO_CATEGORIAS,
} from '@/types'
import { Switch } from '@/components/ui/switch'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

export default function GestaoComunicadosPage() {
  const { user } = useAuth()
  const tenantId = user?.tenant_id
  const { toast } = useToast()
  const { isRHOrAbove } = usePermission()

  const podeExcluir =
    isRHOrAbove || user?.perfil === 'rh' || user?.perfil === 'admin_rh' || user?.perfil === 'admin'

  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'arquivado'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')

  // Modal Criação / Edição de Publicação
  const [modalPubOpen, setModalPubOpen] = useState(false)
  const [comunicadoEmEdicao, setComunicadoEmEdicao] = useState<Comunicado | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Formulário do comunicado
  const [formTitulo, setFormTitulo] = useState('')
  const [formConteudo, setFormConteudo] = useState('')
  const [formCategoria, setFormCategoria] = useState<ComunicadoCategoria>('RH')
  const [formSegmentacaoTipo, setFormSegmentacaoTipo] = useState<ComunicadoSegmentacaoTipo>('todos')
  const [formSegmentacaoValor, setFormSegmentacaoValor] = useState('')
  const [formFixado, setFormFixado] = useState(false)
  const [formExigeConfirmacao, setFormExigeConfirmacao] = useState(false)

  // Controle de Leituras
  const [leiturasTenant, setLeiturasTenant] = useState<ComunicadoLeitura[]>([])
  const [colaboradoresTenant, setColaboradoresTenant] = useState<Colaborador[]>([])
  const [modalAcompanhamento, setModalAcompanhamento] = useState<Comunicado | null>(null)
  const [loadingAcompanhamento, setLoadingAcompanhamento] = useState(false)
  const [leiturasDoComunicado, setLeiturasDoComunicado] = useState<ComunicadoLeitura[]>([])

  // Modal Leitura/Detalhes
  const [modalVisualizar, setModalVisualizar] = useState<Comunicado | null>(null)

  // Modal de Exclusão
  const [comunicadoParaExcluir, setComunicadoParaExcluir] = useState<Comunicado | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const carregarComunicados = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const [list, leituras, colabs] = await Promise.all([
        comunicadoService.getComunicados(tenantId),
        comunicadoService.getTodasLeiturasTenant(tenantId),
        colaboradorService.getColaboradores(tenantId),
      ])
      setComunicados(list)
      setLeiturasTenant(leituras)
      setColaboradoresTenant(colabs)
    } catch (err) {
      console.error('Erro ao carregar comunicados:', err)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os comunicados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarComunicados()
  }, [tenantId])

  // Filtragem
  const comunicadosFiltrados = comunicados.filter((c) => {
    const statusAtual = c.status || 'ativo'
    if (filtroStatus !== 'todos' && statusAtual !== filtroStatus) {
      return false
    }
    if (filtroCategoria !== 'todos' && c.categoria !== filtroCategoria) {
      return false
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const matchTitulo = c.titulo.toLowerCase().includes(term)
      const matchConteudo = c.conteudo.toLowerCase().includes(term)
      const matchValor = (c.segmentacao_valor || '').toLowerCase().includes(term)
      return matchTitulo || matchConteudo || matchValor
    }
    return true
  })

  // Alternar status (Arquivar / Desarquivar)
  const handleToggleStatus = async (item: Comunicado) => {
    const isAtivo = (item.status || 'ativo') === 'ativo'
    const novoStatus: ComunicadoStatus = isAtivo ? 'arquivado' : 'ativo'

    try {
      if (isAtivo) {
        await comunicadoService.arquivarComunicado(item.id)
      } else {
        await comunicadoService.desarquivarComunicado(item.id)
      }

      setComunicados((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, status: novoStatus } : c)),
      )

      // Log de auditoria
      if (tenantId && user?.id) {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: isAtivo ? 'arquivamento_comunicado' : 'reativacao_comunicado',
          entidade: 'comunicado',
          entidade_id: item.id,
          dados_json: {
            titulo: item.titulo,
            categoria: item.categoria,
            novo_status: novoStatus,
          },
        })
      }

      toast({
        title: isAtivo ? 'Comunicado arquivado' : 'Comunicado reativado',
        description: isAtivo
          ? 'O comunicado foi removido do mural dos colaboradores sem ser excluído.'
          : 'O comunicado voltou a ficar visível no mural dos colaboradores.',
      })
    } catch {
      toast({
        title: 'Erro ao atualizar status',
        description: 'Não foi possível alterar o status do comunicado.',
        variant: 'destructive',
      })
    }
  }

  // Alternar fixar/desafixar diretamente pela tabela
  const handleToggleFixado = async (item: Comunicado) => {
    if (!tenantId || !user?.id) return
    const novoFixado = !item.fixado

    try {
      await comunicadoService.alternarFixado(item.id, novoFixado)

      setComunicados((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, fixado: novoFixado } : c)),
      )

      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: user.id,
        acao: novoFixado ? 'fixar_comunicado' : 'desafixar_comunicado',
        entidade: 'comunicado',
        entidade_id: item.id,
        dados_json: {
          titulo: item.titulo,
          fixado: novoFixado,
          usuario_executor: user.name || user.email,
        },
      })

      toast({
        title: novoFixado ? 'Comunicado fixado no topo' : 'Comunicado desafixado',
        description: novoFixado
          ? 'O comunicado agora aparece em destaque no topo do portal do colaborador.'
          : 'O comunicado retornou para a ordenação padrão por data de publicação.',
      })
    } catch (err) {
      console.error('Erro ao alternar fixado:', err)
      toast({
        title: 'Erro ao alterar destaque',
        description: 'Não foi possível alterar a fixação do comunicado.',
        variant: 'destructive',
      })
    }
  }

  // Abrir modal de acompanhamento de leituras
  const handleAbrirAcompanhamento = async (item: Comunicado) => {
    if (!tenantId) return
    setModalAcompanhamento(item)
    try {
      setLoadingAcompanhamento(true)
      const leituras = await comunicadoService.getLeiturasPorComunicado(tenantId, item.id)
      setLeiturasDoComunicado(leituras)
    } catch (err) {
      console.error('Erro ao carregar confirmações:', err)
      toast({
        title: 'Erro ao carregar confirmações',
        description: 'Não foi possível obter os detalhes de leitura.',
        variant: 'destructive',
      })
    } finally {
      setLoadingAcompanhamento(false)
    }
  }

  // Abrir modal em modo criação
  const handleAbrirCriacao = () => {
    setComunicadoEmEdicao(null)
    setFormTitulo('')
    setFormConteudo('')
    setFormCategoria('RH')
    setFormSegmentacaoTipo('todos')
    setFormSegmentacaoValor('')
    setFormFixado(false)
    setFormExigeConfirmacao(false)
    setModalPubOpen(true)
  }

  // Abrir modal em modo edição já preenchido
  const handleAbrirEdicao = (item: Comunicado) => {
    setComunicadoEmEdicao(item)
    setFormTitulo(item.titulo || '')
    setFormConteudo(item.conteudo || '')
    setFormCategoria(item.categoria || 'RH')
    setFormSegmentacaoTipo(item.segmentacao_tipo || 'todos')
    setFormSegmentacaoValor(item.segmentacao_valor || '')
    setFormFixado(Boolean(item.fixado))
    setFormExigeConfirmacao(Boolean(item.exige_confirmacao))
    setModalPubOpen(true)
  }

  // Submissão do Formulário (Criar ou Editar)
  const handleSalvarPublicacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitulo.trim() || !formConteudo.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha o título e o conteúdo da publicação.',
        variant: 'destructive',
      })
      return
    }

    if (
      (formSegmentacaoTipo === 'setor' || formSegmentacaoTipo === 'funcao') &&
      !formSegmentacaoValor.trim()
    ) {
      toast({
        title: 'Segmentação incompleta',
        description: `Informe o nome do ${formSegmentacaoTipo === 'setor' ? 'setor' : 'cargo/função'} de destino.`,
        variant: 'destructive',
      })
      return
    }

    if (!tenantId || !user?.id) return

    const valorSegmentacao =
      formSegmentacaoTipo === 'setor' || formSegmentacaoTipo === 'funcao'
        ? formSegmentacaoValor.trim()
        : ''

    try {
      setSubmitting(true)

      if (comunicadoEmEdicao) {
        // Validação de segurança de tenant
        if (comunicadoEmEdicao.tenant_id && comunicadoEmEdicao.tenant_id !== tenantId) {
          throw new Error('Acesso negado: comunicado não pertence ao tenant do usuário.')
        }

        const dadosAntes = {
          titulo: comunicadoEmEdicao.titulo,
          categoria: comunicadoEmEdicao.categoria,
          segmentacao_tipo: comunicadoEmEdicao.segmentacao_tipo,
          segmentacao_valor: comunicadoEmEdicao.segmentacao_valor,
          conteudo: comunicadoEmEdicao.conteudo,
          status: comunicadoEmEdicao.status,
          fixado: comunicadoEmEdicao.fixado,
          exige_confirmacao: comunicadoEmEdicao.exige_confirmacao,
        }

        const atualizado = await comunicadoService.updateComunicado(comunicadoEmEdicao.id, {
          titulo: formTitulo.trim(),
          conteudo: formConteudo.trim(),
          categoria: formCategoria,
          segmentacao_tipo: formSegmentacaoTipo,
          segmentacao_valor: valorSegmentacao,
          fixado: formFixado,
          exige_confirmacao: formExigeConfirmacao,
        })

        const dadosDepois = {
          titulo: atualizado.titulo,
          categoria: atualizado.categoria,
          segmentacao_tipo: atualizado.segmentacao_tipo,
          segmentacao_valor: atualizado.segmentacao_valor,
          conteudo: atualizado.conteudo,
          status: atualizado.status,
          fixado: atualizado.fixado,
          exige_confirmacao: atualizado.exige_confirmacao,
        }

        // Registrar log de auditoria com antes/depois
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: 'edicao_comunicado',
          entidade: 'comunicado',
          entidade_id: atualizado.id,
          dados_json: {
            antes: dadosAntes,
            depois: dadosDepois,
            usuario_executor: user.name || user.email,
          },
        })

        setComunicados((prev) =>
          prev.map((c) => (c.id === atualizado.id ? { ...c, ...atualizado } : c)),
        )
        setModalPubOpen(false)
        setComunicadoEmEdicao(null)

        toast({
          title: 'Comunicado atualizado com sucesso!',
          description: 'As alterações foram salvas e já estão atualizadas na listagem e no mural.',
        })
      } else {
        // Modo Criação
        const novo = await comunicadoService.createComunicado({
          tenant_id: tenantId,
          categoria: formCategoria,
          titulo: formTitulo.trim(),
          conteudo: formConteudo.trim(),
          segmentacao_tipo: formSegmentacaoTipo,
          segmentacao_valor: valorSegmentacao,
          fixado: formFixado,
          exige_confirmacao: formExigeConfirmacao,
          status: 'ativo',
          data_publicacao: new Date().toISOString(),
        })

        // Registrar auditoria
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: 'publicacao_comunicado',
          entidade: 'comunicado',
          entidade_id: novo.id,
          dados_json: {
            titulo: novo.titulo,
            categoria: novo.categoria,
            segmentacao: novo.segmentacao_tipo,
            segmentacao_valor: novo.segmentacao_valor,
            fixado: novo.fixado,
            exige_confirmacao: novo.exige_confirmacao,
            autor_nome: user.name,
          },
        })

        setComunicados((prev) => [novo, ...prev])
        setModalPubOpen(false)

        // Limpa form
        setFormTitulo('')
        setFormConteudo('')
        setFormCategoria('RH')
        setFormSegmentacaoTipo('todos')
        setFormSegmentacaoValor('')

        toast({
          title: 'Comunicado publicado com sucesso!',
          description:
            'O comunicado já está disponível no mural para os colaboradores segmentados.',
        })
      }
    } catch (err) {
      console.error('Erro ao salvar comunicado:', err)
      toast({
        title: comunicadoEmEdicao ? 'Erro ao atualizar comunicado' : 'Erro ao publicar comunicado',
        description: comunicadoEmEdicao
          ? 'Não foi possível salvar as alterações do comunicado. Verifique suas permissões e tente novamente.'
          : 'Não foi possível salvar o novo comunicado. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const formatarData = (d?: string) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return '—'
    }
  }

  // Exclusão de comunicado
  const handleConfirmarExclusao = async () => {
    if (!comunicadoParaExcluir || !tenantId) return

    try {
      setExcluindo(true)
      await comunicadoService.deleteComunicado(comunicadoParaExcluir.id, tenantId)

      // Registrar auditoria
      if (user?.id) {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: 'exclusao_comunicado',
          entidade: 'comunicado',
          entidade_id: comunicadoParaExcluir.id,
          dados_json: {
            titulo: comunicadoParaExcluir.titulo,
            categoria: comunicadoParaExcluir.categoria,
            segmentacao_tipo: comunicadoParaExcluir.segmentacao_tipo,
            segmentacao_valor: comunicadoParaExcluir.segmentacao_valor,
            status: comunicadoParaExcluir.status,
            usuario_executor: user.name || user.email,
          },
        })
      }

      setComunicados((prev) => prev.filter((c) => c.id !== comunicadoParaExcluir.id))
      setComunicadoParaExcluir(null)

      toast({
        title: 'Comunicado excluído com sucesso',
        description: `O comunicado "${comunicadoParaExcluir.titulo}" foi removido do sistema.`,
      })
    } catch (err) {
      console.error('Erro ao excluir comunicado:', err)
      toast({
        title: 'Erro ao excluir comunicado',
        description:
          'Não foi possível excluir o comunicado. Verifique suas permissões e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setExcluindo(false)
    }
  }

  // Helper para calcular métricas de confirmação de leitura por comunicado
  const getMetricasLeitura = (comunicado: Comunicado) => {
    // 1. Filtrar colaboradores segmentados para este comunicado
    const colabsAlvo = colaboradoresTenant.filter((colab) => {
      if (comunicado.segmentacao_tipo === 'todos') return true
      if (comunicado.segmentacao_tipo === 'gestores') {
        // perfil de gestor ou rh ou admin
        return true
      }
      if (comunicado.segmentacao_tipo === 'setor') {
        return (
          colab.departamento?.trim().toLowerCase() ===
          (comunicado.segmentacao_valor || '').trim().toLowerCase()
        )
      }
      if (comunicado.segmentacao_tipo === 'funcao') {
        return (
          colab.cargo?.trim().toLowerCase() ===
          (comunicado.segmentacao_valor || '').trim().toLowerCase()
        )
      }
      return true
    })

    const totalAlvo = Math.max(colabsAlvo.length, 1)

    // Contar quantas confirmações existem para este comunicado
    const confirmacoes = leiturasTenant.filter((l) => l.comunicado_id === comunicado.id)
    const totalConfirmadas = confirmacoes.length

    return {
      totalConfirmadas,
      totalAlvo,
      percentual: Math.min(Math.round((totalConfirmadas / totalAlvo) * 100), 100),
    }
  }

  const previewConfig = COMUNICADO_CATEGORIAS[formCategoria] || COMUNICADO_CATEGORIAS.RH

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
              Gestão de Comunicados
            </h1>
            <Badge
              variant="outline"
              className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-xs font-semibold"
            >
              RH & Comunicação Interna
            </Badge>
          </div>
          <p className="text-sm text-[#757575] mt-1">
            Publique, segmente e gerencie avisos oficiais para todo o time ou setores específicos.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarComunicados}
            disabled={loading}
            className="border-[#E0E0E0] text-[#212121] text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={handleAbrirCriacao}
            className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-9 gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Nova Publicação
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="border border-[#E0E0E0] bg-white p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#757575]" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar comunicado por título ou conteúdo..."
              className="pl-9 h-9 text-xs border-[#E0E0E0]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro Status */}
            <Select
              value={filtroStatus}
              onValueChange={(val) => setFiltroStatus(val as 'todos' | 'ativo' | 'arquivado')}
            >
              <SelectTrigger className="h-9 w-36 text-xs border-[#E0E0E0] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Apenas Ativos</SelectItem>
                <SelectItem value="arquivado">Apenas Arquivados</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro Categoria */}
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="h-9 w-40 text-xs border-[#E0E0E0] bg-white">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas categorias</SelectItem>
                <SelectItem value="RH">RH</SelectItem>
                <SelectItem value="Empresa">Empresa</SelectItem>
                <SelectItem value="Qualidade">Qualidade</SelectItem>
                <SelectItem value="Segurança">Segurança</SelectItem>
                <SelectItem value="Benefícios">Benefícios</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabela de Comunicados */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-[#212121] flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-[#0D47A1]" />
              Publicações ({comunicadosFiltrados.length})
            </CardTitle>
            <CardDescription className="text-xs text-[#757575]">
              Histórico completo de avisos com segmentação e controle de exibição
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-slate-100" />
              ))}
            </div>
          ) : comunicadosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <Megaphone className="h-10 w-10 text-[#9E9E9E] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-[#212121]">Nenhum comunicado encontrado</p>
              <p className="text-xs text-[#757575] mt-1">
                Ajuste os filtros de busca ou crie uma nova publicação.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0F0F0] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E0E0E0] text-[#757575] uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Comunicado</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Segmentação</th>
                    <th className="py-3 px-4">Confirmação</th>
                    <th className="py-3 px-4">Data Publicação</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5]">
                  {comunicadosFiltrados.map((item) => {
                    const catCfg =
                      COMUNICADO_CATEGORIAS[item.categoria] || COMUNICADO_CATEGORIAS.Empresa
                    const isAtivo = (item.status || 'ativo') === 'ativo'

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-[#F9FAFB] transition-colors ${
                          item.fixado ? 'bg-blue-50/40 border-l-4 border-l-[#0D47A1]' : ''
                        } ${!isAtivo ? 'opacity-65 bg-[#FAFAFA]' : ''}`}
                      >
                        <td className="py-3 px-4 max-w-sm">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.fixado && (
                              <Badge
                                variant="outline"
                                className="bg-[#0D47A1] text-white border-[#0D47A1] text-[9px] font-bold px-1.5 py-0 h-4 gap-1"
                              >
                                <Pin className="h-2.5 w-2.5 fill-current" />
                                Fixado
                              </Badge>
                            )}
                            <p className="font-bold text-[#212121] line-clamp-1">{item.titulo}</p>
                          </div>
                          <p className="text-[11px] text-[#757575] line-clamp-1 mt-0.5">
                            {item.conteudo}
                          </p>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: catCfg.color }}
                          >
                            {item.categoria}
                          </span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {item.segmentacao_tipo === 'todos' ? (
                            <span className="text-[11px] text-[#616161] font-medium">
                              Geral • Todos
                            </span>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-slate-50 border-slate-300 text-[#424242]"
                            >
                              {item.segmentacao_tipo === 'setor' &&
                                `Setor: ${item.segmentacao_valor}`}
                              {item.segmentacao_tipo === 'funcao' &&
                                `Cargo: ${item.segmentacao_valor}`}
                              {item.segmentacao_tipo === 'gestores' && 'Apenas Gestores'}
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {item.exige_confirmacao ? (
                            (() => {
                              const m = getMetricasLeitura(item)
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirAcompanhamento(item)}
                                  className="group flex flex-col items-start text-left cursor-pointer hover:opacity-85 transition-opacity"
                                  title="Ver lista de quem confirmou a leitura"
                                >
                                  <Badge
                                    variant="outline"
                                    className="bg-indigo-50 text-indigo-700 border-indigo-300 text-[10px] font-semibold gap-1 hover:bg-indigo-100"
                                  >
                                    <CheckCircle2 className="h-3 w-3 text-indigo-600" />
                                    {m.totalConfirmadas}/{m.totalAlvo} ({m.percentual}%)
                                  </Badge>
                                  <span className="text-[9px] text-[#757575] underline group-hover:text-[#0D47A1] mt-0.5">
                                    Ver confirmações
                                  </span>
                                </button>
                              )
                            })()
                          ) : (
                            <span className="text-[11px] text-slate-400">Opcional</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-[11px] text-[#757575]">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatarData(item.data_publicacao || item.created)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {isAtivo ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-semibold"
                            >
                              ● Ativo no mural
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-[#757575] border-slate-300 text-[10px] font-semibold"
                            >
                              Arquivado
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {podeExcluir && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleFixado(item)}
                                className={`h-7 px-2 text-[11px] font-semibold border ${
                                  item.fixado
                                    ? 'bg-[#0D47A1] text-white border-[#0D47A1] hover:bg-[#0A3A82]'
                                    : 'border-[#E0E0E0] text-[#616161] hover:text-[#0D47A1] hover:bg-blue-50'
                                }`}
                                title={
                                  item.fixado
                                    ? 'Desafixar do topo do portal'
                                    : 'Fixar comunicado no topo do portal'
                                }
                              >
                                <Pin
                                  className={`h-3 w-3 mr-1 ${item.fixado ? 'fill-current' : ''}`}
                                />
                                {item.fixado ? 'Fixado' : 'Fixar'}
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setModalVisualizar(item)}
                              className="h-7 px-2 text-[11px] text-[#0D47A1] hover:bg-[#E8EEF7]"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Ver
                            </Button>

                            {podeExcluir && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAbrirEdicao(item)}
                                className="h-7 px-2 text-[11px] font-semibold border border-blue-200 text-[#0D47A1] hover:bg-blue-50"
                                title="Editar comunicado"
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Editar
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(item)}
                              className={`h-7 px-2 text-[11px] font-semibold border ${
                                isAtivo
                                  ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                                  : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                              }`}
                            >
                              <Archive className="h-3 w-3 mr-1" />
                              {isAtivo ? 'Arquivar' : 'Reativar'}
                            </Button>

                            {podeExcluir && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setComunicadoParaExcluir(item)}
                                className="h-7 px-2 text-[11px] font-semibold border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                title="Excluir comunicado permanentemente"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Excluir
                              </Button>
                            )}
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

      {/* Modal Nova Publicação / Edição com Preview ao Vivo */}
      <Dialog
        open={modalPubOpen}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setModalPubOpen(false)
            setComunicadoEmEdicao(null)
          } else if (open) {
            setModalPubOpen(true)
          }
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white border border-[#E0E0E0]">
          <div className="h-2 w-full bg-[#0D47A1]" />

          <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center">
                  {comunicadoEmEdicao ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Megaphone className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-[#212121]">
                    {comunicadoEmEdicao ? 'Editar Comunicado' : 'Criar Nova Publicação'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#757575]">
                    {comunicadoEmEdicao
                      ? 'Edite as informações do comunicado e confira o preview em tempo real antes de salvar.'
                      : 'Preencha os dados e veja o preview em tempo real de como o comunicado aparecerá no mural do colaborador.'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSalvarPublicacao} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coluna 1: Campos do Formulário */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="titulo" className="text-xs font-semibold text-[#212121]">
                      Título do Comunicado *
                    </Label>
                    <Input
                      id="titulo"
                      value={formTitulo}
                      onChange={(e) => setFormTitulo(e.target.value)}
                      placeholder="Ex: Atualização da Política de Benefícios 2026"
                      className="border-[#E0E0E0] text-xs h-9"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="categoria" className="text-xs font-semibold text-[#212121]">
                      Categoria *
                    </Label>
                    <Select
                      value={formCategoria}
                      onValueChange={(val) => setFormCategoria(val as ComunicadoCategoria)}
                    >
                      <SelectTrigger id="categoria" className="border-[#E0E0E0] text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RH">RH (Azul)</SelectItem>
                        <SelectItem value="Empresa">Empresa (Cinza)</SelectItem>
                        <SelectItem value="Qualidade">Qualidade (Verde)</SelectItem>
                        <SelectItem value="Segurança">Segurança (Laranja)</SelectItem>
                        <SelectItem value="Benefícios">Benefícios (Roxo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="segmentacao" className="text-xs font-semibold text-[#212121]">
                      Segmentação de Público *
                    </Label>
                    <Select
                      value={formSegmentacaoTipo}
                      onValueChange={(val) =>
                        setFormSegmentacaoTipo(val as ComunicadoSegmentacaoTipo)
                      }
                    >
                      <SelectTrigger id="segmentacao" className="border-[#E0E0E0] text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos (Toda a empresa)</SelectItem>
                        <SelectItem value="setor">Setor específico</SelectItem>
                        <SelectItem value="funcao">Função específica</SelectItem>
                        <SelectItem value="gestores">Apenas gestores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campo Condicional de Setor */}
                  {formSegmentacaoTipo === 'setor' && (
                    <div className="space-y-1.5 animate-in fade-in-50 duration-200">
                      <Label htmlFor="setor-val" className="text-xs font-semibold text-[#0D47A1]">
                        Nome do Setor / Departamento *
                      </Label>
                      <Input
                        id="setor-val"
                        value={formSegmentacaoValor}
                        onChange={(e) => setFormSegmentacaoValor(e.target.value)}
                        placeholder="Ex: Marketing, TI, Financeiro, RH..."
                        className="border-[#0D47A1]/40 text-xs h-9"
                        required
                      />
                    </div>
                  )}

                  {/* Campo Condicional de Função */}
                  {formSegmentacaoTipo === 'funcao' && (
                    <div className="space-y-1.5 animate-in fade-in-50 duration-200">
                      <Label htmlFor="funcao-val" className="text-xs font-semibold text-[#0D47A1]">
                        Nome da Função / Cargo *
                      </Label>
                      <Input
                        id="funcao-val"
                        value={formSegmentacaoValor}
                        onChange={(e) => setFormSegmentacaoValor(e.target.value)}
                        placeholder="Ex: Analista de Marketing Pleno, Desenvolvedor..."
                        className="border-[#0D47A1]/40 text-xs h-9"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="conteudo" className="text-xs font-semibold text-[#212121]">
                      Conteúdo do Comunicado *
                    </Label>
                    <Textarea
                      id="conteudo"
                      value={formConteudo}
                      onChange={(e) => setFormConteudo(e.target.value)}
                      placeholder="Escreva a mensagem oficial com detalhes, datas e instruções para os colaboradores..."
                      rows={4}
                      className="border-[#E0E0E0] text-xs leading-relaxed"
                      required
                    />
                  </div>

                  {/* Switches: Fixar no Topo e Exigir Confirmação de Leitura */}
                  <div className="p-3 bg-[#FAFAFA] rounded-lg border border-[#E0E0E0] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="switch-fixar"
                          className="text-xs font-semibold text-[#212121] flex items-center gap-1.5"
                        >
                          <Pin className="h-3.5 w-3.5 text-[#0D47A1]" />
                          Fixar no topo do portal
                        </Label>
                        <p className="text-[10px] text-[#757575]">
                          Exibe em destaque visual antes de todos os outros avisos
                        </p>
                      </div>
                      <Switch
                        id="switch-fixar"
                        checked={formFixado}
                        onCheckedChange={setFormFixado}
                      />
                    </div>

                    <div className="border-t border-[#EAEAEA] pt-2.5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="switch-confirmacao"
                          className="text-xs font-semibold text-[#212121] flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Exigir confirmação de leitura
                        </Label>
                        <p className="text-[10px] text-[#757575]">
                          Colaborador precisará clicar em "Confirmar leitura" com registro de
                          data/hora
                        </p>
                      </div>
                      <Switch
                        id="switch-confirmacao"
                        checked={formExigeConfirmacao}
                        onCheckedChange={setFormExigeConfirmacao}
                      />
                    </div>
                  </div>
                </div>
                {/* Coluna 2: Card de Preview em Tempo Real */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-[#212121] flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-[#0D47A1]" />
                      Preview no Mural do Colaborador
                    </Label>
                    <span className="text-[10px] text-[#757575]">Visualização real</span>
                  </div>

                  {/* Card que simula exatamente o card do Mural do PortalColaborador */}
                  <div
                    className={`rounded-xl border bg-white shadow-xs overflow-hidden transition-all ${
                      formFixado ? 'border-2 border-[#0D47A1] bg-blue-50/20' : 'border-[#E0E0E0]'
                    }`}
                    style={{
                      borderTop: `4px solid ${formFixado ? '#0D47A1' : previewConfig.color}`,
                    }}
                  >
                    <div className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: previewConfig.color }}
                          >
                            {formCategoria}
                          </span>
                          {formFixado && (
                            <Badge
                              variant="outline"
                              className="bg-[#0D47A1] text-white border-[#0D47A1] text-[9px] font-bold px-1.5 py-0 h-4 gap-1"
                            >
                              <Pin className="h-2.5 w-2.5 fill-current" />
                              Fixado
                            </Badge>
                          )}
                          {formExigeConfirmacao && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] font-semibold px-1.5 py-0 h-4"
                            >
                              Confirmação obrigatória
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#757575]">
                          <Calendar className="h-3 w-3" />
                          <span>Hoje</span>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-[#212121] leading-snug line-clamp-2">
                        {formTitulo || 'Título do comunicado...'}
                      </h4>

                      <p className="text-xs text-[#616161] leading-relaxed line-clamp-3 min-h-[48px]">
                        {formConteudo ||
                          'O resumo do conteúdo do comunicado aparecerá aqui conforme você digita...'}
                      </p>

                      <div className="flex items-center justify-between pt-2.5 border-t border-[#F5F5F5] text-[11px]">
                        {formSegmentacaoTipo !== 'todos' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#757575] bg-[#F5F5F5] px-2 py-0.5 rounded">
                            {formSegmentacaoTipo === 'setor' &&
                              `Setor: ${formSegmentacaoValor || '...'}`}
                            {formSegmentacaoTipo === 'funcao' &&
                              `Cargo: ${formSegmentacaoValor || '...'}`}
                            {formSegmentacaoTipo === 'gestores' && 'Apenas Gestores'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#9E9E9E]">Geral • Todos</span>
                        )}

                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D47A1]">
                          <Eye className="h-3 w-3" />
                          Ler mais
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F8F9FA] border border-[#E0E0E0] text-[11px] text-[#616161] space-y-1">
                    <p className="font-semibold text-[#212121]">Regras de visibilidade:</p>
                    <p>
                      •{' '}
                      {comunicadoEmEdicao ? (
                        <>
                          Ao salvar, o comunicado é atualizado imediatamente para os colaboradores
                          alvo.
                        </>
                      ) : (
                        <>
                          A publicação entra no mural com status <strong>Ativo</strong>{' '}
                          imediatamente.
                        </>
                      )}
                    </p>
                    <p>
                      • Você pode <strong>Arquivar</strong> a qualquer momento para ocultar sem
                      perder o histórico.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-[#F0F0F0] flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setModalPubOpen(false)
                    setComunicadoEmEdicao(null)
                  }}
                  disabled={submitting}
                  className="border-[#E0E0E0] text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-9 gap-1.5 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {comunicadoEmEdicao ? 'Salvando...' : 'Publicando...'}
                    </>
                  ) : comunicadoEmEdicao ? (
                    <>
                      <Check className="h-4 w-4" />
                      Salvar Alterações
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Publicar
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog
        open={Boolean(comunicadoParaExcluir)}
        onOpenChange={(open) => !open && !excluindo && setComunicadoParaExcluir(null)}
      >
        <AlertDialogContent className="bg-white border border-[#E0E0E0] max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle className="text-base font-bold text-[#212121]">
                Excluir Comunicado?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-[#616161] leading-relaxed">
              Tem certeza que deseja excluir o comunicado{' '}
              <strong className="text-[#212121]">"{comunicadoParaExcluir?.titulo}"</strong>? Esta
              ação é irreversível e removerá permanentemente o aviso do mural de todos os
              colaboradores do tenant.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {comunicadoParaExcluir && (
            <div className="py-2 text-xs space-y-1.5">
              <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E0E0E0] text-[11px] text-[#424242] space-y-1">
                <p>
                  <strong>Categoria:</strong> {comunicadoParaExcluir.categoria}
                </p>
                <p>
                  <strong>Segmentação:</strong>{' '}
                  {comunicadoParaExcluir.segmentacao_tipo === 'todos'
                    ? 'Todos os colaboradores'
                    : comunicadoParaExcluir.segmentacao_tipo === 'gestores'
                      ? 'Liderança e Gestores'
                      : `${comunicadoParaExcluir.segmentacao_tipo}: ${comunicadoParaExcluir.segmentacao_valor || '—'}`}
                </p>
                <p>
                  <strong>Publicado em:</strong>{' '}
                  {formatarData(
                    comunicadoParaExcluir.data_publicacao || comunicadoParaExcluir.created,
                  )}
                </p>
              </div>
            </div>
          )}

          <AlertDialogFooter className="gap-2 pt-2 border-t border-[#F0F0F0]">
            <AlertDialogCancel
              disabled={excluindo}
              className="text-xs h-9 border-[#E0E0E0] text-[#212121]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              disabled={excluindo}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold h-9"
            >
              {excluindo ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Acompanhamento de Confirmações de Leitura */}
      <Dialog
        open={Boolean(modalAcompanhamento)}
        onOpenChange={(open) => !open && setModalAcompanhamento(null)}
      >
        {modalAcompanhamento && (
          <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border border-[#E0E0E0]">
            <div className="h-2.5 w-full bg-[#0D47A1]" />

            <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <DialogHeader className="text-left space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className="bg-indigo-50 text-indigo-700 border-indigo-300 text-xs font-bold"
                  >
                    Acompanhamento de Leitura
                  </Badge>
                  <span className="text-xs text-[#757575]">
                    Publicado em {formatarData(modalAcompanhamento.data_publicacao)}
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-[#212121]">
                  {modalAcompanhamento.titulo}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#757575]">
                  Lista completa dos colaboradores que já confirmaram a leitura e quem ainda está
                  pendente.
                </DialogDescription>
              </DialogHeader>

              {/* Barra de Progresso / Resumo */}
              {(() => {
                const metricas = getMetricasLeitura(modalAcompanhamento)
                return (
                  <div className="p-4 rounded-xl bg-slate-50 border border-[#E0E0E0] space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#212121]">Taxa de confirmação:</span>
                      <span className="text-[#0D47A1]">
                        {metricas.totalConfirmadas} de {metricas.totalAlvo} colaboradores (
                        {metricas.percentual}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#E0E0E0] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0D47A1] h-full transition-all duration-300"
                        style={{ width: `${metricas.percentual}%` }}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* Listagem das Confirmações */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#757575]">
                  Status por Colaborador
                </h4>

                {loadingAcompanhamento ? (
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="divide-y divide-[#F0F0F0] border rounded-lg border-[#E0E0E0] overflow-hidden max-h-64 overflow-y-auto">
                    {colaboradoresTenant.map((colab) => {
                      const leitura = leiturasDoComunicado.find(
                        (l) => l.usuario_id === colab.user_id,
                      )
                      const jaConfirmou = Boolean(leitura)

                      return (
                        <div
                          key={colab.id}
                          className="p-3 flex items-center justify-between text-xs hover:bg-[#FAFAFA] transition-colors"
                        >
                          <div>
                            <p className="font-semibold text-[#212121]">{colab.nome}</p>
                            <p className="text-[11px] text-[#757575]">
                              {colab.cargo || 'Colaborador'}{' '}
                              {colab.departamento ? `• ${colab.departamento}` : ''}
                            </p>
                          </div>

                          <div>
                            {jaConfirmou ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] gap-1 font-semibold"
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Confirmado em{' '}
                                {leitura?.lido_em
                                  ? new Date(leitura.lido_em).toLocaleString('pt-BR')
                                  : '—'}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1 font-semibold"
                              >
                                <Clock className="h-3 w-3 text-amber-600" />
                                Pendente
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setModalAcompanhamento(null)}
                  className="text-xs h-9 border-[#E0E0E0]"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Modal Leitura Completa de Comunicado */}
      <Dialog open={!!modalVisualizar} onOpenChange={(open) => !open && setModalVisualizar(null)}>
        {modalVisualizar && (
          <DialogContent className="max-w-xl p-0 overflow-hidden bg-white border border-[#E0E0E0]">
            <div
              className="h-2.5 w-full"
              style={{
                backgroundColor:
                  COMUNICADO_CATEGORIAS[modalVisualizar.categoria]?.color || '#0D47A1',
              }}
            />

            <div className="p-6 space-y-4">
              <DialogHeader className="text-left space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold text-white"
                    style={{
                      backgroundColor:
                        COMUNICADO_CATEGORIAS[modalVisualizar.categoria]?.color || '#0D47A1',
                    }}
                  >
                    {modalVisualizar.categoria}
                  </span>

                  <div className="flex items-center gap-1.5 text-xs text-[#757575]">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Publicado em{' '}
                      {formatarData(modalVisualizar.data_publicacao || modalVisualizar.created)}
                    </span>
                  </div>
                </div>

                <DialogTitle className="text-lg font-bold text-[#212121] leading-snug">
                  {modalVisualizar.titulo}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#757575]">
                  Segmentação:{' '}
                  <strong>
                    {modalVisualizar.segmentacao_tipo === 'todos'
                      ? 'Todos os colaboradores'
                      : modalVisualizar.segmentacao_tipo === 'gestores'
                        ? 'Liderança e Gestores'
                        : modalVisualizar.segmentacao_tipo === 'setor'
                          ? `Setor ${modalVisualizar.segmentacao_valor}`
                          : `Cargo ${modalVisualizar.segmentacao_valor}`}
                  </strong>
                </DialogDescription>
              </DialogHeader>

              <div className="py-2 text-xs md:text-sm text-[#424242] leading-relaxed whitespace-pre-wrap border-y border-[#F5F5F5] min-h-[120px]">
                {modalVisualizar.conteudo}
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <Badge
                  variant="outline"
                  className={
                    (modalVisualizar.status || 'ativo') === 'ativo'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-slate-100 text-[#757575]'
                  }
                >
                  Status: {(modalVisualizar.status || 'ativo') === 'ativo' ? 'Ativo' : 'Arquivado'}
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalVisualizar(null)}
                  className="border-[#E0E0E0] text-xs h-8"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
