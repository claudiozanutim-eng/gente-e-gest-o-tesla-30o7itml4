import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  FileText,
  Upload,
  Download,
  Eye,
  FileCheck,
  ShieldCheck,
  Briefcase,
  DollarSign,
  HeartPulse,
  FolderOpen,
  Calendar,
  AlertCircle,
  File,
  CheckCircle2,
  X,
  Search,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { documentoService } from '@/services/api'
import { CategoriaDocumento, Documento } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

// Mapeamento visual das 4 categorias principais
export const CATEGORIA_CONFIG: Record<
  string,
  {
    icon: React.ElementType
    color: string
    bgColor: string
    borderColor: string
    descricao: string
  }
> = {
  'Documentos Pessoais': {
    icon: FileText,
    color: '#0D47A1',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    descricao: 'RG, CPF, CNH, comprovante de residência e certidões',
  },
  'Documentos Trabalhistas': {
    icon: Briefcase,
    color: '#1E88E5',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    descricao: 'Contratos de trabalho, termos aditivos e acordos coletivos',
  },
  Remuneração: {
    icon: DollarSign,
    color: '#2E7D32',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    descricao: 'Holerites, informes de rendimentos e políticas salariais',
  },
  'Saúde e Segurança': {
    icon: HeartPulse,
    color: '#D84315',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    descricao: 'Exames periódicos, ASO, laudos e normas de segurança (NR)',
  },
}

