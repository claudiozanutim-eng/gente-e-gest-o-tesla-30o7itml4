import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  Plus,
  Search,
  Filter,
  AlertCircle,
  FileCheck,
  Shield,
  Calendar,
  Building2,
  X,
  File,
  AlertTriangle,
  FolderOpen,
  Edit,
  History,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { cienciaDocumentoService } from '@/services/api'
import { CienciaDocumento } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { documentoService, logAuditoriaService } from '@/services/api'
import { CategoriaDocumento, Documento } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useToast } from '@/hooks/use-toast'

export default function GestaoDocumentosPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('todos')
  const [filtroObrigatorio, setFiltroObrigatorio] = useState<string>('todos') // 'todos' | 'sim' | 'nao'

  // Modal de Novo Upload (RH/Admin)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaCategoriaId, setNovaCategoriaId] = useState('')
  const [novaVersao, setNovaVersao] = useState('1.0')
  const [isObrigatorio, setIsObrigatorio] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Modal de Exclusão
  const [docParaExcluir, setDocParaExcluir] = useState<Documento | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Modal de Edição / Nova Versão de Documento Existente
  const [docParaEditar, setDocParaEditar] = useState<Documento | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editCategoriaId, setEditCategoriaId] = useState('')
  const [editVersao, setEditVersao] = useState('')
  const [editObrigatorio, setEditObrigatorio] = useState(false)
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editFileError, setEditFileError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement | null>(null)

  // Modal de Histórico de Ciências
  const [docParaVerCiencias, setDocParaVerCiencias] = useState<Documento | null>(null)
  const [cienciasDoc, setCienciasDoc] = useState<CienciaDocumento[]>([])
  const [loadingCiencias, setLoadingCiencias] = useState(false)

  const tenantId = user?.tenant_id

  const carregarDados = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const [cats, docs] = await Promise.all([
        documentoService.getCategorias(tenantId),
        documentoService.getDocumentos(tenantId),
      ])
      setCategorias(cats)
      setDocumentos(docs)
      if (cats.length > 0 && !novaCategoriaId) {
        setNovaCategoriaId(cats[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar documentos:', err)
      toast({
        title: 'Erro ao carregar documentos',
        description: 'Não foi possível carregar a lista de documentos do tenant.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  // Formatar data em pt-BR
  const formatarData = (dateStr?: string) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  // Formatar versão para exibição
  const formatarVersao = (versaoStr?: string) => {
    const raw = (versaoStr || '1.0').trim()
    if (/^\d+$/.test(raw)) {
      return raw.padStart(2, '0')
    }
    return raw
  }

  // Incrementar versão automaticamente (ex: "1.0" -> "2.0", "02" -> "03", "2.1" -> "2.2")
  const sugerirProximaVersao = (v?: string) => {
    const raw = (v || '1.0').trim()
    if (/^\d+$/.test(raw)) {
      const num = parseInt(raw, 10) + 1
      return String(num).padStart(raw.length > 1 ? raw.length : 2, '0')
    }
    const parts = raw.split('.')
    if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      return `${parts[0]}.${parseInt(parts[1], 10) + 1}`
    }
    const numFloat = parseFloat(raw)
    if (!isNaN(numFloat)) {
      return (numFloat + 1.0).toFixed(1)
    }
    return `${raw}.1`
  }

  // Abrir modal de edição para um documento
  const handleAbrirEdicao = (doc: Documento) => {
    setDocParaEditar(doc)
    setEditNome(doc.nome)
    setEditCategoriaId(doc.categoria_id)
    setEditVersao(doc.versao || '1.0')
    setEditObrigatorio(Boolean(doc.obrigatorio))
    setEditFile(null)
    setEditFileError(null)
    if (editFileInputRef.current) editFileInputRef.current.value = ''
  }

  // Abrir modal de histórico de ciências
  const handleAbrirCiencias = async (doc: Documento) => {
    setDocParaVerCiencias(doc)
    try {
      setLoadingCiencias(true)
      const list = await cienciaDocumentoService.getCienciasPorDocumento(doc.id)
      setCienciasDoc(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCiencias(false)
    }
  }

  // Manipular arquivo de nova versão
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setEditFileError(null)
    if (!file) {
      setEditFile(null)
      return
    }

    const tiposPermitidos = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!tiposPermitidos.includes(file.type)) {
      setEditFileError('Formato inválido. Apenas arquivos PDF, PNG ou JPEG são aceitos.')
      setEditFile(null)
      if (editFileInputRef.current) editFileInputRef.current.value = ''
      return
    }

    const maxBytes = 10 * 1024 * 1024 // 10MB
    if (file.size > maxBytes) {
      setEditFileError('Arquivo muito grande. O limite máximo permitido é de 10 MB.')
      setEditFile(null)
      if (editFileInputRef.current) editFileInputRef.current.value = ''
      return
    }

    setEditFile(file)
  }

  // Salvar Edição / Nova Versão
  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docParaEditar || !tenantId) return

    if (!editNome.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe o título do documento.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSavingEdit(true)
      const versaoMudou = (docParaEditar.versao || '').trim() !== editVersao.trim()
      const formData = new FormData()
      formData.append('nome', editNome.trim())
      formData.append('categoria_id', editCategoriaId)
      formData.append('versao', editVersao.trim() || '1.0')
      formData.append('obrigatorio', String(editObrigatorio))

      // Se mudou a versão ou subiu novo arquivo, atualiza data_publicacao
      if (versaoMudou || editFile) {
        formData.append('data_publicacao', new Date().toISOString())
      }

      if (editFile) {
        formData.append('arquivo', editFile)
      }

      await documentoService.updateDocumento(docParaEditar.id, formData)

      // Registrar auditoria
      if (user?.id) {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: versaoMudou ? 'atualizacao_versao_documento' : 'edicao_documento',
          entidade: 'documento',
          entidade_id: docParaEditar.id,
          dados_json: {
            nome: editNome.trim(),
            versao_antiga: docParaEditar.versao,
            versao_nova: editVersao.trim(),
            houve_novo_arquivo: Boolean(editFile),
            obrigatorio: editObrigatorio,
          },
        })
      }

      toast({
        title: versaoMudou ? 'Nova versão publicada!' : 'Documento atualizado com sucesso!',
        description: versaoMudou
          ? `A Versão ${editVersao.trim()} foi salva. As ciências anteriores foram invalidadas e todos os colaboradores deverão dar ciência novamente.`
          : `As alterações em "${editNome.trim()}" foram salvas.`,
      })

      setDocParaEditar(null)
      setEditFile(null)
      await carregarDados()
    } catch (err) {
      console.error('Erro ao atualizar documento:', err)
      toast({
        title: 'Erro na atualização',
        description: 'Não foi possível salvar as alterações do documento.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Filtragem dos documentos
  const documentosFiltrados = useMemo(() => {
    return documentos.filter((doc) => {
      // Categoria
      const matchCat = selectedCategoriaId === 'todos' || doc.categoria_id === selectedCategoriaId

      // Obrigatório
      const matchObrigatorio =
        filtroObrigatorio === 'todos' ||
        (filtroObrigatorio === 'sim' && doc.obrigatorio) ||
        (filtroObrigatorio === 'nao' && !doc.obrigatorio)

      // Busca por nome, categoria ou autor
      const term = searchTerm.toLowerCase().trim()
      const matchSearch =
        term === '' ||
        doc.nome.toLowerCase().includes(term) ||
        doc.expand?.categoria_id?.nome?.toLowerCase().includes(term) ||
        doc.expand?.colaborador_id?.nome?.toLowerCase().includes(term)

      return matchCat && matchObrigatorio && matchSearch
    })
  }, [documentos, selectedCategoriaId, filtroObrigatorio, searchTerm])

  // Métricas rápidas
  const metricas = useMemo(() => {
    const total = documentos.length
    const obrigatorios = documentos.filter((d) => d.obrigatorio).length
    const pessoais = documentos.filter((d) => Boolean(d.colaborador_id)).length
    const corporativos = total - pessoais
    return { total, obrigatorios, pessoais, corporativos }
  }, [documentos])

  // Validação de arquivo no formulário de upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFileError(null)

    if (!file) {
      setSelectedFile(null)
      return
    }

    const tiposPermitidos = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!tiposPermitidos.includes(file.type)) {
      setFileError('Formato inválido. Apenas arquivos PDF, PNG ou JPEG são aceitos.')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const maxBytes = 10 * 1024 * 1024 // 10MB
    if (file.size > maxBytes) {
      setFileError('Arquivo muito grande. O limite máximo permitido é de 10 MB.')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setSelectedFile(file)
    if (!novoNome) {
      setNovoNome(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  // Upload realizado por RH/Admin
  const handleCriarDocumento = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tenantId) return
    if (!novaCategoriaId) {
      toast({
        title: 'Selecione uma categoria',
        description: 'A categoria do documento é obrigatória.',
        variant: 'destructive',
      })
      return
    }

    if (!novoNome.trim()) {
      toast({
        title: 'Nome do documento',
        description: 'Informe o título do documento corporativo.',
        variant: 'destructive',
      })
      return
    }

    if (!selectedFile) {
      setFileError('Selecione um arquivo PDF, PNG ou JPEG.')
      return
    }

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('tenant_id', tenantId)
      formData.append('categoria_id', novaCategoriaId)
      formData.append('nome', novoNome.trim())
      formData.append('versao', novaVersao.trim() || '1.0')
      formData.append('obrigatorio', String(isObrigatorio))
      formData.append('data_publicacao', new Date().toISOString())
      formData.append('arquivo', selectedFile)

      const docCriado = await documentoService.createDocumento(formData)

      // Registrar no log de auditoria
      if (user?.id) {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: 'upload_documento',
          entidade: 'documento',
          entidade_id: docCriado.id,
          dados_json: {
            nome: docCriado.nome,
            categoria_id: docCriado.categoria_id,
            obrigatorio: docCriado.obrigatorio,
          },
        })
      }

      toast({
        title: 'Documento publicado com sucesso!',
        description: `"${docCriado.nome}" foi disponibilizado para o tenant.`,
      })

      // Limpar form
      setIsModalOpen(false)
      setNovoNome('')
      setNovaVersao('1.0')
      setIsObrigatorio(false)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      await carregarDados()
    } catch (err) {
      console.error('Erro ao cadastrar documento:', err)
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível salvar o documento. Verifique o limite de 10 MB.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Visualizar arquivo
  const handleVisualizar = (doc: Documento) => {
    const url = documentoService.getFileUrl(doc)
    if (!url) {
      toast({
        title: 'Arquivo de demonstração',
        description:
          'Este documento é um registro de demonstração do sistema (sem arquivo binário anexado). Faça um upload para testar o arquivo real!',
      })
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Download do arquivo
  const handleDownload = (doc: Documento) => {
    const url = documentoService.getFileUrl(doc)
    if (!url) {
      toast({
        title: 'Arquivo de demonstração',
        description:
          'Este documento é um registro de demonstração do sistema (sem arquivo binário anexado).',
      })
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = doc.arquivo || `${doc.nome}.pdf`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Confirmar exclusão de documento
  const handleConfirmDelete = async () => {
    if (!docParaExcluir || !tenantId) return
    try {
      setIsDeleting(true)
      await documentoService.deleteDocumento(docParaExcluir.id)

      if (user?.id) {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: 'exclusao_documento',
          entidade: 'documento',
          entidade_id: docParaExcluir.id,
          dados_json: {
            nome: docParaExcluir.nome,
          },
        })
      }

      toast({
        title: 'Documento excluído',
        description: `"${docParaExcluir.nome}" foi removido com sucesso.`,
      })

      setDocParaExcluir(null)
      await carregarDados()
    } catch (err) {
      console.error('Erro ao excluir documento:', err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o documento selecionado.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header com Ações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-2xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E8EEF7] px-3 py-1 text-xs font-semibold text-[#0D47A1]">
            <Building2 className="h-3.5 w-3.5 text-[#0D47A1]" />
            <span>Gestão de Pessoas • Módulo RH</span>
          </div>
          <h1 className="text-2xl font-bold text-[#212121] tracking-tight">
            Gestão de Documentos Corporativos
          </h1>
          <p className="text-sm text-[#757575] max-w-2xl">
            Centralize os manuais, acordos coletivos, políticas de remuneração e visualize todos os
            documentos funcionais e obrigatórios do tenant.
          </p>
        </div>

        <div>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white shadow-xs gap-2 h-10 px-4 font-semibold text-sm"
          >
            <Plus className="h-4 w-4" />
            Novo Documento
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-[#E0E0E0] bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#757575] uppercase tracking-wider">
                Total de Documentos
              </p>
              <p className="text-2xl font-bold text-[#212121] mt-1">{metricas.total}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-[#0D47A1] flex items-center justify-center font-bold">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#E0E0E0] bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Obrigatórios
              </p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{metricas.obrigatorios}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#E0E0E0] bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#757575] uppercase tracking-wider">
                Corporativos
              </p>
              <p className="text-2xl font-bold text-[#212121] mt-1">{metricas.corporativos}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-[#3949AB] flex items-center justify-center font-bold">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#E0E0E0] bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#757575] uppercase tracking-wider">
                Pessoais (Colaboradores)
              </p>
              <p className="text-2xl font-bold text-[#212121] mt-1">{metricas.pessoais}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-[#2E7D32] flex items-center justify-center font-bold">
              <Shield className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E0E0E0]">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Busca por texto */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#757575]" />
            <Input
              placeholder="Buscar por documento, colaborador ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs border-[#E0E0E0] bg-[#F5F5F5]/60 focus:bg-white"
            />
          </div>

          {/* Filtro por Categoria */}
          <div className="w-full sm:w-56">
            <Select value={selectedCategoriaId} onValueChange={setSelectedCategoriaId}>
              <SelectTrigger className="h-9 text-xs border-[#E0E0E0] bg-white">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="todos">Todas as Categorias</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Obrigatoriedade */}
          <div className="w-full sm:w-44">
            <Select value={filtroObrigatorio} onValueChange={setFiltroObrigatorio}>
              <SelectTrigger className="h-9 text-xs border-[#E0E0E0] bg-white">
                <SelectValue placeholder="Obrigatoriedade" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="sim">Apenas Obrigatórios</SelectItem>
                <SelectItem value="nao">Não Obrigatórios</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(searchTerm || selectedCategoriaId !== 'todos' || filtroObrigatorio !== 'todos') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('')
              setSelectedCategoriaId('todos')
              setFiltroObrigatorio('todos')
            }}
            className="text-xs text-[#0D47A1] hover:bg-[#E8EEF7] h-9"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela de Gestão de Documentos */}
      <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-[#E0E0E0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-[#0D47A1]" />
            <h2 className="text-sm font-bold text-[#212121]">Documentos Cadastrados</h2>
            <Badge
              variant="outline"
              className="text-xs bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/20 font-semibold"
            >
              {documentosFiltrados.length}
            </Badge>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-slate-100" />
            ))}
          </div>
        ) : documentosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F5F5] text-[#757575] mb-3">
              <File className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-[#212121]">Nenhum documento encontrado</p>
            <p className="text-xs text-[#757575] mt-1 max-w-sm mx-auto">
              Tente alterar os termos da busca ou os filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA] text-[11px] font-bold text-[#757575] uppercase tracking-wider">
                  <th className="py-3 px-4">Nome do Documento</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Tipo / Obrigatório</th>
                  <th className="py-3 px-4">Autor / Colaborador</th>
                  <th className="py-3 px-4">Publicação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0] text-xs">
                {documentosFiltrados.map((doc) => {
                  const catNome = doc.expand?.categoria_id?.nome || 'Geral'
                  const colaboradorNome = doc.expand?.colaborador_id?.nome
                  const isPessoal = Boolean(doc.colaborador_id)

                  return (
                    <tr key={doc.id} className="hover:bg-[#F9FAFB] transition-colors group">
                      {/* Nome e versão */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold text-[#212121] leading-tight group-hover:text-[#0D47A1] transition-colors">
                              {doc.nome}
                            </p>
                            <p className="text-[11px] text-[#757575] mt-0.5">
                              {doc.versao ? `Versão ${doc.versao}` : 'Versão 1.0'}
                              {doc.arquivo
                                ? ` • ${doc.arquivo.split('.').pop()?.toUpperCase()}`
                                : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F5F5F5] text-[#424242]">
                          {catNome}
                        </span>
                      </td>

                      {/* Obrigatório */}
                      <td className="py-3.5 px-4">
                        {doc.obrigatorio ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold px-2 py-0 gap-1">
                            <AlertCircle className="h-3 w-3 text-amber-700" />
                            Obrigatório
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-[#757575]">Opcional</span>
                        )}
                      </td>

                      {/* Autor / Colaborador */}
                      <td className="py-3.5 px-4">
                        {isPessoal ? (
                          <div>
                            <span className="font-semibold text-[#0D47A1]">
                              {colaboradorNome || 'Colaborador'}
                            </span>
                            <span className="block text-[10px] text-[#757575]">
                              Envio individual
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium text-[#212121]">RH / Corporativo</span>
                            <span className="block text-[10px] text-[#757575]">Todo o tenant</span>
                          </div>
                        )}
                      </td>

                      {/* Data */}
                      <td className="py-3.5 px-4 text-[#757575]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatarData(doc.data_publicacao || doc.created)}</span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Visualizar documento"
                            onClick={() => handleVisualizar(doc)}
                            className="h-8 w-8 text-[#757575] hover:text-[#0D47A1] hover:bg-[#E8EEF7]"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar / Nova Versão"
                            onClick={() => handleAbrirEdicao(doc)}
                            className="h-8 w-8 text-[#757575] hover:text-[#0D47A1] hover:bg-[#E8EEF7]"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {doc.obrigatorio && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Histórico de Ciências"
                              onClick={() => handleAbrirCiencias(doc)}
                              className="h-8 w-8 text-[#757575] hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Baixar documento"
                            onClick={() => handleDownload(doc)}
                            className="h-8 w-8 text-[#757575] hover:text-[#0D47A1] hover:bg-[#E8EEF7]"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir documento"
                            onClick={() => setDocParaExcluir(doc)}
                            className="h-8 w-8 text-[#757575] hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </div>

      {/* Modal / Dialog de Novo Documento (RH/Admin) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg bg-white border border-[#E0E0E0] p-6">
          <DialogHeader className="text-left space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center font-bold">
                <Upload className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-[#212121]">
                Publicar Novo Documento
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#757575]">
              Disponibilize manuais, políticas, acordos ou normas para a organização. Formatos:
              <strong> PDF, PNG ou JPEG</strong> (até <strong>10 MB</strong>).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarDocumento} className="space-y-4 pt-2">
            {/* Categoria */}
            <div className="space-y-1.5">
              <Label htmlFor="cat" className="text-xs font-semibold text-[#212121]">
                Categoria do Documento <span className="text-red-500">*</span>
              </Label>
              <Select value={novaCategoriaId} onValueChange={setNovaCategoriaId}>
                <SelectTrigger id="cat" className="text-xs h-9 bg-white border-[#E0E0E0]">
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nome do Documento */}
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-xs font-semibold text-[#212121]">
                Título do Documento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nome"
                placeholder="Ex: Manual de Conduta e Ética 2025"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="text-xs h-9 border-[#E0E0E0]"
                required
              />
            </div>

            {/* Versão */}
            <div className="space-y-1.5">
              <Label htmlFor="versao" className="text-xs font-semibold text-[#212121]">
                Versão do Documento
              </Label>
              <Input
                id="versao"
                placeholder="Ex: 1.0 ou 2.1"
                value={novaVersao}
                onChange={(e) => setNovaVersao(e.target.value)}
                className="text-xs h-9 border-[#E0E0E0]"
              />
            </div>

            {/* Marcador Obrigatório */}
            <div className="flex items-start space-x-2 pt-1 pb-1">
              <Checkbox
                id="obrigatorio"
                checked={isObrigatorio}
                onCheckedChange={(checked) => setIsObrigatorio(Boolean(checked))}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <label
                  htmlFor="obrigatorio"
                  className="text-xs font-bold text-[#212121] cursor-pointer flex items-center gap-1.5"
                >
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  Documento Obrigatório (exige ciência dos colaboradores)
                </label>
                <p className="text-[11px] text-[#757575]">
                  Marque se o documento for indispensável para conformidade legal ou normas
                  internas.
                </p>
              </div>
            </div>

            {/* Upload do Arquivo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#212121]">
                Arquivo <span className="text-red-500">*</span>
              </Label>

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                  fileError
                    ? 'border-red-300 bg-red-50/50'
                    : selectedFile
                      ? 'border-[#0D47A1] bg-[#E8EEF7]/30'
                      : 'border-[#E0E0E0] hover:border-[#0D47A1] bg-[#FAFAFA]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {selectedFile ? (
                  <div className="flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="h-9 w-9 rounded bg-[#0D47A1] text-white flex items-center justify-center shrink-0">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-[#212121] truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-[#757575]">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB •{' '}
                          {selectedFile.type || 'Arquivo'}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="h-8 w-8 text-[#757575] hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1 text-center">
                    <Upload className="h-6 w-6 text-[#757575] mx-auto mb-1" />
                    <p className="text-xs font-semibold text-[#212121]">
                      Clique para escolher o arquivo
                    </p>
                    <p className="text-[11px] text-[#757575]">
                      Formatos aceitos: PDF, PNG ou JPEG (máximo 10 MB)
                    </p>
                  </div>
                )}
              </div>

              {fileError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isUploading}
                className="text-xs h-9 border-[#E0E0E0]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="text-xs h-9 bg-[#0D47A1] hover:bg-[#0A3A82] text-white font-semibold"
              >
                {isUploading ? 'Publicando...' : 'Publicar Documento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição / Nova Versão (RH/Admin) */}
      <Dialog
        open={Boolean(docParaEditar)}
        onOpenChange={(open) => !open && setDocParaEditar(null)}
      >
        <DialogContent className="max-w-lg bg-white border border-[#E0E0E0] p-6">
          <DialogHeader className="text-left space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center font-bold">
                <Edit className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-[#212121]">
                Editar Documento / Nova Versão
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#757575]">
              Atualize as informações do documento corporativo. Se alterar a versão ou subir um novo
              arquivo de documento obrigatório,{' '}
              <strong className="text-[#0D47A1]">
                as ciências anteriores serão invalidadas e todos os colaboradores deverão dar nova
                ciência
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarEdicao} className="space-y-4 pt-2">
            {/* Categoria */}
            <div className="space-y-1.5">
              <Label htmlFor="editCat" className="text-xs font-semibold text-[#212121]">
                Categoria do Documento <span className="text-red-500">*</span>
              </Label>
              <Select value={editCategoriaId} onValueChange={setEditCategoriaId}>
                <SelectTrigger id="editCat" className="text-xs h-9 bg-white border-[#E0E0E0]">
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nome do Documento */}
            <div className="space-y-1.5">
              <Label htmlFor="editNome" className="text-xs font-semibold text-[#212121]">
                Título do Documento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="editNome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="text-xs h-9 border-[#E0E0E0]"
                required
              />
            </div>

            {/* Versão atual vs Nova Versão */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="editVersao" className="text-xs font-semibold text-[#212121]">
                  Versão do Documento
                </Label>
                <button
                  type="button"
                  onClick={() => setEditVersao(sugerirProximaVersao(editVersao))}
                  className="text-[11px] text-[#0D47A1] font-semibold hover:underline"
                >
                  + Incrementar versão ({sugerirProximaVersao(editVersao)})
                </button>
              </div>
              <Input
                id="editVersao"
                placeholder="Ex: 2.0 ou 03"
                value={editVersao}
                onChange={(e) => setEditVersao(e.target.value)}
                className="text-xs h-9 border-[#E0E0E0]"
              />
              {docParaEditar && docParaEditar.versao !== editVersao && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  ⚠️ Alterando versão de <strong>{formatarVersao(docParaEditar.versao)}</strong>{' '}
                  para <strong>{formatarVersao(editVersao)}</strong>. Isso marcará o documento como
                  pendente para todos os colaboradores.
                </p>
              )}
            </div>

            {/* Marcador Obrigatório */}
            <div className="flex items-start space-x-2 pt-1 pb-1">
              <Checkbox
                id="editObrigatorio"
                checked={editObrigatorio}
                onCheckedChange={(checked) => setEditObrigatorio(Boolean(checked))}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <label
                  htmlFor="editObrigatorio"
                  className="text-xs font-bold text-[#212121] cursor-pointer flex items-center gap-1.5"
                >
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  Documento Obrigatório (exige ciência dos colaboradores)
                </label>
                <p className="text-[11px] text-[#757575]">
                  Aparece em "Documentos Importantes" com monitoramento de conformidade.
                </p>
              </div>
            </div>

            {/* Substituição opcional do Arquivo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#212121]">
                Atualizar Arquivo (Opcional - deixe vazio para manter o arquivo atual)
              </Label>

              <div
                onClick={() => editFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                  editFileError
                    ? 'border-red-300 bg-red-50/50'
                    : editFile
                      ? 'border-[#0D47A1] bg-[#E8EEF7]/30'
                      : 'border-[#E0E0E0] hover:border-[#0D47A1] bg-[#FAFAFA]'
                }`}
              >
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleEditFileChange}
                />

                {editFile ? (
                  <div className="flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="h-8 w-8 rounded bg-[#0D47A1] text-white flex items-center justify-center shrink-0">
                        <FileCheck className="h-4 w-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-[#212121] truncate">{editFile.name}</p>
                        <p className="text-[10px] text-[#757575]">
                          {(editFile.size / (1024 * 1024)).toFixed(2)} MB (Substituirá o arquivo
                          anterior)
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditFile(null)
                        if (editFileInputRef.current) editFileInputRef.current.value = ''
                      }}
                      className="h-7 w-7 text-[#757575] hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1 text-center">
                    <Upload className="h-5 w-5 text-[#757575] mx-auto mb-1" />
                    <p className="text-xs font-semibold text-[#212121]">
                      Clique para selecionar um novo arquivo PDF, PNG ou JPEG
                    </p>
                    <p className="text-[10px] text-[#757575]">
                      {docParaEditar?.arquivo
                        ? `Arquivo atual: ${docParaEditar.arquivo}`
                        : 'Nenhum arquivo binário anexado atualmente.'}
                    </p>
                  </div>
                )}
              </div>

              {editFileError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{editFileError}</span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDocParaEditar(null)}
                disabled={isSavingEdit}
                className="text-xs h-9 border-[#E0E0E0]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSavingEdit}
                className="text-xs h-9 bg-[#0D47A1] hover:bg-[#0A3A82] text-white font-semibold"
              >
                {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Histórico de Ciências de um Documento */}
      <Dialog
        open={Boolean(docParaVerCiencias)}
        onOpenChange={(open) => !open && setDocParaVerCiencias(null)}
      >
        <DialogContent className="max-w-2xl bg-white border border-[#E0E0E0] p-6">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-[#2E7D32] flex items-center justify-center font-bold">
                <History className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-[#212121]">
                Registro de Ciências: {docParaVerCiencias?.nome}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#757575]">
              Histórico de confirmações de leitura com data/hora e IP de origem. Versão atual:{' '}
              <strong className="text-[#0D47A1]">
                Versão {formatarVersao(docParaVerCiencias?.versao)}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {loadingCiencias ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full bg-slate-100" />
                ))}
              </div>
            ) : cienciasDoc.length === 0 ? (
              <div className="p-8 text-center bg-[#FAFAFA] rounded-xl border border-dashed border-[#E0E0E0]">
                <Clock className="h-8 w-8 text-[#757575] mx-auto mb-2" />
                <p className="text-xs font-bold text-[#212121]">Nenhuma ciência registrada ainda</p>
                <p className="text-[11px] text-[#757575] mt-0.5">
                  Nenhum colaborador confirmou leitura deste documento até o momento.
                </p>
              </div>
            ) : (
              <div className="border border-[#E0E0E0] rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#FAFAFA] border-b border-[#E0E0E0] text-[11px] font-bold text-[#757575] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Colaborador</th>
                      <th className="py-2.5 px-3">Versão Ciente</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Data/Hora</th>
                      <th className="py-2.5 px-3">IP Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {cienciasDoc.map((c) => {
                      const isVersaoAtual =
                        (c.versao_ciente || '').trim() ===
                        (docParaVerCiencias?.versao || '1.0').trim()
                      const colabNome = c.expand?.colaborador_id?.nome || 'Colaborador'

                      return (
                        <tr key={c.id} className="hover:bg-[#F9FAFB]">
                          <td className="py-2.5 px-3 font-semibold text-[#212121]">{colabNome}</td>
                          <td className="py-2.5 px-3 font-mono">
                            v{formatarVersao(c.versao_ciente)}
                          </td>
                          <td className="py-2.5 px-3">
                            {isVersaoAtual ? (
                              <Badge className="bg-emerald-100 text-[#2E7D32] border-emerald-300 text-[10px] px-1.5 py-0">
                                Vigente
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0"
                              >
                                Obsoleta
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[#757575]">
                            {new Date(c.data_hora).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#616161]">
                            {c.ip_origem || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDocParaVerCiencias(null)}
              className="text-xs border-[#E0E0E0]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alerta de Confirmação de Exclusão */}
      <AlertDialog
        open={Boolean(docParaExcluir)}
        onOpenChange={(open) => !open && setDocParaExcluir(null)}
      >
        <AlertDialogContent className="bg-white border border-[#E0E0E0]">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle className="text-base font-bold text-[#212121]">
                Excluir Documento
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-[#757575]">
              Tem certeza que deseja excluir o documento{' '}
              <strong className="text-[#212121]">"{docParaExcluir?.nome}"</strong>? Esta ação é
              irreversível e removerá o arquivo para todos os colaboradores do tenant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isDeleting} className="text-xs h-9 border-[#E0E0E0]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="text-xs h-9 bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
