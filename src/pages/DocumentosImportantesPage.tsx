import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  CheckCircle2,
  Clock,
  Eye,
  Shield,
  AlertTriangle,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { documentoService, cienciaDocumentoService, logAuditoriaService } from '@/services/api'
import { Documento, CienciaDocumento } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export default function DocumentosImportantesPage() {
  const { user, colaborador } = useAuth()
  const { toast } = useToast()

  const [documentosObrigatorios, setDocumentosObrigatorios] = useState<Documento[]>([])
  const [ciencias, setCiencias] = useState<CienciaDocumento[]>([])
  const [loading, setLoading] = useState(true)

  // Documento selecionado para leitura / visualização e ciência
  const [docSelecionado, setDocSelecionado] = useState<Documento | null>(null)
  const [registrandoCiencia, setRegistrandoCiencia] = useState(false)

  const tenantId = user?.tenant_id
  const colaboradorId = colaborador?.id

  // Carregar documentos obrigatórios do tenant e ciências do colaborador
  const carregarDados = async () => {
    if (!tenantId) return
    try {
      setLoading(true)

      // 1. Busca documentos do tenant
      const docs = await documentoService.getDocumentos(tenantId)
      // Filtra APENAS documentos corporativos com obrigatorio = true (sem colaborador_id ou de tenant)
      const obrigatorios = docs.filter((d) => d.obrigatorio && !d.colaborador_id)
      setDocumentosObrigatorios(obrigatorios)

      // 2. Se houver colaborador, busca as ciências já dadas
      if (colaboradorId) {
        const cienciasColab = await cienciaDocumentoService.getCienciasColaborador(colaboradorId)
        setCiencias(cienciasColab)
      }
    } catch (err) {
      console.error('Erro ao carregar documentos importantes:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os documentos importantes do tenant.',
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

  // Formatar data em pt-BR (ex: 15/08/2026)
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

  // Formatar versão para exibição (ex: "Versão: 02" ou "Versão: 2.0")
  const formatarVersao = (versaoStr?: string) => {
    const raw = (versaoStr || '1.0').trim()
    // Se for só número único, exibe com 2 dígitos ou exibe literal
    if (/^\d+$/.test(raw)) {
      return raw.padStart(2, '0')
    }
    return raw
  }

  // Verifica o status de ciência para cada documento:
  // Ciente (verde) apenas se houver registro de ciência correspondente à VERSÃO ATUAL
  // Pendente (laranja) se não houver ou se a ciência anterior pertencer a uma versão antiga
  const statusCienciasMap = useMemo(() => {
    const map: Record<
      string,
      {
        ciente: boolean
        dataCiencia?: string
        ip?: string
        versaoCiente?: string
        versaoAtual: string
      }
    > = {}

    documentosObrigatorios.forEach((doc) => {
      const versaoAtual = (doc.versao || '1.0').trim()
      // Procura a ciência mais recente do colaborador para este documento
      const cienciaValida = ciencias.find(
        (c) => c.documento_id === doc.id && (c.versao_ciente || '').trim() === versaoAtual,
      )

      if (cienciaValida) {
        map[doc.id] = {
          ciente: true,
          dataCiencia: cienciaValida.data_hora,
          ip: cienciaValida.ip_origem,
          versaoCiente: cienciaValida.versao_ciente,
          versaoAtual,
        }
      } else {
        // Verifica se deu ciência em versão antiga para diagnóstico
        const cienciaAntiga = ciencias.find((c) => c.documento_id === doc.id)
        map[doc.id] = {
          ciente: false,
          versaoCiente: cienciaAntiga?.versao_ciente,
          versaoAtual,
        }
      }
    })

    return map
  }, [documentosObrigatorios, ciencias])

  // Contadores de status
  const metricas = useMemo(() => {
    let cientes = 0
    let pendentes = 0
    documentosObrigatorios.forEach((d) => {
      if (statusCienciasMap[d.id]?.ciente) {
        cientes++
      } else {
        pendentes++
      }
    })
    return { total: documentosObrigatorios.length, cientes, pendentes }
  }, [documentosObrigatorios, statusCienciasMap])

  // Trata abertura do modal de visualização e ciência
  const handleAbrirDocumento = (doc: Documento) => {
    setDocSelecionado(doc)
  }

  // Registrar a ciência na versão atual
  const handleDarCiencia = async () => {
    if (!docSelecionado || !tenantId || !colaboradorId) {
      toast({
        title: 'Colaborador não identificado',
        description: 'Faça login com uma conta de colaborador para registrar sua ciência.',
        variant: 'destructive',
      })
      return
    }

    try {
      setRegistrandoCiencia(true)
      const versaoAtual = docSelecionado.versao || '1.0'

      const novaCiencia = await cienciaDocumentoService.registrarCiencia({
        tenant_id: tenantId,
        documento_id: docSelecionado.id,
        colaborador_id: colaboradorId,
        versao_doc: versaoAtual,
      })

      // Registrar auditoria
      if (user?.id) {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: 'ciencia_documento',
          entidade: 'ciencia_documento',
          entidade_id: novaCiencia.id,
          dados_json: {
            documento_id: docSelecionado.id,
            nome_documento: docSelecionado.nome,
            versao_ciente: versaoAtual,
            ip_origem: novaCiencia.ip_origem,
          },
        })
      }

      // Toast com o TEXTO EXATO exigido
      toast({
        title: 'Ciência registrada com sucesso',
        description: `Seu aceite na Versão ${formatarVersao(versaoAtual)} foi registrado em conformidade com as políticas corporativas.`,
      })

      // Atualiza lista local de ciências
      setCiencias((prev) => [novaCiencia, ...prev])
      setDocSelecionado(null)
    } catch (err) {
      console.error('Erro ao registrar ciência:', err)
      toast({
        title: 'Erro ao registrar ciência',
        description: 'Não foi possível salvar o seu registro de ciência. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setRegistrandoCiencia(false)
    }
  }

  // Obter URL do PDF do documento selecionado
  const urlArquivo = docSelecionado ? documentoService.getFileUrl(docSelecionado) : ''

  return (
    <div className="space-y-6 pb-12">
      {/* Header Corporativo da Tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-2xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E8EEF7] px-3 py-1 text-xs font-semibold text-[#0D47A1]">
            <Shield className="h-3.5 w-3.5 text-[#0D47A1]" />
            <span>Portal do Colaborador • Conformidade & Normas</span>
          </div>
          <h1 className="text-2xl font-bold text-[#212121] tracking-tight">
            Documentos Importantes
          </h1>
          <p className="text-sm text-[#757575] max-w-2xl">
            Documentos corporativos obrigatórios que requerem leitura e confirmação formal de
            ciência na versão vigente para todos os colaboradores da Tesla RH.
          </p>
        </div>

        {/* Resumo de conformidade */}
        <div className="flex items-center gap-3">
          <div className="bg-[#FAFAFA] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-right">
            <span className="block text-[11px] font-semibold text-[#757575] uppercase">
              Sua Conformidade
            </span>
            <span
              className={`text-sm font-bold ${
                metricas.pendentes === 0 ? 'text-[#2E7D32]' : 'text-amber-700'
              }`}
            >
              {metricas.pendentes === 0
                ? '100% em dia'
                : `${metricas.pendentes} pendente${metricas.pendentes > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-[#E0E0E0] bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#757575] uppercase tracking-wider">
                Documentos Obrigatórios
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
              <p className="text-xs font-semibold text-[#2E7D32] uppercase tracking-wider">
                Ciências Confirmadas
              </p>
              <p className="text-2xl font-bold text-[#2E7D32] mt-1">{metricas.cientes}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-[#2E7D32] flex items-center justify-center font-bold">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#E0E0E0] bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Pendentes de Leitura
              </p>
              <p className="text-2xl font-bold text-amber-800 mt-1">{metricas.pendentes}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Documentos Obrigatórios */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#212121] flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#0D47A1]" />
            Manuais e Normas que Exigem Ciência
          </h2>
          <span className="text-xs text-[#757575]">
            Clique no documento para ler e assinar eletronicamente
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border border-[#E0E0E0] p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-64 bg-slate-100" />
                    <Skeleton className="h-4 w-40 bg-slate-100" />
                  </div>
                  <Skeleton className="h-9 w-28 bg-slate-100" />
                </div>
              </Card>
            ))}
          </div>
        ) : documentosObrigatorios.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E0E0E0] bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F5F5] text-[#757575] mb-4">
              <Shield className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-[#212121]">
              Nenhum documento obrigatório cadastrado
            </h3>
            <p className="text-xs text-[#757575] mt-1 max-w-sm mx-auto">
              Sua organização ainda não publicou manuais corporativos ou normas com obrigatoriedade
              de ciência.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {documentosObrigatorios.map((doc) => {
              const status = statusCienciasMap[doc.id]
              const isCiente = status?.ciente
              const versaoFormatada = formatarVersao(doc.versao)
              const dataPubFormatada = formatarData(doc.data_publicacao || doc.created)
              const tevelNovaVersaoInvalida = !isCiente && Boolean(status?.versaoCiente)

              return (
                <Card
                  key={doc.id}
                  className={`border transition-all duration-200 overflow-hidden bg-white shadow-2xs hover:shadow-md ${
                    isCiente
                      ? 'border-[#E0E0E0] hover:border-[#2E7D32]/50'
                      : 'border-amber-300/80 bg-amber-50/20 hover:border-amber-500'
                  }`}
                >
                  <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Lado Esquerdo: Ícone de Status + Detalhes do Documento */}
                    <div className="flex items-start sm:items-center gap-4">
                      {/* Ícone de status visual: Verde (check) se ciente na versão atual; Laranja (relógio) se pendente */}
                      <div
                        className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                          isCiente ? 'bg-emerald-100 text-[#2E7D32]' : 'bg-amber-100 text-amber-700'
                        }`}
                        title={
                          isCiente
                            ? 'Ciência confirmada na versão vigente'
                            : 'Pendente de leitura e ciência'
                        }
                      >
                        {isCiente ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <Clock className="h-6 w-6 animate-pulse" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base text-[#212121] leading-tight">
                            {doc.nome}
                          </h3>

                          {isCiente ? (
                            <Badge className="bg-emerald-100 text-[#2E7D32] border-emerald-300 text-[11px] font-bold px-2 py-0 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Ciência Registrada
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] font-bold px-2 py-0 gap-1">
                              <Clock className="h-3 w-3" />
                              Pendente de Ciência
                            </Badge>
                          )}

                          {tevelNovaVersaoInvalida && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-400 text-[10px] font-semibold"
                            >
                              Nova versão publicada (v{formatarVersao(status?.versaoCiente)}{' '}
                              obsoleta)
                            </Badge>
                          )}
                        </div>

                        {/* Metadados: Versão atual e Data de Publicação */}
                        <div className="flex items-center gap-4 text-xs text-[#757575] flex-wrap pt-0.5">
                          <span className="font-semibold text-[#0D47A1] bg-[#E8EEF7] px-2 py-0.5 rounded-md">
                            Versão: {versaoFormatada}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Publicado: {dataPubFormatada}
                          </span>
                          {doc.expand?.categoria_id?.nome && (
                            <span className="text-[#616161]">
                              Categoria: {doc.expand.categoria_id.nome}
                            </span>
                          )}
                        </div>

                        {/* Detalhes do registro de ciência */}
                        {isCiente && status?.dataCiencia && (
                          <p className="text-[11px] text-[#2E7D32] pt-0.5 font-medium">
                            ✓ Ciência registrada em {formatarData(status.dataCiencia)}
                            {status.ip ? ` • IP: ${status.ip}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Lado Direito: Botão para abrir e dar ciência */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <Button
                        onClick={() => handleAbrirDocumento(doc)}
                        className={`text-xs font-semibold h-10 px-4 gap-2 ${
                          isCiente
                            ? 'bg-white border border-[#E0E0E0] text-[#212121] hover:bg-[#F5F5F5]'
                            : 'bg-[#0D47A1] hover:bg-[#0A3A82] text-white shadow-sm'
                        }`}
                      >
                        <Eye className="h-4 w-4" />
                        {isCiente ? 'Visualizar Documento' : 'Ler e Dar Ciência'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal / Dialog de Visualização do Documento e Ciência */}
      <Dialog
        open={Boolean(docSelecionado)}
        onOpenChange={(open) => !open && setDocSelecionado(null)}
      >
        {docSelecionado && (
          <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white border border-[#E0E0E0]">
            {/* Header do Modal */}
            <div className="p-5 border-b border-[#E0E0E0] bg-[#FAFAFA] flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center font-bold">
                    <FileText className="h-4 w-4" />
                  </div>
                  <DialogTitle className="text-base font-bold text-[#212121]">
                    {docSelecionado.nome}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-[#757575] flex items-center gap-3">
                  <span>Versão atual: {formatarVersao(docSelecionado.versao)}</span>
                  <span>•</span>
                  <span>
                    Publicado em:{' '}
                    {formatarData(docSelecionado.data_publicacao || docSelecionado.created)}
                  </span>
                </DialogDescription>
              </div>

              {urlArquivo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(urlArquivo, '_blank', 'noopener,noreferrer')}
                  className="text-xs border-[#E0E0E0] gap-1.5 h-8 hidden sm:flex"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir em Nova Aba
                </Button>
              )}
            </div>

            {/* Visualizador de PDF / Arquivo */}
            <div className="flex-1 min-h-[380px] max-h-[58vh] bg-[#525659] relative overflow-hidden flex items-center justify-center">
              {urlArquivo ? (
                <iframe
                  src={`${urlArquivo}#toolbar=1&navpanes=0`}
                  title={docSelecionado.nome}
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="bg-white p-8 rounded-xl max-w-md text-center m-4 shadow-lg border border-[#E0E0E0]">
                  <div className="h-12 w-12 rounded-full bg-blue-50 text-[#0D47A1] mx-auto flex items-center justify-center mb-3">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-sm text-[#212121] mb-1">
                    Visualização do Documento
                  </h4>
                  <p className="text-xs text-[#757575] leading-relaxed mb-4">
                    Este é o registro oficial de <strong>{docSelecionado.nome}</strong> (Versão{' '}
                    {formatarVersao(docSelecionado.versao)}). Como se trata de um documento de
                    demonstração sem binário hospedado, sua leitura pode ser validada diretamente
                    abaixo.
                  </p>
                  <div className="bg-[#F5F5F5] p-3 rounded-lg text-left text-xs text-[#424242] space-y-1">
                    <p className="font-semibold text-[#0D47A1]">Sumário Normativo:</p>
                    <p>• Diretrizes de conformidade corporativa e ética no trabalho;</p>
                    <p>• Uso responsável dos recursos computacionais e privacidade;</p>
                    <p>• Padrões de segurança, ergonomia e saúde ocupacional.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé com Status e Botão Exato de Ciência */}
            <div className="p-4 bg-white border-t border-[#E0E0E0] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-[#757575] text-center sm:text-left">
                {statusCienciasMap[docSelecionado.id]?.ciente ? (
                  <div className="flex items-center gap-2 text-[#2E7D32] font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      Você já deu ciência nesta versão em{' '}
                      {formatarData(statusCienciasMap[docSelecionado.id]?.dataCiencia)}.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      A confirmação registrará sua data/hora e o IP de origem para fins de
                      auditoria.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDocSelecionado(null)}
                  className="text-xs h-9 border-[#E0E0E0]"
                >
                  Fechar
                </Button>

                {/* Botão com o TEXTO EXATO exigido: "Estou ciente das informações apresentadas neste documento" */}
                {!statusCienciasMap[docSelecionado.id]?.ciente && (
                  <Button
                    onClick={handleDarCiencia}
                    disabled={registrandoCiencia}
                    className="text-xs h-9 bg-[#2E7D32] hover:bg-[#256628] text-white font-semibold shadow-xs px-4"
                  >
                    {registrandoCiencia
                      ? 'Gravando ciência...'
                      : 'Estou ciente das informações apresentadas neste documento'}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