export default function DocumentosPage() {
  const { user, colaborador } = useAuth()
  const { toast } = useToast()

  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategoriaId, setActiveCategoriaId] = useState<string>('todos')
  const [searchTerm, setSearchTerm] = useState('')

  // Estado do Modal de Upload de Documento Pessoal
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadNome, setUploadNome] = useState('')
  const [tipoDocPessoal, setTipoDocPessoal] = useState('RG / Documento de Identidade')
  const [tipoCustom, setTipoCustom] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const tenantId = user?.tenant_id
  const colaboradorId = colaborador?.id

  // Carregar categorias e documentos do tenant
  const carregarDados = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const [cats, docs] = await Promise.all([
        documentoService.getCategorias(tenantId),
        documentoService.getDocumentosColaborador(tenantId, colaboradorId),
      ])
      setCategorias(cats)
      setDocumentos(docs)
    } catch (err) {
      console.error('Erro ao carregar documentos:', err)
      toast({
        title: 'Erro ao carregar documentos',
        description: 'Não foi possível buscar a lista de documentos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, colaboradorId])

  // Categoria de "Documentos Pessoais" para upload do colaborador
  const categoriaPessoal = useMemo(() => {
    return categorias.find(
      (c) => c.nome.toLowerCase().includes('pessoal') || c.nome === 'Documentos Pessoais',
    )
  }, [categorias])

  // Formatação de data em pt-BR
  const formatarData = (dateStr?: string) => {
    if (!dateStr) return 'Não informada'
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

  // Filtragem dos documentos
  const documentosFiltrados = useMemo(() => {
    return documentos.filter((doc) => {
      const matchCategoria = activeCategoriaId === 'todos' || doc.categoria_id === activeCategoriaId

      const matchSearch =
        searchTerm.trim() === '' ||
        doc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.expand?.categoria_id?.nome?.toLowerCase().includes(searchTerm.toLowerCase())

      return matchCategoria && matchSearch
    })
  }, [documentos, activeCategoriaId, searchTerm])

  // Contagem por categoria
  const contagemPorCategoria = useMemo(() => {
    const map: Record<string, number> = { todos: documentos.length }
    categorias.forEach((c) => {
      map[c.id] = documentos.filter((d) => d.categoria_id === c.id).length
    })
    return map
  }, [categorias, documentos])

  // Validação de arquivo (PDF, PNG, JPEG, max 10MB)
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
    // Se o usuário ainda não editou o título, sugere com base no tipo
    if (!uploadNome || uploadNome === tipoDocPessoal) {
      setUploadNome(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  // Submissão do upload pessoal
  const handleUploadPessoal = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tenantId) {
      toast({
        title: 'Tenant não identificado',
        description: 'Faça login novamente para enviar documentos.',
        variant: 'destructive',
      })
      return
    }

    if (!categoriaPessoal) {
      toast({
        title: 'Categoria indisponível',
        description: 'Categoria "Documentos Pessoais" não encontrada no sistema.',
        variant: 'destructive',
      })
      return
    }

    if (!selectedFile) {
      setFileError('Selecione um arquivo para continuar.')
      return
    }

    const nomeFinal =
      uploadNome.trim() ||
      (tipoDocPessoal === 'Outro documento' && tipoCustom ? tipoCustom : tipoDocPessoal)

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('tenant_id', tenantId)
      formData.append('categoria_id', categoriaPessoal.id)
      if (colaboradorId) {
        formData.append('colaborador_id', colaboradorId)
      }
      formData.append('nome', nomeFinal)
      formData.append('versao', '1.0')
      formData.append('obrigatorio', 'false')
      formData.append('data_publicacao', new Date().toISOString())
      formData.append('arquivo', selectedFile)

      await documentoService.createDocumento(formData)

      toast({
        title: 'Documento enviado com sucesso!',
        description: `"${nomeFinal}" foi anexado aos seus Documentos Pessoais.`,
      })

      setIsUploadOpen(false)
      setSelectedFile(null)
      setUploadNome('')
      setTipoCustom('')
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Recarrega lista
      await carregarDados()
    } catch (err) {
      console.error('Erro ao enviar documento:', err)
      toast({
        title: 'Falha no envio do documento',
        description: 'Verifique se o arquivo respeita o tamanho máximo de 10MB.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Ação de Visualizar (abre arquivo em nova aba)
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

  // Ação de Download
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
    // Cria um link temporário com download forçado
    const a = document.createElement('a')
    a.href = url
    a.download = doc.arquivo || `${doc.nome}.pdf`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Verifica se a categoria atual selecionada é a de Documentos Pessoais
  const isViewingPessoal =
    activeCategoriaId === categoriaPessoal?.id || (activeCategoriaId === 'todos' && false)

  return (
    <div className="space-y-6 pb-12">
      {/* Header do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-2xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E8EEF7] px-3 py-1 text-xs font-semibold text-[#0D47A1]">
            <FolderOpen className="h-3.5 w-3.5 text-[#0D47A1]" />
            <span>Portal do Colaborador</span>
          </div>
          <h1 className="text-2xl font-bold text-[#212121] tracking-tight">Meus Documentos</h1>
          <p className="text-sm text-[#757575] max-w-2xl">
            Acesse seus holerites, informes de rendimentos, contratos de trabalho, normas
            corporativas e envie seus documentos pessoais de identificação.
          </p>
        </div>

        {/* Botão de Upload Rápido para Documentos Pessoais */}
        <div>
          <Button
            onClick={() => setIsUploadOpen(true)}
            className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white shadow-xs gap-2 h-10 px-4 font-semibold text-sm"
          >
            <Upload className="h-4 w-4" />
            Enviar Documento Pessoal
          </Button>
        </div>
      </div>

      {/* Cards de Resumo por Categoria (clicáveis para filtrar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categorias.map((cat) => {
          const config = CATEGORIA_CONFIG[cat.nome] || {
            icon: File,
            color: '#0D47A1',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
            descricao: 'Documentos do colaborador',
          }
          const Icon = config.icon
          const count = contagemPorCategoria[cat.id] || 0
          const isSelected = activeCategoriaId === cat.id

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategoriaId(activeCategoriaId === cat.id ? 'todos' : cat.id)}
              className={`flex flex-col text-left p-4 rounded-xl border bg-white transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer ${
                isSelected
                  ? 'ring-2 ring-[#0D47A1] border-[#0D47A1] bg-[#F7F9FC]'
                  : 'border-[#E0E0E0] hover:border-[#0D47A1]/40'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.bgColor}`}
                  style={{ color: config.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs font-bold ${
                    isSelected
                      ? 'bg-[#0D47A1] text-white border-[#0D47A1]'
                      : 'bg-[#F5F5F5] text-[#424242]'
                  }`}
                >
                  {count} {count === 1 ? 'doc' : 'docs'}
                </Badge>
              </div>

              <span className="font-bold text-sm text-[#212121] leading-tight line-clamp-1">
                {cat.nome}
              </span>
              <span className="text-[11px] text-[#757575] mt-1 line-clamp-2">
                {config.descricao}
              </span>

              {cat.nome === 'Documentos Pessoais' && (
                <div className="mt-3 pt-2 border-t border-[#F5F5F5] flex items-center gap-1 text-[11px] font-semibold text-[#0D47A1]">
                  <Upload className="h-3 w-3" />
                  <span>Upload disponível</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E0E0E0]">
        {/* Abas das Categorias */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Button
            variant={activeCategoriaId === 'todos' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveCategoriaId('todos')}
            className={`text-xs font-semibold h-8 rounded-lg ${
              activeCategoriaId === 'todos'
                ? 'bg-[#0D47A1] hover:bg-[#0A3A82] text-white'
                : 'text-[#616161] hover:text-[#212121] hover:bg-[#F5F5F5]'
            }`}
          >
            Todos ({documentos.length})
          </Button>

          {categorias.map((cat) => {
            const isSelected = activeCategoriaId === cat.id
            const count = contagemPorCategoria[cat.id] || 0
            return (
              <Button
                key={cat.id}
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveCategoriaId(cat.id)}
                className={`text-xs font-semibold h-8 rounded-lg shrink-0 ${
                  isSelected
                    ? 'bg-[#0D47A1] hover:bg-[#0A3A82] text-white'
                    : 'text-[#616161] hover:text-[#212121] hover:bg-[#F5F5F5]'
                }`}
              >
                {cat.nome} ({count})
              </Button>
            )
          })}
        </div>

        {/* Campo de Busca */}
        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#757575]" />
          <Input
            placeholder="Buscar documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs border-[#E0E0E0] bg-[#F5F5F5]/60 focus:bg-white"
          />
        </div>
      </div>

      {/* Banner Informativo quando categoria selecionada for Documentos Pessoais */}
      {isViewingPessoal && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 text-[#0D47A1]">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-[#0D47A1] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[#0D47A1]">
                Envio Seguro de Documentos Pessoais
              </p>
              <p className="text-xs text-[#1565C0] mt-0.5">
                Mantenha seu prontuário em dia enviando RG, CPF, CNH, certidões ou comprovante de
                endereço. Apenas você e o time de RH têm acesso a esses arquivos.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs h-8 font-semibold shrink-0"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Enviar Arquivo
          </Button>
        </div>
      )}

      {/* Lista / Grid de Documentos */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border border-[#E0E0E0] p-4 space-y-3">
              <Skeleton className="h-5 w-24 bg-slate-100" />
              <Skeleton className="h-6 w-3/4 bg-slate-100" />
              <Skeleton className="h-4 w-1/2 bg-slate-100" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 w-20 bg-slate-100" />
                <Skeleton className="h-8 w-20 bg-slate-100" />
              </div>
            </Card>
          ))}
        </div>
      ) : documentosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E0E0E0] bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F5F5] text-[#757575] mb-4">
            <FolderOpen className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-[#212121]">Nenhum documento encontrado</h3>
          <p className="text-xs text-[#757575] mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `Nenhum documento coincide com o termo de busca "${searchTerm}".`
              : 'Não há documentos disponíveis nesta categoria para o seu perfil no momento.'}
          </p>

          {isViewingPessoal && (
            <Button
              onClick={() => setIsUploadOpen(true)}
              className="mt-4 bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Enviar Primeiro Documento
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documentosFiltrados.map((doc) => {
            const catNome = doc.expand?.categoria_id?.nome || 'Geral'
            const catConfig = CATEGORIA_CONFIG[catNome] || {
              icon: FileText,
              color: '#0D47A1',
              bgColor: 'bg-blue-50',
              borderColor: 'border-blue-200',
            }
            const IconComponent = catConfig.icon
            const isPessoal = catNome.toLowerCase().includes('pessoal')

            return (
              <Card
                key={doc.id}
                className="group relative flex flex-col justify-between overflow-hidden border border-[#E0E0E0] bg-white shadow-2xs hover:shadow-md transition-all duration-200 hover:border-[#0D47A1]/40"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  {/* Topo do card: Categoria e Badge de Obrigatório */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold"
                      style={{
                        backgroundColor: `${catConfig.color}15`,
                        color: catConfig.color,
                      }}
                    >
                      <IconComponent className="h-3 w-3" />
                      {catNome}
                    </span>

                    {doc.obrigatorio ? (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold px-2 py-0 gap-1">
                        <AlertCircle className="h-3 w-3 text-amber-700" />
                        Obrigatório
                      </Badge>
                    ) : isPessoal ? (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-[#0D47A1] border-blue-200 text-[10px] font-semibold"
                      >
                        Pessoal
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-[#757575]">Corporativo</span>
                    )}
                  </div>

                  {/* Título e Metadados */}
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-[#212121] leading-snug group-hover:text-[#0D47A1] transition-colors line-clamp-2">
                      {doc.nome}
                    </h3>

                    <div className="flex items-center gap-3 text-[11px] text-[#757575]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatarData(doc.data_publicacao || doc.created)}
                      </span>
                      {doc.versao && (
                        <span className="font-medium bg-[#F5F5F5] px-1.5 py-0.2 rounded text-[10px]">
                          v{doc.versao}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações: Visualizar e Baixar */}
                  <div className="flex items-center gap-2 pt-3 border-t border-[#F5F5F5]">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVisualizar(doc)}
                      className="flex-1 text-xs font-semibold h-8 border-[#E0E0E0] hover:bg-[#E8EEF7] hover:text-[#0D47A1] gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Visualizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      className="flex-1 text-xs font-semibold h-8 border-[#E0E0E0] hover:bg-[#E8EEF7] hover:text-[#0D47A1] gap-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal / Dialog de Upload de Documentos Pessoais */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-lg bg-white border border-[#E0E0E0] p-6">
          <DialogHeader className="text-left space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center font-bold">
                <Upload className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-[#212121]">
                Enviar Documento Pessoal
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#757575]">
              Envie comprovantes e documentos pessoais para a sua pasta funcional digital. Formatos
              aceitos: <strong>PDF, PNG, JPEG</strong> (até <strong>10 MB</strong>).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadPessoal} className="space-y-4 pt-2">
            {/* Tipo de Documento */}
            <div className="space-y-1.5">
              <Label htmlFor="tipoDoc" className="text-xs font-semibold text-[#212121]">
                Tipo de Documento Pessoal <span className="text-red-500">*</span>
              </Label>
              <Select
                value={tipoDocPessoal}
                onValueChange={(val) => {
                  setTipoDocPessoal(val)
                  if (val !== 'Outro documento') {
                    setUploadNome(val)
                  }
                }}
              >
                <SelectTrigger id="tipoDoc" className="text-xs h-9 bg-white border-[#E0E0E0]">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="RG / Documento de Identidade">
                    RG / Carteira de Identidade
                  </SelectItem>
                  <SelectItem value="CPF - Cadastro de Pessoa Física">CPF</SelectItem>
                  <SelectItem value="CNH - Carteira Nacional de Habilitação">
                    CNH Digital
                  </SelectItem>
                  <SelectItem value="Comprovante de Endereço">Comprovante de Residência</SelectItem>
                  <SelectItem value="Certidão de Casamento / Nascimento">
                    Certidão de Casamento / Nascimento
                  </SelectItem>
                  <SelectItem value="Documento de Dependente (Filho/Cônjuge)">
                    Documento de Dependente
                  </SelectItem>
                  <SelectItem value="Carteira de Trabalho (CTPS Digital)">CTPS Digital</SelectItem>
                  <SelectItem value="Outro documento">Outro documento...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nome/Identificação do Documento */}
            <div className="space-y-1.5">
              <Label htmlFor="nomeDoc" className="text-xs font-semibold text-[#212121]">
                Nome / Descrição do Documento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nomeDoc"
                placeholder="Ex: RG Lucas Ferreira frente e verso"
                value={uploadNome}
                onChange={(e) => setUploadNome(e.target.value)}
                className="text-xs h-9 border-[#E0E0E0]"
                required
              />
            </div>

            {/* Seleção do Arquivo */}
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
                      Formatos permitidos: PDF, PNG ou JPEG (máximo 10 MB)
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
                onClick={() => setIsUploadOpen(false)}
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
                {isUploading ? 'Enviando...' : 'Confirmar Envio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
