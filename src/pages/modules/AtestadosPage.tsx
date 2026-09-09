import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileCheck,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  FileText,
  UploadCloud,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
  Loader2,
  X,
  FileQuestion,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { atestadoService } from '@/services/api'
import { Atestado, AtestadoStatus, ATESTADO_STATUS_MAP } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

export default function AtestadosPage() {
  const { user, colaborador } = useAuth()
  const { toast } = useToast()

  const [atestados, setAtestados] = useState<Atestado[]>([])
  const [loading, setLoading] = useState(true)

  // Estados do modal de envio
  const [modalOpen, setModalOpen] = useState(false)
  const [dataInicio, setDataInicio] = useState('')
  const [qtdDias, setQtdDias] = useState<number | ''>(1)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [arquivoErro, setArquivoErro] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Estado do modal de visualização de anexo
  const [previewAtestado, setPreviewAtestado] = useState<Atestado | null>(null)

  const tenantId = user?.tenant_id
  const colaboradorId = colaborador?.id

  // Carrega atestados
  const carregarAtestados = useCallback(async () => {
    if (!tenantId || !colaboradorId) return
    try {
      setLoading(true)
      const data = await atestadoService.getAtestadosColaborador(tenantId, colaboradorId)
      setAtestados(data)
    } catch (err) {
      console.error('Erro ao carregar atestados:', err)
      toast({
        title: 'Erro ao carregar atestados',
        description: 'Não foi possível carregar o histórico de atestados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, colaboradorId, toast])

  useEffect(() => {
    carregarAtestados()
  }, [carregarAtestados])

  // Realtime subscription na coleção 'atestado'
  useRealtime<Atestado>('atestado', (e) => {
    if (!colaboradorId) return

    // Se o evento pertencer ao colaborador logado
    if (e.record.colaborador_id === colaboradorId) {
      if (e.action === 'create') {
        setAtestados((prev) => {
          if (prev.some((item) => item.id === e.record.id)) return prev
          return [e.record, ...prev]
        })
      } else if (e.action === 'update') {
        setAtestados((prev) =>
          prev.map((item) => (item.id === e.record.id ? { ...item, ...e.record } : item)),
        )
        // Se o modal de visualização estiver aberto para este atestado, atualiza-o
        setPreviewAtestado((prev) => (prev?.id === e.record.id ? { ...prev, ...e.record } : prev))

        toast({
          title: 'Status de atestado atualizado',
          description: `Seu atestado agora está "${ATESTADO_STATUS_MAP[e.record.status]?.label || e.record.status}".`,
        })
      } else if (e.action === 'delete') {
        setAtestados((prev) => prev.filter((item) => item.id !== e.record.id))
      }
    }
  })

  // Validação do arquivo: PDF, PNG, JPEG, máx 10 MB
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setArquivoErro(null)

    if (!file) {
      setArquivo(null)
      return
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      setArquivo(null)
      setArquivoErro('Formato inválido. Apenas documentos em PDF, PNG ou JPEG são permitidos.')
      return
    }

    const maxSizeBytes = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSizeBytes) {
      setArquivo(null)
      setArquivoErro('Arquivo muito grande. O tamanho máximo permitido é de 10 MB.')
      return
    }

    setArquivo(file)
  }

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tenantId || !colaboradorId) {
      toast({
        title: 'Perfil não identificado',
        description: 'Vínculo do colaborador não encontrado. Entre em contato com o suporte.',
        variant: 'destructive',
      })
      return
    }

    if (!dataInicio) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe a data de início do atestado.',
        variant: 'destructive',
      })
      return
    }

    const diasNum = Number(qtdDias)
    if (!qtdDias || isNaN(diasNum) || diasNum < 1) {
      toast({
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade válida de dias (mínimo 1 dia).',
        variant: 'destructive',
      })
      return
    }

    if (!arquivo) {
      setArquivoErro('Selecione o arquivo do atestado (PDF, PNG ou JPEG até 10 MB).')
      toast({
        title: 'Arquivo obrigatório',
        description: 'O anexo comprobatório é obrigatório para envio do atestado.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)

      const formData = new FormData()
      formData.append('tenant_id', tenantId)
      formData.append('colaborador_id', colaboradorId)
      formData.append('data_inicio', new Date(dataInicio + 'T00:00:00Z').toISOString())
      formData.append('qtd_dias', diasNum.toString())
      formData.append('status', 'recebido')
      formData.append('data_envio', new Date().toISOString())
      formData.append('anexo', arquivo)

      const novo = await atestadoService.enviarAtestado(formData)

      // Atualiza lista local caso o realtime leve alguns ms
      setAtestados((prev) => {
        if (prev.some((item) => item.id === novo.id)) return prev
        return [novo, ...prev]
      })

      toast({
        title: 'Atestado enviado com sucesso',
        description: 'Seu documento foi recebido pelo RH e logo passará por triagem.',
      })

      // Limpar formulário e fechar modal
      setDataInicio('')
      setQtdDias(1)
      setArquivo(null)
      setArquivoErro(null)
      setModalOpen(false)
    } catch (err: unknown) {
      console.error('Erro ao enviar atestado:', err)
      const message =
        err instanceof Error ? err.message : 'Falha ao processar o envio. Verifique os dados.'
      toast({
        title: 'Erro ao enviar atestado',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Formatação de período (data início + dias)
  const formatarPeriodo = (dataInicioStr: string, qtd: number) => {
    try {
      const inicio = new Date(dataInicioStr)
      const dataInicioFormatada = inicio.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      })

      const fim = new Date(inicio)
      // Período de N dias: ex: dia 02 com 2 dias cobre dia 02 e 03
      fim.setUTCDate(fim.getUTCDate() + (qtd - 1))
      const dataFimFormatada = fim.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      })

      const diasLabel = qtd === 1 ? '1 dia' : `${qtd} dias`
      if (qtd === 1) {
        return `${dataInicioFormatada} (${diasLabel})`
      }
      return `${dataInicioFormatada} até ${dataFimFormatada} (${diasLabel})`
    } catch {
      return `${dataInicioStr} (${qtd} dias)`
    }
  }

  const formatarDataEnvio = (dataEnvioStr?: string, createdStr?: string) => {
    const raw = dataEnvioStr || createdStr
    if (!raw) return 'Data não registrada'
    try {
      const d = new Date(raw)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return raw
    }
  }

  // Contadores para resumo
  const resumo = useMemo(() => {
    return {
      total: atestados.length,
      recebido: atestados.filter((a) => a.status === 'recebido').length,
      em_analise: atestados.filter((a) => a.status === 'em_analise').length,
      validado: atestados.filter((a) => a.status === 'validado').length,
      necessita_correcao: atestados.filter((a) => a.status === 'necessita_correcao').length,
    }
  }, [atestados])

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1]">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Atestados e Licenças Médicas
              </h1>
              <p className="text-xs text-[#757575] mt-0.5">
                Envie seus atestados médicos para homologação do RH e acompanhe o status em tempo
                real.
              </p>
            </div>
          </div>
        </div>

        {/* Botão Enviar Atestado */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white shadow-sm font-semibold h-10 px-5 gap-2 text-sm">
              <Plus className="h-4 w-4" />
              Enviar Atestado
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white border border-[#E0E0E0] p-6">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center gap-2 text-[#0D47A1]">
                <UploadCloud className="h-5 w-5" />
                <DialogTitle className="text-lg font-bold text-[#212121]">
                  Enviar Novo Atestado
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-[#757575]">
                Preencha as informações do atestado médico ou declaração e anexe o comprovante.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              {/* Data de início */}
              <div className="space-y-1.5">
                <Label htmlFor="data_inicio" className="text-xs font-semibold text-[#212121]">
                  Data de Início do Afastamento <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="data_inicio"
                    type="date"
                    required
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="border-[#E0E0E0] text-sm h-10 focus:border-[#0D47A1]"
                  />
                </div>
                <p className="text-[11px] text-[#757575]">
                  Data indicada no cabeçalho ou texto do atestado.
                </p>
              </div>

              {/* Quantidade de dias */}
              <div className="space-y-1.5">
                <Label htmlFor="qtd_dias" className="text-xs font-semibold text-[#212121]">
                  Quantidade de Dias de Afastamento <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="qtd_dias"
                  type="number"
                  min="1"
                  max="120"
                  required
                  value={qtdDias}
                  onChange={(e) =>
                    setQtdDias(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  placeholder="Ex: 1, 3, 5..."
                  className="border-[#E0E0E0] text-sm h-10 focus:border-[#0D47A1]"
                />
                <p className="text-[11px] text-[#757575]">
                  Número de dias prescrito pelo profissional de saúde.
                </p>
              </div>

              {/* Upload do Arquivo */}
              <div className="space-y-1.5">
                <Label htmlFor="arquivo" className="text-xs font-semibold text-[#212121]">
                  Comprovante / Anexo (PDF, PNG ou JPEG) <span className="text-red-500">*</span>
                </Label>
                <div className="border-2 border-dashed border-[#D0D7DE] rounded-lg p-4 text-center hover:bg-[#FAFAFA] transition-colors relative">
                  <input
                    id="arquivo"
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                    <UploadCloud className="h-7 w-7 text-[#0D47A1]" />
                    {arquivo ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-[#0D47A1]">{arquivo.name}</p>
                        <p className="text-[11px] text-[#757575]">
                          {(arquivo.size / (1024 * 1024)).toFixed(2)} MB • Clique para trocar
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-[#212121]">
                          Clique para selecionar ou arraste o arquivo
                        </p>
                        <p className="text-[11px] text-[#757575]">
                          Formatos permitidos: PDF, PNG ou JPEG (máximo 10 MB)
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {arquivoErro && (
                  <p className="text-xs text-red-600 flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {arquivoErro}
                  </p>
                )}
              </div>

              {/* Dica informativa */}
              <div className="bg-[#E8EEF7] border border-[#0D47A1]/20 rounded-lg p-3 text-xs text-[#0D47A1] flex items-start gap-2">
                <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Certifique-se de que o <strong>CRM/CRO</strong> do médico, carimbo, assinatura e
                  data estão perfeitamente visíveis para evitar pedidos de correção pelo RH.
                </span>
              </div>

              {/* Botões do rodapé */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0F0F0]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  className="border-[#E0E0E0] text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs h-9 font-semibold gap-1.5 min-w-[110px]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 2. Cards de Resumo / Legenda de Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['recebido', 'em_analise', 'validado', 'necessita_correcao'] as AtestadoStatus[]).map(
          (statusKey) => {
            const config = ATESTADO_STATUS_MAP[statusKey]
            const count = resumo[statusKey]

            return (
              <div
                key={statusKey}
                className="bg-white border rounded-xl p-3.5 shadow-2xs transition-all"
                style={{ borderLeft: `4px solid ${config.color}` }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: config.color }}
                  >
                    {config.label}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                </div>
                <div className="text-xl font-extrabold text-[#212121] mt-1">{count}</div>
                <p className="text-[11px] text-[#757575] mt-0.5 line-clamp-1">
                  {config.description}
                </p>
              </div>
            )
          },
        )}
      </div>

      {/* 3. Lista de Atestados Enviados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#0D47A1]" />
            <h2 className="text-base font-bold text-[#212121]">Histórico de Atestados Enviados</h2>
            <Badge variant="outline" className="text-xs bg-white text-[#757575]">
              {atestados.length} {atestados.length === 1 ? 'registro' : 'registros'}
            </Badge>
          </div>
          <span className="text-[11px] text-[#757575] hidden sm:inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Atualização em tempo real ativada
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border border-[#E0E0E0] p-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-40 bg-slate-100" />
                  <Skeleton className="h-6 w-24 bg-slate-100" />
                </div>
                <Skeleton className="h-4 w-3/4 mt-3 bg-slate-100" />
              </Card>
            ))}
          </div>
        ) : atestados.length === 0 ? (
          <Card className="border border-dashed border-[#E0E0E0] bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8EEF7] text-[#0D47A1] mb-3">
              <FileCheck className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-[#212121]">Nenhum atestado enviado ainda</h3>
            <p className="text-xs text-[#757575] max-w-md mx-auto mt-1">
              Quando você precisar se ausentar por motivos de saúde ou consulta médica, clique em
              &quot;Enviar Atestado&quot; acima para encaminhar o comprovante ao RH.
            </p>
            <Button
              onClick={() => setModalOpen(true)}
              className="mt-4 bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-9 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Enviar Primeiro Atestado
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {atestados.map((item) => {
              const statusCfg = ATESTADO_STATUS_MAP[item.status] || ATESTADO_STATUS_MAP.recebido
              const fileUrl = atestadoService.getFileUrl(item)

              return (
                <Card
                  key={item.id}
                  className="border border-[#E0E0E0] bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden"
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Lado Esquerdo: Período, Data de Envio e Anexo */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-[#757575] flex items-center gap-1">
                            <CalendarIcon className="h-3.5 w-3.5 text-[#0D47A1]" />
                            Período:
                          </span>
                          <span className="text-sm font-bold text-[#212121]">
                            {formatarPeriodo(item.data_inicio, item.qtd_dias)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[#757575] flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Enviado em: {formatarDataEnvio(item.data_envio, item.created)}
                          </span>

                          {item.data_resposta && (
                            <span className="text-[11px] text-[#616161]">
                              • Respondido pelo RH em: {formatarDataEnvio(item.data_resposta)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Lado Direito: Badge do Status nas cores exatas */}
                      <div className="flex items-center sm:flex-col sm:items-end gap-2 shrink-0">
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-2xs"
                          style={{ backgroundColor: statusCfg.color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          {statusCfg.label}
                        </span>
                        <span className="text-[11px] text-[#757575]">{statusCfg.description}</span>
                      </div>
                    </div>

                    {/* Comentário do RH (se houver) — destaque especial quando necessita correção */}
                    {item.comentario_rh && (
                      <div
                        className={`mt-3.5 rounded-lg p-3 text-xs border ${
                          item.status === 'necessita_correcao'
                            ? 'bg-[#FFEBEE] border-[#D32F2F]/30 text-[#C62828]'
                            : 'bg-[#F5F5F5] border-[#E0E0E0] text-[#424242]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold mb-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Comentário do RH:</span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">{item.comentario_rh}</p>
                      </div>
                    )}

                    {/* Ações / Botões do Card */}
                    <div className="mt-3.5 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {fileUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewAtestado(item)}
                            className="h-8 text-xs border-[#E0E0E0] text-[#0D47A1] hover:bg-[#E8EEF7] gap-1.5 font-medium"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Visualizar Comprovante
                          </Button>
                        ) : (
                          <span className="text-[11px] text-[#9E9E9E] italic">
                            Sem anexo digital anexado
                          </span>
                        )}
                      </div>

                      {item.status === 'necessita_correcao' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setDataInicio(item.data_inicio ? item.data_inicio.split('T')[0] : '')
                            setQtdDias(item.qtd_dias || 1)
                            setModalOpen(true)
                          }}
                          className="h-8 text-xs bg-[#D32F2F] hover:bg-[#B71C1C] text-white font-semibold gap-1.5"
                        >
                          <UploadCloud className="h-3.5 w-3.5" />
                          Reenviar Atestado Corrigido
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. Modal de Visualização do Anexo / Detalhes */}
      <Dialog open={!!previewAtestado} onOpenChange={(open) => !open && setPreviewAtestado(null)}>
        {previewAtestado && (
          <DialogContent className="max-w-2xl bg-white border border-[#E0E0E0] p-6 max-h-[90vh] flex flex-col">
            <DialogHeader className="text-left space-y-1 pb-2 border-b border-[#E0E0E0]">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#0D47A1]" />
                  Comprovante de Atestado Médico
                </DialogTitle>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{
                    backgroundColor:
                      ATESTADO_STATUS_MAP[previewAtestado.status]?.color || '#0D47A1',
                  }}
                >
                  {ATESTADO_STATUS_MAP[previewAtestado.status]?.label}
                </span>
              </div>
              <DialogDescription className="text-xs text-[#757575]">
                Período: {formatarPeriodo(previewAtestado.data_inicio, previewAtestado.qtd_dias)} •
                Enviado em {formatarDataEnvio(previewAtestado.data_envio, previewAtestado.created)}
              </DialogDescription>
            </DialogHeader>

            {/* Visualizador de Imagem / PDF */}
            <div className="flex-1 overflow-y-auto py-3 min-h-[300px] flex flex-col items-center justify-center bg-[#F9FAFB] rounded-lg border border-[#E0E0E0]">
              {(() => {
                const url = atestadoService.getFileUrl(previewAtestado)
                if (!url) {
                  return (
                    <div className="text-center p-6 text-xs text-[#757575]">
                      <FileQuestion className="h-8 w-8 mx-auto mb-2 text-[#9E9E9E]" />
                      Nenhum arquivo encontrado para este atestado.
                    </div>
                  )
                }

                const isPdf =
                  url.toLowerCase().endsWith('.pdf') ||
                  previewAtestado.anexo?.toLowerCase().endsWith('.pdf')

                if (isPdf) {
                  return (
                    <div className="w-full h-[450px] flex flex-col">
                      <iframe
                        src={url}
                        title="Documento PDF do Atestado"
                        className="w-full flex-1 rounded border-0"
                      />
                      <div className="p-2 text-center bg-white border-t border-[#E0E0E0]">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[#0D47A1] font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Abrir PDF em nova aba
                        </a>
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="w-full flex flex-col items-center">
                    <img
                      src={url}
                      alt="Atestado médico"
                      className="max-h-[460px] max-w-full object-contain rounded shadow-xs"
                    />
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 text-xs text-[#0D47A1] font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Visualizar imagem em tamanho original
                    </a>
                  </div>
                )
              })()}
            </div>

            {/* Rodapé do Modal */}
            <div className="pt-3 border-t border-[#E0E0E0] flex items-center justify-between text-xs">
              <span className="text-[#757575] text-[11px]">
                Gente e Gestão Tesla • Validação RH
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewAtestado(null)}
                className="h-8 text-xs border-[#E0E0E0]"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
