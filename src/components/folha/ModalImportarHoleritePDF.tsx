import React, { useState, useRef, useMemo } from 'react'
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck,
  AlertCircle,
  HelpCircle,
  Users,
  Calendar,
  DollarSign,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Copy,
  Layers,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { useToast } from '@/hooks/use-toast'
import { Colaborador } from '@/types'
import { formatMoedaPtBr } from '@/lib/exportReports'
import {
  holeriteImportService,
  ArquivoHoleriteProcessado,
  ResultadoImportacaoHoleritePDF,
} from '@/services/holeriteImportService'
import { RubricaHoleriteParsed } from '@/lib/holeriteParserTesla'

export interface ModalImportarHoleritePDFProps {
  open: boolean
  onClose: () => void
  tenantId: string
  userId: string
  colaboradores: Colaborador[]
  onSuccess: () => void
  colaboradorPreSelecionado?: Colaborador | null
}

export const ModalImportarHoleritePDF: React.FC<ModalImportarHoleritePDFProps> = ({
  open,
  onClose,
  tenantId,
  userId,
  colaboradores,
  onSuccess,
  colaboradorPreSelecionado,
}) => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [arquivosProcessados, setArquivosProcessados] = useState<ArquivoHoleriteProcessado[]>([])
  const [processando, setProcessando] = useState(false)
  const [progressoTexto, setProgressoTexto] = useState('')
  const [importando, setImportando] = useState(false)
  const [arquivoSelecionadoId, setArquivoSelecionadoId] = useState<string | null>(null)
  const [mostrarDetalhesTabela, setMostrarDetalhesTabela] = useState(true)

  // Resultado pós-importação
  const [resultadoFinal, setResultadoFinal] = useState<ResultadoImportacaoHoleritePDF | null>(null)

  const limparEstado = () => {
    setArquivosProcessados([])
    setProcessando(false)
    setProgressoTexto('')
    setImportando(false)
    setArquivoSelecionadoId(null)
    setResultadoFinal(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    limparEstado()
    onClose()
  }

  // 1. Processamento de Upload (Um ou múltiplos PDFs)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setProcessando(true)
    const novosProcessados: ArquivoHoleriteProcessado[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgressoTexto(`Processando ${i + 1} de ${files.length}: ${file.name}...`)

      try {
        const item = await holeriteImportService.processarArquivoPdf(file, tenantId, colaboradores)

        // Se veio de uma ficha específica com colaborador pré-selecionado e não tinha achado vínculo
        if (colaboradorPreSelecionado && !item.colaboradorId) {
          item.colaboradorId = colaboradorPreSelecionado.id
          item.colaboradorEncontrado = colaboradorPreSelecionado
          item.colaboradorMatchTipo = 'manual'
          if (item.status === 'revisar' && item.conferenciaMatematicaOk) {
            item.status = 'pronto'
          }
        }

        novosProcessados.push(item)
      } catch (err: unknown) {
        console.error('Erro ao ler PDF:', err)
      }
    }

    setArquivosProcessados((prev) => [...prev, ...novosProcessados])
    if (novosProcessados.length > 0 && !arquivoSelecionadoId) {
      setArquivoSelecionadoId(novosProcessados[0].id)
    }

    setProcessando(false)
    setProgressoTexto('')
  }

  // Arquivo em exibição detalhada
  const arquivoAtivo = useMemo(() => {
    return arquivosProcessados.find((a) => a.id === arquivoSelecionadoId) || arquivosProcessados[0]
  }, [arquivosProcessados, arquivoSelecionadoId])

  // 2. Atualizar Colaborador Vinculado Manualmente
  const handleAlterarColaborador = (arquivoId: string, novoColabId: string) => {
    const colab = colaboradores.find((c) => c.id === novoColabId)
    setArquivosProcessados((prev) =>
      prev.map((item) => {
        if (item.id !== arquivoId) return item
        const statusNovo = item.conferenciaMatematicaOk && colab ? 'pronto' : 'revisar'
        return {
          ...item,
          colaboradorId: novoColabId,
          colaboradorEncontrado: colab,
          colaboradorMatchTipo: 'manual',
          status: item.status === 'escaneado' ? 'escaneado' : statusNovo,
        }
      }),
    )
  }

  // 3. Atualizar Competência
  const handleAlterarCompetencia = (arquivoId: string, mes: number, ano: number) => {
    const compFormatada = `${ano}-${String(mes).padStart(2, '0')}`
    setArquivosProcessados((prev) =>
      prev.map((item) => {
        if (item.id !== arquivoId) return item
        return {
          ...item,
          competenciaMes: mes,
          competenciaAno: ano,
          competenciaFormatada: compFormatada,
        }
      }),
    )
  }

  // 4. Edição de Rubrica na Pré-visualização
  const handleAlterarRubrica = (
    arquivoId: string,
    rubricaId: string,
    campo: keyof RubricaHoleriteParsed,
    valor: any,
  ) => {
    setArquivosProcessados((prev) =>
      prev.map((item) => {
        if (item.id !== arquivoId) return item

        const novosItens = item.itens.map((r) => {
          if (r.id !== rubricaId) return r
          return { ...r, [campo]: valor }
        })

        // Recalcula totais
        const totProv = novosItens
          .filter((r) => r.tipo === 'provento')
          .reduce((sum, r) => sum + (Number(r.valor) || 0), 0)
        const totDesc = novosItens
          .filter((r) => r.tipo === 'desconto')
          .reduce((sum, r) => sum + (Number(r.valor) || 0), 0)
        const totLiq = Math.round((totProv - totDesc) * 100) / 100

        const dif = Math.round(Math.abs(totProv - totDesc - totLiq) * 100) / 100
        const confOk = dif < 0.05
        const colabOk = Boolean(item.colaboradorId)

        return {
          ...item,
          itens: novosItens,
          totalProventos: Math.round(totProv * 100) / 100,
          totalDescontos: Math.round(totDesc * 100) / 100,
          totalLiquido: totLiq,
          conferenciaMatematicaOk: confOk,
          diferencaCalculo: dif,
          status: colabOk && confOk ? 'pronto' : 'revisar',
        }
      }),
    )
  }

  // 5. Adicionar Rubrica Manual
  const handleAdicionarRubrica = (arquivoId: string) => {
    setArquivosProcessados((prev) =>
      prev.map((item) => {
        if (item.id !== arquivoId) return item
        const novaRubrica: RubricaHoleriteParsed = {
          id: `manual-${Date.now()}`,
          codigo: '000',
          descricao: 'NOVO EVENTO',
          referencia: '1,00',
          tipo: 'provento',
          valor: 0,
        }
        return {
          ...item,
          itens: [...item.itens, novaRubrica],
        }
      }),
    )
  }

  // 6. Remover Rubrica
  const handleRemoverRubrica = (arquivoId: string, rubricaId: string) => {
    setArquivosProcessados((prev) =>
      prev.map((item) => {
        if (item.id !== arquivoId) return item
        const novosItens = item.itens.filter((r) => r.id !== rubricaId)
        const totProv = novosItens
          .filter((r) => r.tipo === 'provento')
          .reduce((sum, r) => sum + (Number(r.valor) || 0), 0)
        const totDesc = novosItens
          .filter((r) => r.tipo === 'desconto')
          .reduce((sum, r) => sum + (Number(r.valor) || 0), 0)
        const totLiq = Math.round((totProv - totDesc) * 100) / 100

        return {
          ...item,
          itens: novosItens,
          totalProventos: Math.round(totProv * 100) / 100,
          totalDescontos: Math.round(totDesc * 100) / 100,
          totalLiquido: totLiq,
          conferenciaMatematicaOk: true,
          diferencaCalculo: 0,
        }
      }),
    )
  }

  // 7. Alterar ação de duplicidade (Substituir vs Pular)
  const handleToggleAcaoDuplicidade = (arquivoId: string, acao: 'substituir' | 'pular') => {
    setArquivosProcessados((prev) =>
      prev.map((item) => (item.id === arquivoId ? { ...item, acaoDuplicidade: acao } : item)),
    )
  }

  // 8. Confirmar e Efetivar Gravação
  const handleConfirmarImportacao = async () => {
    // Arquivos aptos: aqueles prontos para gravação
    const aptos = arquivosProcessados.filter(
      (a) =>
        a.colaboradorId &&
        (a.status === 'pronto' || (a.status === 'revisar' && a.conferenciaMatematicaOk)),
    )

    if (aptos.length === 0) {
      toast({
        title: 'Nenhum holerite apto para gravação',
        description:
          'Vincule os colaboradores e verifique se a conferência matemática está batida antes de confirmar.',
        variant: 'destructive',
      })
      return
    }

    setImportando(true)
    try {
      const res = await holeriteImportService.confirmarImportacaoHolerites(aptos, tenantId, userId)
      setResultadoFinal(res)

      toast({
        title: 'Importação de Holerites Concluída!',
        description: `${res.importados} holerite(s) gravado(s) com sucesso na folha e documentos.`,
      })

      onSuccess()
    } catch (err: unknown) {
      console.error('Erro na gravação dos holerites:', err)
      toast({
        title: 'Erro ao gravar holerites',
        description: err instanceof Error ? err.message : 'Falha na persistência dos dados.',
        variant: 'destructive',
      })
    } finally {
      setImportando(false)
    }
  }

  const totalProntos = arquivosProcessados.filter((a) => a.status === 'pronto').length
  const totalRevisar = arquivosProcessados.filter(
    (a) => a.status === 'revisar' || a.status === 'escaneado' || a.status === 'erro',
  ).length
  const totalAptosConfirmar = arquivosProcessados.filter(
    (a) =>
      a.colaboradorId &&
      (a.status === 'pronto' || (a.status === 'revisar' && a.conferenciaMatematicaOk)),
  ).length

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 bg-white border border-slate-200 shadow-2xl">
        {/* CABEÇALHO DA MODAL COM IDENTIDADE TESLA */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#0D47A1] text-white shadow-xs">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    Importar Holerites em PDF (Modelo Oficial Tesla)
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-[#0D47A1] border-blue-200 text-[10px] font-bold"
                  >
                    RLS Admin RH
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Leitura determinística, conferência matemática de proventos e descontos,
                  lançamento automático na folha e arquivamento com código de verificação.
                </DialogDescription>
              </div>
            </div>

            {arquivosProcessados.length > 0 && !resultadoFinal && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={processando || importando}
                className="gap-1.5 text-xs text-[#0D47A1] border-blue-200 hover:bg-blue-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar mais PDFs
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* CORPO PRINCIPAL COM SCROLL */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* TELA DE RESULTADOS FINAIS (QUANDO JÁ GRAVADO) */}
          {resultadoFinal ? (
            <div className="space-y-5 py-4">
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-emerald-900">
                  Importação de Holerites Concluída com Sucesso!
                </h3>
                <p className="text-xs text-emerald-700 max-w-lg mx-auto">
                  Os lançamentos foram cadastrados na folha financeira dos colaboradores, o registro
                  de autenticidade foi gerado e o arquivo PDF original foi anexado à ficha do
                  colaborador.
                </p>
                <div className="flex items-center justify-center gap-4 pt-3">
                  <div className="px-4 py-2 rounded-lg bg-white border border-emerald-200 shadow-xs text-center">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">Importados</p>
                    <p className="text-xl font-black text-emerald-700">
                      {resultadoFinal.importados}
                    </p>
                  </div>
                  {resultadoFinal.substituidos > 0 && (
                    <div className="px-4 py-2 rounded-lg bg-white border border-amber-200 shadow-xs text-center">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">
                        Substituídos
                      </p>
                      <p className="text-xl font-black text-amber-700">
                        {resultadoFinal.substituidos}
                      </p>
                    </div>
                  )}
                  {resultadoFinal.ignorados > 0 && (
                    <div className="px-4 py-2 rounded-lg bg-white border border-slate-200 shadow-xs text-center">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">
                        Ignorados
                      </p>
                      <p className="text-xl font-black text-slate-600">
                        {resultadoFinal.ignorados}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Detalhes de cada item importado */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-[11px]">
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultadoFinal.detalhes.map((det, idx) => (
                      <TableRow key={idx} className="text-xs">
                        <TableCell className="font-mono text-[11px] text-slate-700">
                          {det.arquivo}
                        </TableCell>
                        <TableCell className="font-bold text-slate-800">
                          {det.colaborador}
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">
                          {det.competencia}
                        </TableCell>
                        <TableCell className="text-center">
                          {det.status === 'sucesso' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                              Gravado & Notificado
                            </Badge>
                          ) : det.status === 'ignorado' ? (
                            <Badge className="bg-slate-100 text-slate-600 text-[10px]">
                              Pular Duplicidade
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-100 text-rose-800 text-[10px]">
                              {det.motivo || 'Erro'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : arquivosProcessados.length === 0 ? (
            /* ZONA DE DROP E SELEÇÃO DE ARQUIVOS */
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed border-[#0D47A1]/30 bg-blue-50/30 p-10 text-center hover:bg-blue-50/60 hover:border-[#0D47A1] cursor-pointer transition-all space-y-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload"
                />
                <div className="h-16 w-16 mx-auto rounded-full bg-blue-100/80 text-[#0D47A1] flex items-center justify-center shadow-inner">
                  <Upload className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Selecione ou arraste um ou vários PDFs de Holerite
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Compatível com o layout oficial da Tesla Mecatrônica Serviços Ltda. Suporte a
                    múltiplos colaboradores em lote.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#0D47A1] hover:bg-[#0B3D91] text-white text-xs px-4"
                  >
                    Procurar no Computador
                  </Button>
                </div>
              </div>

              {/* Box de Instruções e Diretrizes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-[#0D47A1]">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Conferência Matemática & Vínculo</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    O sistema valida automaticamente se a fórmula{' '}
                    <strong>(Proventos − Descontos = Líquido)</strong> confere com exatidão e busca
                    o colaborador por CPF ou Nome completo no cadastro do tenant.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Plano B — Documento Digital vs. Escaneado</span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 leading-relaxed">
                    Holerites devem ser PDFs digitais com camada de texto. Arquivos escaneados em
                    imagem pura exigem o arquivo digital original emitido pela contabilidade.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* LISTAGEM DE ARQUIVOS PROCESSADOS & PRÉ-VISUALIZAÇÃO EDITÁVEL */
            <div className="space-y-5">
              {/* STATUS BAR DO LOTE */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-slate-800">
                    Lote:{' '}
                    <strong className="text-[#0D47A1]">
                      {arquivosProcessados.length} holerite(s)
                    </strong>
                  </span>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold"
                  >
                    {totalProntos} Pronto(s)
                  </Badge>
                  {totalRevisar > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] font-bold"
                    >
                      {totalRevisar} Necessita Revisão
                    </Badge>
                  )}
                </div>

                {processando && (
                  <div className="flex items-center gap-2 text-xs text-[#0D47A1] font-semibold animate-pulse">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>{progressoTexto || 'Processando arquivos...'}</span>
                  </div>
                )}
              </div>

              {/* SELETOR EM ABAS DOS ARQUIVOS ENVIADOS */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
                {arquivosProcessados.map((item, idx) => {
                  const isSelected = item.id === arquivoAtivo?.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setArquivoSelecionadoId(item.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                        isSelected
                          ? 'border-[#0D47A1] bg-blue-50/70 text-[#0D47A1]'
                          : 'border-transparent text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>#{idx + 1}</span>
                      <span className="max-w-[140px] truncate">{item.nomeArquivo}</span>
                      {item.status === 'pronto' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : item.status === 'escaneado' ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                      ) : item.status === 'erro' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* DETALHES DO ARQUIVO ATIVO */}
              {arquivoAtivo && (
                <div className="space-y-4">
                  {/* ALERTA VISÍVEL DO MOTIVO REAL DE FALHA */}
                  {arquivoAtivo.status === 'escaneado' ? (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-rose-800">
                        <AlertTriangle className="h-5 w-5 text-rose-600" />
                        <span>Arquivo Escaneado sem Camada de Texto</span>
                      </div>
                      <p className="leading-relaxed">
                        O arquivo <strong>&quot;{arquivoAtivo.nomeArquivo}&quot;</strong> foi
                        analisado por ambas as camadas de extração (servidor e leitor do navegador)
                        e não possui caracteres legíveis. O PDF aparenta ser uma imagem
                        digitalizada. Para garantir segurança contábil sem adivinhação de pixels por
                        IA, faça o download do PDF digital oficial no software de folha ou realize o
                        lançamento manual preenchendo os campos abaixo.
                      </p>
                    </div>
                  ) : arquivoAtivo.status === 'erro' ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-800">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <span>
                          Diagnóstico da Leitura:{' '}
                          {arquivoAtivo.motivoDiagnostico || 'Falha ao processar o arquivo'}
                        </span>
                      </div>
                      <p className="leading-relaxed">
                        O arquivo <strong>&quot;{arquivoAtivo.nomeArquivo}&quot;</strong> não pôde
                        ter seus dados extraídos automaticamente:{' '}
                        <em>{arquivoAtivo.mensagemErro}</em>. Você pode conferir o arquivo ou
                        preencher os campos abaixo manualmente.
                      </p>
                    </div>
                  ) : arquivoAtivo.camadaExtracao === 'navegador' ? (
                    <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-[#0D47A1]" />
                        <span>
                          Extração executada via{' '}
                          <strong>Camada 2 (Leitor de PDF no Navegador)</strong> com sucesso.
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-blue-100/60 text-[#0D47A1] border-blue-300"
                      >
                        Fallback Ativo
                      </Badge>
                    </div>
                  ) : null}

                  {/* ALERTA DE DUPLICIDADE (SE HOUVER) */}
                  {arquivoAtivo.duplicidadeDetectada && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">
                            Holerite já existente para este colaborador na competência{' '}
                            {arquivoAtivo.competenciaFormatada}!
                          </p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Escolha se deseja substituir os lançamentos anteriores ou pular este
                            arquivo.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant={
                            arquivoAtivo.acaoDuplicidade === 'substituir' ? 'default' : 'outline'
                          }
                          onClick={() => handleToggleAcaoDuplicidade(arquivoAtivo.id, 'substituir')}
                          className={`h-7 text-xs ${
                            arquivoAtivo.acaoDuplicidade === 'substituir'
                              ? 'bg-amber-700 text-white hover:bg-amber-800'
                              : 'border-amber-300 text-amber-800 hover:bg-amber-100'
                          }`}
                        >
                          Substituir Lançamentos
                        </Button>
                        <Button
                          size="sm"
                          variant={arquivoAtivo.acaoDuplicidade === 'pular' ? 'default' : 'outline'}
                          onClick={() => handleToggleAcaoDuplicidade(arquivoAtivo.id, 'pular')}
                          className={`h-7 text-xs ${
                            arquivoAtivo.acaoDuplicidade === 'pular'
                              ? 'bg-slate-700 text-white'
                              : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          Pular Arquivo
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* IDENTIFICAÇÃO DO COLABORADOR & COMPETÊNCIA */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl border border-slate-200 bg-white">
                    {/* Colaborador Vinculado */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Colaborador Vinculado</span>
                        {arquivoAtivo.colaboradorMatchTipo && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            (via {arquivoAtivo.colaboradorMatchTipo.toUpperCase()})
                          </span>
                        )}
                      </label>
                      <Select
                        value={arquivoAtivo.colaboradorId || ''}
                        onValueChange={(val) => handleAlterarColaborador(arquivoAtivo.id, val)}
                      >
                        <SelectTrigger className="h-9 text-xs bg-slate-50 border-slate-200">
                          <SelectValue placeholder="Selecione o colaborador..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {colaboradores.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.nome_completo || c.nome} — CPF: {c.cpf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!arquivoAtivo.colaboradorId && (
                        <p className="text-[10px] text-rose-600 font-semibold">
                          * Seleção obrigatória para vincular o holerite.
                        </p>
                      )}
                    </div>

                    {/* Competência (Mês / Ano) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Competência da Folha
                      </label>
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={String(arquivoAtivo.competenciaMes)}
                          onValueChange={(val) =>
                            handleAlterarCompetencia(
                              arquivoAtivo.id,
                              Number(val),
                              arquivoAtivo.competenciaAno,
                            )
                          }
                        >
                          <SelectTrigger className="h-9 text-xs bg-slate-50 border-slate-200 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              'Janeiro',
                              'Fevereiro',
                              'Março',
                              'Abril',
                              'Maio',
                              'Junho',
                              'Julho',
                              'Agosto',
                              'Setembro',
                              'Outubro',
                              'Novembro',
                              'Dezembro',
                            ].map((m, idx) => (
                              <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={String(arquivoAtivo.competenciaAno)}
                          onValueChange={(val) =>
                            handleAlterarCompetencia(
                              arquivoAtivo.id,
                              arquivoAtivo.competenciaMes,
                              Number(val),
                            )
                          }
                        >
                          <SelectTrigger className="w-24 h-9 text-xs bg-slate-50 border-slate-200">
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
                      </div>
                    </div>

                    {/* Conferência Matemática */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Conferência Matemática
                      </label>
                      <div
                        className={`h-9 px-3 rounded-lg border flex items-center justify-between text-xs ${
                          arquivoAtivo.conferenciaMatematicaOk
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        <span className="font-semibold flex items-center gap-1.5">
                          {arquivoAtivo.conferenciaMatematicaOk ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Equação Batida (100%)
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                              Divergência: {formatMoedaPtBr(arquivoAtivo.diferencaCalculo)}
                            </>
                          )}
                        </span>
                        <span className="font-mono text-[11px]">
                          {formatMoedaPtBr(arquivoAtivo.totalLiquido)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CARDS COM TOTALIZADORES EDITÁVEIS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                        Total de Vencimentos
                      </span>
                      <p className="text-lg font-black text-emerald-700 mt-0.5">
                        {formatMoedaPtBr(arquivoAtivo.totalProventos)}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200">
                      <span className="text-[10px] uppercase font-bold text-rose-800 tracking-wider">
                        Total de Descontos
                      </span>
                      <p className="text-lg font-black text-rose-700 mt-0.5">
                        {formatMoedaPtBr(arquivoAtivo.totalDescontos)}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0D47A1]/10 border border-[#0D47A1]/30">
                      <span className="text-[10px] uppercase font-bold text-[#0D47A1] tracking-wider">
                        Valor Líquido Apurado
                      </span>
                      <p className="text-lg font-black text-[#0D47A1] mt-0.5">
                        {formatMoedaPtBr(arquivoAtivo.totalLiquido)}
                      </p>
                    </div>
                  </div>

                  {/* TABELA DE RUBRICAS (PROVENTOS E DESCONTOS) EDITÁVEL */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setMostrarDetalhesTabela(!mostrarDetalhesTabela)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-[#0D47A1]"
                      >
                        {mostrarDetalhesTabela ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        <span>
                          Rubricas Extraídas do Holerite ({arquivoAtivo.itens.length} itens)
                        </span>
                      </button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAdicionarRubrica(arquivoAtivo.id)}
                        className="h-7 text-xs text-[#0D47A1] hover:bg-blue-50 gap-1 font-semibold"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar Linha
                      </Button>
                    </div>

                    {mostrarDetalhesTabela && (
                      <div className="max-h-60 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/80 text-[11px]">
                              <TableHead className="w-16">Código</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="w-20">Ref.</TableHead>
                              <TableHead className="w-28">Tipo</TableHead>
                              <TableHead className="w-32 text-right">Valor (R$)</TableHead>
                              <TableHead className="w-10 text-center"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {arquivoAtivo.itens.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  className="text-center py-6 text-xs text-slate-400"
                                >
                                  Nenhuma rubrica extraída automaticamente. Clique em
                                  &quot;Adicionar Linha&quot; para inserir manualmente.
                                </TableCell>
                              </TableRow>
                            ) : (
                              arquivoAtivo.itens.map((rubrica) => (
                                <TableRow key={rubrica.id} className="text-xs hover:bg-slate-50">
                                  <TableCell className="p-2">
                                    <Input
                                      value={rubrica.codigo}
                                      onChange={(e) =>
                                        handleAlterarRubrica(
                                          arquivoAtivo.id,
                                          rubrica.id,
                                          'codigo',
                                          e.target.value,
                                        )
                                      }
                                      className="h-7 text-[11px] font-mono p-1"
                                    />
                                  </TableCell>

                                  <TableCell className="p-2">
                                    <Input
                                      value={rubrica.descricao}
                                      onChange={(e) =>
                                        handleAlterarRubrica(
                                          arquivoAtivo.id,
                                          rubrica.id,
                                          'descricao',
                                          e.target.value,
                                        )
                                      }
                                      className="h-7 text-[11px] font-semibold p-1"
                                    />
                                  </TableCell>

                                  <TableCell className="p-2">
                                    <Input
                                      value={rubrica.referencia || ''}
                                      onChange={(e) =>
                                        handleAlterarRubrica(
                                          arquivoAtivo.id,
                                          rubrica.id,
                                          'referencia',
                                          e.target.value,
                                        )
                                      }
                                      className="h-7 text-[11px] font-mono p-1 text-center"
                                    />
                                  </TableCell>

                                  <TableCell className="p-2">
                                    <Select
                                      value={rubrica.tipo}
                                      onValueChange={(val: 'provento' | 'desconto') =>
                                        handleAlterarRubrica(
                                          arquivoAtivo.id,
                                          rubrica.id,
                                          'tipo',
                                          val,
                                        )
                                      }
                                    >
                                      <SelectTrigger
                                        className={`h-7 text-[11px] font-bold ${
                                          rubrica.tipo === 'provento'
                                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                            : 'text-rose-700 bg-rose-50 border-rose-200'
                                        }`}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="provento" className="text-xs">
                                          Provento (+)
                                        </SelectItem>
                                        <SelectItem value="desconto" className="text-xs">
                                          Desconto (−)
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>

                                  <TableCell className="p-2 text-right">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={rubrica.valor}
                                      onChange={(e) =>
                                        handleAlterarRubrica(
                                          arquivoAtivo.id,
                                          rubrica.id,
                                          'valor',
                                          parseFloat(e.target.value) || 0,
                                        )
                                      }
                                      className="h-7 text-[11px] font-mono font-bold text-right p-1"
                                    />
                                  </TableCell>

                                  <TableCell className="p-2 text-center">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        handleRemoverRubrica(arquivoAtivo.id, rubrica.id)
                                      }
                                      className="h-6 w-6 text-slate-400 hover:text-rose-600"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RODAPÉ COM AÇÕES */}
        <DialogFooter className="p-4 px-6 border-t border-slate-100 flex items-center justify-between sm:justify-between bg-slate-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={importando}
            className="text-xs text-slate-600"
          >
            {resultadoFinal ? 'Fechar' : 'Cancelar'}
          </Button>

          {!resultadoFinal && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleConfirmarImportacao}
                disabled={
                  importando ||
                  processando ||
                  arquivosProcessados.length === 0 ||
                  totalAptosConfirmar === 0
                }
                className="bg-[#0D47A1] hover:bg-[#0B3D91] text-white text-xs font-semibold gap-1.5 shadow-sm"
              >
                <FileCheck className="h-4 w-4" />
                {importando
                  ? 'Gravando Holerites...'
                  : `Confirmar e Gravar ${totalAptosConfirmar} Holerite(s)`}
              </Button>{' '}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
