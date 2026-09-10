import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Info,
  Download,
  Loader2,
  ShieldCheck,
  Search,
  Check,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import {
  gerarHoleritePDF,
  salvarRegistroHolerite,
  verificarCodigoHolerite,
  ItemHolerite,
} from '@/lib/holeritePdfService'
import { tenantService, logAuditoriaService, colaboradorService } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LancamentoPeriodico, LancamentoPontual, Colaborador } from '@/types'
import { folhaService } from '@/services/folhaService'
import { formatMoedaPtBr } from '@/lib/exportReports'

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

export interface DemonstrativoFinanceiroViewProps {
  tenantId: string
  colaboradorId: string
  colaborador?: Colaborador | null
  canManage?: boolean // Se true (RH/Admin), exibe botões Editar/Remover e Novo Lançamento
  onNovoPeriodico?: () => void
  onEditarPeriodico?: (item: LancamentoPeriodico) => void
  onRemoverPeriodico?: (item: LancamentoPeriodico) => Promise<void>
  onNovoPontual?: () => void
  onEditarPontual?: (item: LancamentoPontual) => void
  onRemoverPontual?: (item: LancamentoPontual) => Promise<void>
  onReload?: () => void
  refreshTrigger?: number // número que muda para disparar reload
}

export function formatarDataBR(dataStr?: string | null): string {
  if (!dataStr) return '—'
  try {
    const d = new Date(dataStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  } catch {
    return '—'
  }
}

export const DemonstrativoFinanceiroView: React.FC<DemonstrativoFinanceiroViewProps> = ({
  tenantId,
  colaboradorId,
  colaborador,
  canManage = false,
  onNovoPeriodico,
  onEditarPeriodico,
  onRemoverPeriodico,
  onNovoPontual,
  onEditarPontual,
  onRemoverPontual,
  onReload,
  refreshTrigger = 0,
}) => {
  // Estado de seleção de competência (Mês / Ano)
  // Padrão: Setembro 2026 (ou data atual do sistema)
  const agora = new Date()
  const defaultAno = agora.getFullYear() < 2026 ? 2026 : agora.getFullYear()
  const defaultMes = agora.getFullYear() < 2026 ? 9 : agora.getMonth() + 1

  const [mesSelecionado, setMesSelecionado] = useState<number>(defaultMes)
  const [anoSelecionado, setAnoSelecionado] = useState<number>(defaultAno)

  const { user } = useAuth()
  const [loading, setLoading] = useState<boolean>(true)
  const [periodicos, setPeriodicos] = useState<LancamentoPeriodico[]>([])
  const [pontuais, setPontuais] = useState<LancamentoPontual[]>([])
  const [colaboradorCompleto, setColaboradorCompleto] = useState<Colaborador | null>(
    colaborador || null,
  )
  const [gerandoPdf, setGerandoPdf] = useState(false)

  // Verificador de código de autenticidade no RH
  const [codigoBusca, setCodigoBusca] = useState('')
  const [verificandoCodigo, setVerificandoCodigo] = useState(false)
  const [resultadoVerificacao, setResultadoVerificacao] = useState<{
    encontrado: boolean
    mensagem: string
    dados?: any
  } | null>(null)

  // Estado para exclusão com confirmação
  const [itemParaExcluir, setItemParaExcluir] = useState<{
    tipo: 'periodico' | 'pontual'
    item: LancamentoPeriodico | LancamentoPontual
  } | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const carregarDados = useCallback(async () => {
    if (!colaboradorId || !tenantId) return
    setLoading(true)
    try {
      const [listaPeriodicos, listaPontuais, colabDados] = await Promise.all([
        folhaService.getPeriodicosColaborador(tenantId, colaboradorId),
        folhaService.getPontuaisColaborador(tenantId, colaboradorId),
        colaborador ? Promise.resolve(colaborador) : colaboradorService.getColaboradorById(colaboradorId),
      ])
      setPeriodicos(listaPeriodicos)
      setPontuais(listaPontuais)
      if (colabDados) setColaboradorCompleto(colabDados)
    } catch (err) {
      console.error('Erro ao carregar lançamentos da folha:', err)
    } finally {
      setLoading(false)
    }
  }, [tenantId, colaboradorId, colaborador])

  useEffect(() => {
    carregarDados()
  }, [carregarDados, refreshTrigger])

  // Filtragem e regras de negócio:
  // Lançamentos periódicos: mostrar todos do colaborador, mas indicar visualmente se estão VIGENTES no mês selecionado
  // O resumo financeiro do mês computa estritamente os vigentes no mês
  const resumoFinanceiro = useMemo(() => {
    return folhaService.calcularResumoFinanceiro(
      periodicos,
      pontuais,
      anoSelecionado,
      mesSelecionado,
    )
  }, [periodicos, pontuais, anoSelecionado, mesSelecionado])

  // Lançamentos pontuais estritamente deste mês selecionado
  const pontuaisDoMes = useMemo(() => {
    return pontuais.filter((p) => folhaService.isPontualNoMes(p, anoSelecionado, mesSelecionado))
  }, [pontuais, anoSelecionado, mesSelecionado])

  // Lançamentos pontuais de outros meses (caso canManage queira ver todo o histórico)
  const pontuaisOutrosMeses = useMemo(() => {
    return pontuais.filter((p) => !folhaService.isPontualNoMes(p, anoSelecionado, mesSelecionado))
  }, [pontuais, anoSelecionado, mesSelecionado])

  const [mostrarTodosPontuais, setMostrarTodosPontuais] = useState(false)

  const handleBaixarHolerite = async () => {
    if (!colaboradorCompleto) {
      toast({
        title: 'Atenção',
        description: 'Dados do colaborador não encontrados para gerar o holerite.',
        variant: 'destructive',
      })
      return
    }

    setGerandoPdf(true)
    try {
      // 1. Obter dados da empresa (tenant)
      const tenantData = await tenantService.getTenant(tenantId).catch(() => null)

      // 2. Mapear Proventos e Descontos vigentes no mês
      const proventos: ItemHolerite[] = []
      const descontos: ItemHolerite[] = []

      // Periódicos vigentes
      periodicos.forEach((p) => {
        if (folhaService.isPeriodicoVigenteNoMes(p, anoSelecionado, mesSelecionado)) {
          if (p.quantidade >= 0) {
            proventos.push({
              descritivo: p.descritivo,
              tipo: 'provento',
              valor: p.quantidade,
              origem: 'periodico',
            })
          } else {
            descontos.push({
              descritivo: p.descritivo,
              tipo: 'desconto',
              valor: p.quantidade,
              origem: 'periodico',
            })
          }
        }
      })

      // Pontuais do mês
      pontuaisDoMes.forEach((item) => {
        if (item.quantidade >= 0) {
          proventos.push({
            descritivo: item.descritivo,
            tipo: 'provento',
            valor: item.quantidade,
            origem: 'pontual',
            origemAutomatica: item.origem_automatica,
            comentario: item.comentario,
          })
        } else {
          descontos.push({
            descritivo: item.descritivo,
            tipo: 'desconto',
            valor: item.quantidade,
            origem: 'pontual',
            origemAutomatica: item.origem_automatica,
            comentario: item.comentario,
          })
        }
      })

      const compStr = `${String(mesSelecionado).padStart(2, '0')}/${anoSelecionado}`
      const compAnoMes = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}`

      // 3. Gerar PDF
      const resultadoPdf = await gerarHoleritePDF({
        tenant: tenantData,
        colaborador: colaboradorCompleto,
        competenciaMes: mesSelecionado,
        competenciaAno: anoSelecionado,
        proventos,
        descontos,
        totalProventos: resumoFinanceiro.totalProventos,
        totalDescontos: resumoFinanceiro.totalDescontos,
        totalLiquido: resumoFinanceiro.valorLiquido,
      })

      // 4. Salvar registro na coleção holerite_registro
      try {
        await salvarRegistroHolerite({
          tenantId,
          colaboradorId: colaboradorCompleto.id,
          competencia: compAnoMes,
          totalProventos: resumoFinanceiro.totalProventos,
          totalDescontos: resumoFinanceiro.totalDescontos,
          totalLiquido: resumoFinanceiro.valorLiquido,
          codigoVerificacao: resultadoPdf.codigoVerificacao,
          dataEmissao: resultadoPdf.dataEmissao,
        })
      } catch (e) {
        console.warn('Registro em holerite_registro não persistido:', e)
      }

      // 5. Registrar log de auditoria
      if (user?.id) {
        try {
          await logAuditoriaService.registrarLog({
            tenant_id: tenantId,
            user_id: user.id,
            acao: 'EMISSAO_HOLERITE_PDF',
            entidade: 'holerite',
            entidade_id: colaboradorCompleto.id,
            dados_json: {
              colaborador: colaboradorCompleto.nome,
              competencia: compStr,
              codigo_verificacao: resultadoPdf.codigoVerificacao,
              total_liquido: resumoFinanceiro.valorLiquido,
            },
          })
        } catch {
          /* intentionally ignored */
        }
      }

      toast({
        title: 'Holerite gerado com sucesso',
        description: `Arquivo ${resultadoPdf.nomeArquivo} baixado com código de verificação ${resultadoPdf.codigoVerificacao}.`,
      })
    } catch (err: any) {
      console.error('Erro ao gerar holerite PDF:', err)
      toast({
        title: 'Erro ao gerar holerite',
        description: err?.message || 'Falha ao processar o documento PDF.',
        variant: 'destructive',
      })
    } finally {
      setGerandoPdf(false)
    }
  }

  const handleVerificarCodigo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!codigoBusca.trim()) return

    setVerificandoCodigo(true)
    setResultadoVerificacao(null)
    try {
      const registro = await verificarCodigoHolerite(codigoBusca.trim())
      if (registro) {
        setResultadoVerificacao({
          encontrado: true,
          mensagem: `Documento AUTÊNTICO! Emitido em ${new Date(registro.data_emissao).toLocaleDateString('pt-BR')} para competência ${registro.competencia}. Líquido: ${formatMoedaPtBr(registro.total_liquido)}.`,
          dados: registro,
        })
      } else {
        setResultadoVerificacao({
          encontrado: false,
          mensagem: 'Código NÃO localizado ou inválido no registro de holerites deste tenant.',
        })
      }
    } catch (err) {
      setResultadoVerificacao({
        encontrado: false,
        mensagem: 'Erro ao consultar autenticidade.',
      })
    } finally {
      setVerificandoCodigo(false)
    }
  }

  const handleConfirmarExclusao = async () => {
    if (!itemParaExcluir) return
    setExcluindo(true)
    try {
      if (itemParaExcluir.tipo === 'periodico' && onRemoverPeriodico) {
        await onRemoverPeriodico(itemParaExcluir.item as LancamentoPeriodico)
      } else if (itemParaExcluir.tipo === 'pontual' && onRemoverPontual) {
        await onRemoverPontual(itemParaExcluir.item as LancamentoPontual)
      }
      setItemParaExcluir(null)
      carregarDados()
      if (onReload) onReload()
    } catch (err) {
      console.error('Erro ao excluir lançamento:', err)
    } finally {
      setExcluindo(false)
    }
  }

  const anosOpcoes = [2024, 2025, 2026, 2027]

  return (
    <div className="space-y-6">
      {/* Barra de Topo: Seletor de Competência (Mês/Ano) + Status de Vigência */}
      <div className="bg-white p-4 rounded-xl border border-[#E0E0E0] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#212121]">
              Competência do Demonstrativo
              {colaborador && (
                <span className="text-[#0D47A1] font-normal ml-2">
                  — {colaborador.nome_completo || colaborador.nome}
                </span>
              )}
            </h3>
            <p className="text-xs text-[#757575]">
              Selecione o mês e ano para apuração de proventos, descontos e vigências
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          {/* Seletor de Mês */}
          <Select
            value={String(mesSelecionado)}
            onValueChange={(val) => setMesSelecionado(Number(val))}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs font-semibold bg-white border-[#E0E0E0] text-[#212121]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.valor} value={String(m.valor)} className="text-xs">
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Seletor de Ano */}
          <Select
            value={String(anoSelecionado)}
            onValueChange={(val) => setAnoSelecionado(Number(val))}
          >
            <SelectTrigger className="w-[100px] h-9 text-xs font-semibold bg-white border-[#E0E0E0] text-[#212121]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anosOpcoes.map((ano) => (
                <SelectItem key={ano} value={String(ano)} className="text-xs">
                  {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => carregarDados()}
            className="h-9 px-3 border-[#E0E0E0] text-[#757575] hover:text-[#0D47A1]"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Botão Baixar Holerite (PDF) */}
          <Button
            variant="default"
            size="sm"
            onClick={handleBaixarHolerite}
            disabled={gerandoPdf || loading}
            className="h-9 text-xs bg-[#0D47A1] hover:bg-[#0B3D91] text-white gap-1.5 shadow-sm font-semibold"
            title="Baixar holerite oficial da competência selecionada em PDF"
          >
            {gerandoPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {gerandoPdf ? 'Gerando...' : 'Baixar Holerite (PDF)'}
          </Button>
        </div>
      </div>

      {/* Resumo Financeiro no Topo com 3 Cards Coloridos:
          Verde para Proventos, Vermelho para Descontos, Azul para Líquido */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CARD 1: Total de Proventos (Verde) */}
          <Card className="border-2 border-emerald-200 bg-linear-to-br from-emerald-50/70 to-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Total de Proventos
              </span>
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-black text-emerald-700 tracking-tight">
                {formatMoedaPtBr(resumoFinanceiro.totalProventos)}
              </div>
              <p className="text-[11px] text-emerald-800/80 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3 w-3" />
                Soma de todos os créditos vigentes no mês
              </p>
            </CardContent>
          </Card>

          {/* CARD 2: Total de Descontos (Vermelho) */}
          <Card className="border-2 border-rose-200 bg-linear-to-br from-rose-50/70 to-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Total de Descontos
              </span>
              <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                <TrendingDown className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-black text-rose-700 tracking-tight">
                {formatMoedaPtBr(resumoFinanceiro.totalDescontos)}
              </div>
              <p className="text-[11px] text-rose-800/80 mt-1 flex items-center gap-1 font-medium">
                <XCircle className="h-3 w-3" />
                Deduções e coparticipações apuradas
              </p>
            </CardContent>
          </Card>

          {/* CARD 3: Valor Líquido (Azul Corporativo #0D47A1) */}
          <Card className="border-2 border-blue-200 bg-linear-to-br from-[#E8EEF7] to-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0D47A1]">
                Valor Líquido
              </span>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-[#0D47A1] flex items-center justify-center">
                <Wallet className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-black text-[#0D47A1] tracking-tight">
                {formatMoedaPtBr(resumoFinanceiro.valorLiquido)}
              </div>
              <p className="text-[11px] text-[#0D47A1]/80 mt-1 flex items-center gap-1 font-medium">
                <span>(Proventos − Descontos)</span>
                <span className="font-semibold text-slate-500">
                  • {MESES.find((m) => m.valor === mesSelecionado)?.nome}/{anoSelecionado}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SEÇÃO 1: Lançamentos Periódicos */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs">
        <CardHeader className="p-4 border-b border-[#F0F0F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#0D47A1]" />
              <CardTitle className="text-sm font-bold text-[#212121]">
                Lançamentos Periódicos
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-[#E8EEF7] text-[#0D47A1] border-blue-200 text-[11px] font-semibold"
              >
                {periodicos.length} cadastrados
              </Badge>
            </div>
            <CardDescription className="text-xs text-[#757575] mt-0.5">
              Itens recorrentes (salário base, adiantamentos, benefícios). Lançamentos fora da
              vigência não compõem o valor líquido do mês.
            </CardDescription>
          </div>

          {canManage && onNovoPeriodico && (
            <Button
              onClick={onNovoPeriodico}
              size="sm"
              className="bg-[#0D47A1] hover:bg-[#0B3D91] text-white text-xs h-8 gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Lançamento Periódico
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : periodicos.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#757575]">
              Nenhum lançamento periódico cadastrado para este colaborador.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA] border-b border-[#E0E0E0]">
                  <TableHead className="text-xs font-bold text-[#212121] py-3">
                    Descritivo
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3 text-right">
                    Quantidade (R$)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3">
                    Periodicidade
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3">
                    Data de Recorrência
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3">Vigência</TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3 text-center">
                    Status no Mês
                  </TableHead>
                  {canManage && (
                    <TableHead className="text-xs font-bold text-[#212121] py-3 text-right">
                      Ações
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodicos.map((p) => {
                  const isVigente = folhaService.isPeriodicoVigenteNoMes(
                    p,
                    anoSelecionado,
                    mesSelecionado,
                  )
                  const isDesconto = p.quantidade < 0

                  return (
                    <TableRow
                      key={p.id}
                      className={`text-xs border-b border-[#F0F0F0] transition-colors ${
                        !isVigente ? 'bg-slate-50/60 opacity-60' : 'hover:bg-blue-50/30'
                      }`}
                    >
                      <TableCell className="font-semibold text-[#212121] py-3">
                        <div className="flex items-center gap-1.5">
                          <span>{p.descritivo}</span>
                          {isDesconto ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1 bg-rose-50 text-rose-700 border-rose-200"
                            >
                              Desconto
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1 bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              Provento
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={`font-mono font-bold text-right py-3 ${
                          isDesconto ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {isDesconto
                          ? `- ${formatMoedaPtBr(Math.abs(p.quantidade))}`
                          : formatMoedaPtBr(p.quantidade)}
                      </TableCell>
                      <TableCell className="py-3 capitalize text-[#616161]">
                        {p.periodicidade}
                      </TableCell>
                      <TableCell className="py-3 text-[#616161]">
                        Dia <strong className="text-[#212121]">{p.data_recorrencia}</strong> do mês
                      </TableCell>
                      <TableCell className="py-3 text-[#616161] font-mono text-[11px]">
                        <span>{formatarDataBR(p.data_inicio_vigencia)}</span>
                        <span className="mx-1 text-slate-400">até</span>
                        <span>
                          {p.data_fim_vigencia
                            ? formatarDataBR(p.data_fim_vigencia)
                            : 'Indeterminado'}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        {isVigente ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold"
                          >
                            Computado
                          </Badge>
                        ) : (
                          <Tooltip delayDuration={150}>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="bg-slate-100 text-slate-600 border-slate-300 text-[10px] font-medium cursor-help"
                              >
                                Fora da Vigência
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#212121] text-white text-xs max-w-xs">
                              Este lançamento não é considerado no demonstrativo de{' '}
                              {MESES.find((m) => m.valor === mesSelecionado)?.nome}/{anoSelecionado}{' '}
                              porque sua vigência encerrou ou ainda não iniciou.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {onEditarPeriodico && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[#757575] hover:text-[#0D47A1] hover:bg-[#E8EEF7]"
                                onClick={() => onEditarPeriodico(p)}
                                title="Editar lançamento periódico"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {onRemoverPeriodico && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[#757575] hover:text-rose-600 hover:bg-rose-50"
                                onClick={() => setItemParaExcluir({ tipo: 'periodico', item: p })}
                                title="Remover lançamento periódico"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 2: Lançamentos Pontuais */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs">
        <CardHeader className="p-4 border-b border-[#F0F0F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#0D47A1]" />
              <CardTitle className="text-sm font-bold text-[#212121]">
                Lançamentos Pontuais
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-semibold"
              >
                {pontuaisDoMes.length} no mês selecionado
              </Badge>
              {pontuaisOutrosMeses.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMostrarTodosPontuais(!mostrarTodosPontuais)}
                  className="h-6 text-[11px] text-[#0D47A1] px-2"
                >
                  {mostrarTodosPontuais
                    ? 'Ver apenas do mês'
                    : `Ver outros meses (+${pontuaisOutrosMeses.length})`}
                </Button>
              )}
            </div>
            <CardDescription className="text-xs text-[#757575] mt-0.5">
              Eventos específicos do mês (horas noturnas, comissões, bonificações, faltas ou
              descontos pontuais).
            </CardDescription>
          </div>

          {canManage && onNovoPontual && (
            <Button
              onClick={onNovoPontual}
              size="sm"
              className="bg-[#0D47A1] hover:bg-[#0B3D91] text-white text-xs h-8 gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Lançamento Pontual
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (mostrarTodosPontuais ? pontuais : pontuaisDoMes).length === 0 ? (
            <div className="text-center py-8 text-xs text-[#757575]">
              Nenhum lançamento pontual registrado no mês de{' '}
              {MESES.find((m) => m.valor === mesSelecionado)?.nome}/{anoSelecionado}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA] border-b border-[#E0E0E0]">
                  <TableHead className="text-xs font-bold text-[#212121] py-3">
                    Descritivo
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3 text-right">
                    Quantidade (R$)
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3">Data</TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3">
                    Comentário
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#212121] py-3 text-center">
                    Competência
                  </TableHead>
                  {canManage && (
                    <TableHead className="text-xs font-bold text-[#212121] py-3 text-right">
                      Ações
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mostrarTodosPontuais ? pontuais : pontuaisDoMes).map((item) => {
                  const isDoMes = folhaService.isPontualNoMes(item, anoSelecionado, mesSelecionado)
                  const isDesconto = item.quantidade < 0

                  return (
                    <TableRow
                      key={item.id}
                      className={`text-xs border-b border-[#F0F0F0] transition-colors ${
                        !isDoMes ? 'bg-slate-50/70 opacity-70' : 'hover:bg-blue-50/30'
                      }`}
                    >
                      <TableCell className="font-semibold text-[#212121] py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{item.descritivo}</span>
                          {item.origem_automatica && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 bg-blue-50 text-[#0D47A1] border-blue-200 font-semibold"
                            >
                              Automático (férias)
                            </Badge>
                          )}
                          {isDesconto ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1 bg-rose-50 text-rose-700 border-rose-200"
                            >
                              Desconto
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1 bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              Provento
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={`font-mono font-bold text-right py-3 ${
                          isDesconto ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {isDesconto
                          ? `- ${formatMoedaPtBr(Math.abs(item.quantidade))}`
                          : formatMoedaPtBr(item.quantidade)}
                      </TableCell>
                      <TableCell className="py-3 font-mono text-[11px] text-[#616161]">
                        {formatarDataBR(item.data)}
                      </TableCell>
                      <TableCell className="py-3 text-[#616161] max-w-xs truncate">
                        {item.comentario || (
                          <span className="text-slate-400 italic">Sem comentário</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        {isDoMes ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold"
                          >
                            Neste Mês
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-slate-100 text-slate-600 border-slate-300 text-[10px]"
                          >
                            Outro Mês
                          </Badge>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {onEditarPontual && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[#757575] hover:text-[#0D47A1] hover:bg-[#E8EEF7]"
                                onClick={() => onEditarPontual(item)}
                                title="Editar lançamento pontual"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {onRemoverPontual && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[#757575] hover:text-rose-600 hover:bg-rose-50"
                                onClick={() => setItemParaExcluir({ tipo: 'pontual', item })}
                                title="Remover lançamento pontual"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Verificação de Autenticidade do Holerite (RH / Gestão) */}
      {canManage && (
        <Card className="border border-blue-200 bg-slate-50/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#0D47A1]" />
              <CardTitle className="text-xs font-bold text-[#0D47A1] uppercase tracking-wider">
                Verificação de Autenticidade de Holerite Eletrônico
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-[#616161]">
              Informe o código de verificação impresso no rodapé do holerite (ex:
              XXXX-XXXX-XXXX-XXXX) para conferir a autenticidade e integridade dos valores.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            <form
              onSubmit={handleVerificarCodigo}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <Input
                placeholder="Código de verificação (ex: A1B2-C3D4-E5F6-7890)"
                value={codigoBusca}
                onChange={(e) => setCodigoBusca(e.target.value)}
                className="h-9 text-xs bg-white uppercase font-mono max-w-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={verificandoCodigo || !codigoBusca.trim()}
                className="h-9 text-xs bg-[#0D47A1] hover:bg-[#0B3D91] text-white gap-1.5"
              >
                {verificandoCodigo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Verificar Código
              </Button>
            </form>

            {resultadoVerificacao && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  resultadoVerificacao.encontrado
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {resultadoVerificacao.encontrado ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{resultadoVerificacao.mensagem}</p>
                  {resultadoVerificacao.dados?.expand?.colaborador_id && (
                    <p className="text-[11px] mt-1 text-slate-700">
                      Colaborador:{' '}
                      <strong>
                        {resultadoVerificacao.dados.expand.colaborador_id.nome_completo ||
                          resultadoVerificacao.dados.expand.colaborador_id.nome}
                      </strong>{' '}
                      (CPF: {resultadoVerificacao.dados.expand.colaborador_id.cpf})
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Nota Informativa sobre regras de negócio e Fase 2 */}
      <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-xs text-[#0D47A1] flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold">
            Regras de Apuração do Demonstrativo & Assinatura Eletrônica
          </p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            • Lançamentos com valor positivo são computados como Proventos (créditos); lançamentos
            com valor negativo são computados como Descontos (débitos).
            <br />• O holerite gerado em PDF conta com assinatura eletrônica e hash de autenticidade
            único auditável pelo RH.
            <br />• Lançamentos de férias aprovadas são integrados e sinalizados como
            &quot;Automático (férias)&quot;.
          </p>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog
        open={Boolean(itemParaExcluir)}
        onOpenChange={(open) => !open && setItemParaExcluir(null)}
      >
        <AlertDialogContent className="bg-white max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="h-5 w-5" />
              <AlertDialogTitle className="text-base font-bold text-[#212121]">
                Remover Lançamento da Folha
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-[#757575] pt-2">
              Você tem certeza que deseja remover o lançamento{' '}
              <strong className="text-[#212121]">
                &quot;{itemParaExcluir?.item.descritivo}&quot;
              </strong>{' '}
              no valor de{' '}
              <strong className="text-[#212121]">
                {formatMoedaPtBr(Math.abs(itemParaExcluir?.item.quantidade || 0))}
              </strong>
              ? Esta ação será registrada no histórico de auditoria do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={excluindo}
              className="border-[#E0E0E0] text-xs h-9 text-[#616161]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(e) => {
                e.preventDefault()
                handleConfirmarExclusao()
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 font-semibold"
            >
              {excluindo ? 'Removendo...' : 'Sim, remover lançamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
