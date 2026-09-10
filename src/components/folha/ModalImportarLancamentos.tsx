import React, { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck,
  AlertCircle,
  HelpCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Colaborador, PeriodicidadeLancamento } from '@/types'
import { folhaService } from '@/services/folhaService'
import { formatMoedaPtBr } from '@/lib/exportReports'

export interface ModalImportarLancamentosProps {
  open: boolean
  onClose: () => void
  tenantId: string
  userId: string
  colaboradores: Colaborador[]
  onSuccess: () => void
}

interface LinhaProcessada {
  indice: number
  tipo_lancamento: 'periodico' | 'pontual'
  identificador: string
  descritivo: string
  quantidade: number
  periodicidade?: PeriodicidadeLancamento
  data_recorrencia?: number
  data_inicio_vigencia?: string
  data_fim_vigencia?: string | null
  data?: string
  comentario?: string
  // Dados validados
  colaboradorEncontrado?: Colaborador
  valido: boolean
  erros: string[]
}

export const ModalImportarLancamentos: React.FC<ModalImportarLancamentosProps> = ({
  open,
  onClose,
  tenantId,
  userId,
  colaboradores,
  onSuccess,
}) => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [arquivoNome, setArquivoNome] = useState<string>('')
  const [linhas, setLinhas] = useState<LinhaProcessada[]>([])
  const [processandoArquivo, setProcessandoArquivo] = useState(false)
  const [importando, setImportando] = useState(false)
  const [filtroApenasErros, setFiltroApenasErros] = useState(false)

  const limparEstado = () => {
    setArquivoNome('')
    setLinhas([])
    setProcessandoArquivo(false)
    setImportando(false)
    setFiltroApenasErros(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    limparEstado()
    onClose()
  }

  // 1. Download do modelo CSV / Excel
  const handleBaixarModelo = () => {
    const cabecalho = [
      'tipo_lancamento',
      'matricula_ou_email_do_colaborador',
      'descritivo',
      'quantidade',
      'periodicidade',
      'data_recorrencia',
      'data_inicio_vigencia',
      'data_fim_vigencia',
      'data',
      'comentario',
    ]

    const exemplo1 = [
      'periodico',
      colaboradores[0]?.email || colaboradores[0]?.cpf || 'lucas.ferreira@teslarh.com.br',
      'Salário Base Mensal',
      '5500.00',
      'mensal',
      '5',
      '2026-01-01',
      '',
      '',
      'Contrato CLT vigente',
    ]

    const exemplo2 = [
      'pontual',
      colaboradores[0]?.email || colaboradores[0]?.cpf || 'lucas.ferreira@teslarh.com.br',
      'Bônus Desempenho Trimestral',
      '1200.00',
      '',
      '',
      '',
      '',
      '2026-09-15',
      'Metas de sprint atingidas',
    ]

    const exemplo3 = [
      'pontual',
      colaboradores[1]?.email || colaboradores[1]?.cpf || 'roberto.almeida@teslarh.com.br',
      'Desconto Adiantamento Salarial',
      '-350.00',
      '',
      '',
      '',
      '',
      '2026-09-20',
      'Valores negativos representam descontos',
    ]

    const rows = [cabecalho, exemplo1, exemplo2, exemplo3]
    const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${c}"`).join(';')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', 'modelo_importacao_lancamentos_tesla.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Modelo baixado',
      description: 'Preencha a planilha e faça o upload para validação.',
    })
  }

  // 2. Parser do arquivo CSV/Excel
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setProcessandoArquivo(true)
    setArquivoNome(file.name)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      // Lê como matriz de strings
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

      if (rawRows.length < 2) {
        toast({
          title: 'Planilha vazia',
          description: 'O arquivo selecionado não contém linhas de dados para importar.',
          variant: 'destructive',
        })
        setLinhas([])
        setProcessandoArquivo(false)
        return
      }

      // Detectar cabeçalho
      const headers = rawRows[0].map((h: any) => String(h).trim().toLowerCase())
      const colMap: Record<string, number> = {}

      headers.forEach((h: string, idx: number) => {
        if (h.includes('tipo')) colMap['tipo'] = idx
        else if (
          h.includes('matricula') ||
          h.includes('email') ||
          h.includes('colaborador') ||
          h.includes('cpf')
        )
          colMap['identificador'] = idx
        else if (h.includes('descrit') || h.includes('descricao')) colMap['descritivo'] = idx
        else if (h.includes('quant') || h.includes('valor')) colMap['quantidade'] = idx
        else if (h.includes('period')) colMap['periodicidade'] = idx
        else if (h.includes('recorrencia') || h.includes('dia')) colMap['data_recorrencia'] = idx
        else if (h.includes('inicio')) colMap['data_inicio'] = idx
        else if (h.includes('fim')) colMap['data_fim'] = idx
        else if (h.includes('data')) colMap['data'] = idx
        else if (h.includes('coment') || h.includes('obs')) colMap['comentario'] = idx
      })

      // Se não mapeou por nome, tenta pela ordem padrão do modelo
      if (colMap['tipo'] === undefined) colMap['tipo'] = 0
      if (colMap['identificador'] === undefined) colMap['identificador'] = 1
      if (colMap['descritivo'] === undefined) colMap['descritivo'] = 2
      if (colMap['quantidade'] === undefined) colMap['quantidade'] = 3
      if (colMap['periodicidade'] === undefined) colMap['periodicidade'] = 4
      if (colMap['data_recorrencia'] === undefined) colMap['data_recorrencia'] = 5
      if (colMap['data_inicio'] === undefined) colMap['data_inicio'] = 6
      if (colMap['data_fim'] === undefined) colMap['data_fim'] = 7
      if (colMap['data'] === undefined) colMap['data'] = 8
      if (colMap['comentario'] === undefined) colMap['comentario'] = 9

      const processadas: LinhaProcessada[] = []

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i]
        // Se a linha inteira estiver vazia, ignora
        if (row.every((c: any) => c === '' || c === undefined || c === null)) continue

        const tipoRaw = String(row[colMap['tipo']] || '')
          .trim()
          .toLowerCase()
        const idRaw = String(row[colMap['identificador']] || '').trim()
        const descRaw = String(row[colMap['descritivo']] || '').trim()
        const qtdRaw = String(row[colMap['quantidade']] || '')
          .replace('R$', '')
          .replace(/\s/g, '')
          .replace(',', '.')
        const periodRaw = String(row[colMap['periodicidade']] || '')
          .trim()
          .toLowerCase()
        const recorrenciaRaw = String(row[colMap['data_recorrencia']] || '').trim()
        const inicioRaw = String(row[colMap['data_inicio']] || '').trim()
        const fimRaw = String(row[colMap['data_fim']] || '').trim()
        const dataRaw = String(row[colMap['data']] || '').trim()
        const comentRaw = String(row[colMap['comentario']] || '').trim()

        const erros: string[] = []

        // Validação de tipo
        let tipo: 'periodico' | 'pontual' = 'pontual'
        if (tipoRaw.includes('per') || tipoRaw === 'recorrente') {
          tipo = 'periodico'
        } else if (tipoRaw.includes('pont') || tipoRaw === 'avulso' || tipoRaw === 'unico') {
          tipo = 'pontual'
        } else if (tipoRaw) {
          erros.push(`Tipo de lançamento inválido ("${tipoRaw}"). Use "periodico" ou "pontual".`)
        } else {
          erros.push('Tipo de lançamento não informado.')
        }

        // Validação de colaborador
        let colab: Colaborador | undefined
        if (!idRaw) {
          erros.push('Identificador do colaborador não informado.')
        } else {
          const cleanId = idRaw.toLowerCase().replace(/[.\-/]/g, '')
          colab = colaboradores.find((c) => {
            const cpfClean = (c.cpf || '').replace(/[.\-/]/g, '')
            const rgClean = (c.rg || '').replace(/[.\-/]/g, '')
            const emailMatch = (c.email || '').toLowerCase() === idRaw.toLowerCase()
            const matriculaMatch = c.id.toLowerCase() === idRaw.toLowerCase()
            return cpfClean === cleanId || rgClean === cleanId || emailMatch || matriculaMatch
          })

          if (!colab) {
            // Tenta match por nome aproximado
            colab = colaboradores.find(
              (c) =>
                (c.nome_completo || c.nome).toLowerCase().includes(idRaw.toLowerCase()) ||
                idRaw.toLowerCase().includes((c.nome_completo || c.nome).toLowerCase()),
            )
          }

          if (!colab) {
            erros.push(`Colaborador não localizado no tenant ("${idRaw}").`)
          }
        }

        // Validação de descritivo
        if (!descRaw) {
          erros.push('Descritivo do lançamento é obrigatório.')
        }

        // Validação de quantidade (valor numérico positivo ou negativo)
        const qtdNum = parseFloat(qtdRaw)
        if (isNaN(qtdNum) || qtdNum === 0) {
          erros.push('Valor numérico inválido ou zerado.')
        }

        // Validações específicas por tipo
        let periodicidadeValida: PeriodicidadeLancamento = 'mensal'
        let recorrenciaValida = 5
        let inicioValido = ''
        let fimValido: string | null = null
        let dataPontualValida = ''

        if (tipo === 'periodico') {
          if (['mensal', 'quinzenal', 'semanal'].includes(periodRaw)) {
            periodicidadeValida = periodRaw as PeriodicidadeLancamento
          }
          const recNum = parseInt(recorrenciaRaw, 10)
          if (!isNaN(recNum) && recNum >= 1 && recNum <= 31) {
            recorrenciaValida = recNum
          }

          if (inicioRaw) {
            const dt = new Date(inicioRaw)
            if (isNaN(dt.getTime())) {
              erros.push('Data de início de vigência com formato inválido (use AAAA-MM-DD).')
            } else {
              inicioValido = dt.toISOString().slice(0, 10)
            }
          } else {
            inicioValido = new Date().toISOString().slice(0, 10)
          }

          if (fimRaw) {
            const dtFim = new Date(fimRaw)
            if (isNaN(dtFim.getTime())) {
              erros.push('Data de fim de vigência inválida.')
            } else {
              fimValido = dtFim.toISOString().slice(0, 10)
            }
          }
        } else {
          // Pontual
          if (dataRaw) {
            const dt = new Date(dataRaw)
            if (isNaN(dt.getTime())) {
              erros.push('Data do evento pontual com formato inválido (use AAAA-MM-DD).')
            } else {
              dataPontualValida = dt.toISOString().slice(0, 10)
            }
          } else {
            dataPontualValida = new Date().toISOString().slice(0, 10)
          }
        }

        processadas.push({
          indice: i + 1,
          tipo_lancamento: tipo,
          identificador: idRaw,
          descritivo: descRaw,
          quantidade: isNaN(qtdNum) ? 0 : qtdNum,
          periodicidade: periodicidadeValida,
          data_recorrencia: recorrenciaValida,
          data_inicio_vigencia: inicioValido,
          data_fim_vigencia: fimValido,
          data: dataPontualValida,
          comentario: comentRaw,
          colaboradorEncontrado: colab,
          valido: erros.length === 0,
          erros,
        })
      }

      setLinhas(processadas)
    } catch (err) {
      console.error('Erro ao ler arquivo de planilha:', err)
      toast({
        title: 'Erro na leitura do arquivo',
        description:
          'Não foi possível processar o arquivo. Verifique se o formato é CSV ou Excel válido.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoArquivo(false)
    }
  }

  // 3. Efetivar importação apenas das linhas válidas
  const handleConfirmarImportacao = async () => {
    const validas = linhas.filter((l) => l.valido && l.colaboradorEncontrado)
    if (validas.length === 0) {
      toast({
        title: 'Nenhuma linha válida',
        description: 'Corrija os erros apontados na pré-visualização antes de importar.',
        variant: 'destructive',
      })
      return
    }

    setImportando(true)
    try {
      const payloadItens = validas.map((l) => ({
        tipo_lancamento: l.tipo_lancamento,
        colaborador_id: l.colaboradorEncontrado!.id,
        colaborador_nome: l.colaboradorEncontrado!.nome_completo || l.colaboradorEncontrado!.nome,
        descritivo: l.descritivo,
        quantidade: l.quantidade,
        periodicidade: l.periodicidade,
        data_recorrencia: l.data_recorrencia,
        data_inicio_vigencia: l.data_inicio_vigencia,
        data_fim_vigencia: l.data_fim_vigencia,
        data: l.data,
        comentario: l.comentario || 'Importado via planilha',
      }))

      const resultado = await folhaService.importarLancamentosLote(tenantId, userId, payloadItens)

      const totalIgnoradas = linhas.length - resultado.importados

      toast({
        title: 'Importação concluída',
        description: `${resultado.importados} lançamentos importados com sucesso${
          totalIgnoradas > 0 ? `, ${totalIgnoradas} ignorados com erro.` : '.'
        }`,
      })

      onSuccess()
      handleClose()
    } catch (err) {
      console.error('Erro ao importar lote de lançamentos:', err)
      toast({
        title: 'Erro na importação',
        description: 'Ocorreu uma falha ao persistir os lançamentos no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setImportando(false)
    }
  }

  const totalValidas = linhas.filter((l) => l.valido).length
  const totalErros = linhas.filter((l) => !l.valido).length

  const linhasExibidas = filtroApenasErros ? linhas.filter((l) => !l.valido) : linhas

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 bg-white">
        {/* Cabeçalho */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 text-[#0D47A1]">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Importar Lançamentos de Folha via Planilha
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Carregue lançamentos periódicos ou pontuais para os colaboradores via arquivo CSV
                  ou Excel (.xlsx).
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBaixarModelo}
              className="gap-1.5 text-xs text-[#0D47A1] border-blue-200 hover:bg-blue-50"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar Modelo CSV
            </Button>
          </div>
        </DialogHeader>

        {/* Corpo com Scroll */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Caixa de Upload / Seleção de Arquivo */}
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center hover:bg-slate-50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
              id="planilha-upload"
            />
            <label
              htmlFor="planilha-upload"
              className="cursor-pointer flex flex-col items-center justify-center space-y-2"
            >
              <div className="h-12 w-12 rounded-full bg-blue-100/60 text-[#0D47A1] flex items-center justify-center">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {arquivoNome || 'Clique para selecionar um arquivo CSV ou Excel'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extensões aceitas: .csv, .xlsx, .xls • Regra: Valores positivos = proventos;
                  valores negativos = descontos.
                </p>
              </div>
            </label>
          </div>

          {/* Dicas de preenchimento */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#0D47A1]">
              <HelpCircle className="h-4 w-4" />
              <span>Instruções do layout e validações:</span>
            </div>
            <p className="leading-relaxed text-[11px] text-slate-600">
              • <strong>tipo_lancamento</strong>: &quot;periodico&quot; (salários, adicionais fixos)
              ou &quot;pontual&quot; (bônus, gratificações, faltas).
              <br />• <strong>matricula_ou_email_do_colaborador</strong>: CPF, e-mail institucional
              ou ID do colaborador no tenant.
              <br />• <strong>quantidade</strong>: número decimal (ex: 5500.00 para provento;
              -350.00 para desconto em folha).
            </p>
          </div>

          {/* Pré-visualização das Linhas Validadas */}
          {linhas.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Pré-visualização: {linhas.length} linha(s) processada(s)
                  </span>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold"
                  >
                    {totalValidas} válida(s)
                  </Badge>
                  {totalErros > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] font-bold"
                    >
                      {totalErros} com erro
                    </Badge>
                  )}
                </div>

                {totalErros > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiltroApenasErros(!filtroApenasErros)}
                    className="h-7 text-xs text-rose-700 hover:bg-rose-50"
                  >
                    {filtroApenasErros ? 'Mostrar todas as linhas' : 'Exibir apenas erros'}
                  </Button>
                )}
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-[11px]">
                      <TableHead className="w-12 text-center">Linha</TableHead>
                      <TableHead className="w-24">Tipo</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Descritivo</TableHead>
                      <TableHead className="text-right">Valor (R$)</TableHead>
                      <TableHead className="w-28 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhasExibidas.map((l) => (
                      <TableRow
                        key={l.indice}
                        className={
                          l.valido ? 'hover:bg-slate-50' : 'bg-rose-50/40 hover:bg-rose-50/60'
                        }
                      >
                        <TableCell className="text-center font-mono text-xs text-slate-500">
                          {l.indice}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              l.tipo_lancamento === 'periodico'
                                ? 'bg-blue-100 text-[#0D47A1]'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {l.tipo_lancamento}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.colaboradorEncontrado ? (
                            <div>
                              <p className="font-bold text-slate-800">
                                {l.colaboradorEncontrado.nome_completo ||
                                  l.colaboradorEncontrado.nome}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                CPF: {l.colaboradorEncontrado.cpf}
                              </p>
                            </div>
                          ) : (
                            <span className="text-rose-600 font-semibold">
                              {l.identificador || 'Não informado'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className="text-xs text-slate-700 max-w-xs truncate"
                          title={l.descritivo}
                        >
                          {l.descritivo || '—'}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-bold text-xs ${
                            l.quantidade < 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatMoedaPtBr(l.quantidade)}
                        </TableCell>
                        <TableCell className="text-center">
                          {l.valido ? (
                            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Válida
                            </div>
                          ) : (
                            <div
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600"
                              title={l.erros.join(' | ')}
                            >
                              <AlertCircle className="h-3.5 w-3.5" />
                              {l.erros[0]}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Ações */}
        <DialogFooter className="p-4 px-6 border-t border-slate-100 flex items-center justify-between sm:justify-between bg-slate-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={importando}
            className="text-xs"
          >
            Cancelar
          </Button>

          <div className="flex items-center gap-2">
            {totalErros > 0 && totalValidas > 0 && (
              <span className="text-[11px] text-amber-700 font-medium">
                Apenas as {totalValidas} linhas válidas serão importadas.
              </span>
            )}
            <Button
              size="sm"
              onClick={handleConfirmarImportacao}
              disabled={importando || processandoArquivo || totalValidas === 0}
              className="bg-[#0D47A1] hover:bg-[#0b3c8a] text-white text-xs font-semibold gap-1.5"
            >
              <FileCheck className="h-4 w-4" />
              {importando ? 'Importando Lançamentos...' : `Importar ${totalValidas} Lançamento(s)`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
