import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ColumnDefinition<T = any> {
  header: string
  key: string
  width?: number
  format?: 'text' | 'date' | 'currency' | 'percent' | 'number'
  formatter?: (value: any, row: T) => string | number
}

export interface ExportReportOptions<T = any> {
  reportTitle: string // Nome amigável do relatório (ex: 'Admissões', 'Desligamentos')
  filePrefix: string // Prefixo do arquivo (ex: 'Admissoes', 'Desligamentos')
  startDate?: string // 'AAAA-MM-DD' ou 'dd/mm/aaaa'
  endDate?: string // 'AAAA-MM-DD' ou 'dd/mm/aaaa'
  columns: ColumnDefinition<T>[]
  data: T[]
  tenantName?: string
  generatedBy?: string
}

/**
 * Converte data ISO ou string YYYY-MM-DD para DD/MM/AAAA
 */
export function formatDataPtBr(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const raw = String(dateStr).split('T')[0]
    const parts = raw.split('-')
    if (parts.length === 3) {
      const [year, month, day] = parts
      if (year.length === 4) {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
      }
    }
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  } catch {
    return String(dateStr)
  }
}

/**
 * Converte data para formato usado no nome de arquivo: DD-MM-AAAA
 */
export function formatDataParaArquivo(
  dateStr?: string | null,
  fallback: string = '01-01-2026',
): string {
  if (!dateStr) return fallback
  const ptBr = formatDataPtBr(dateStr)
  if (ptBr && ptBr.includes('/')) {
    return ptBr.replace(/\//g, '-')
  }
  return dateStr.replace(/[/.]/g, '-')
}

/**
 * Formata valor monetário como R$ X.XXX,XX
 */
export function formatMoedaPtBr(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return 'R$ 0,00'
  const num = typeof val === 'number' ? val : Number(val)
  if (isNaN(num)) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Formata percentual como XX,X%
 */
export function formatPercentualPtBr(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0,0%'
  const num = typeof val === 'number' ? val : Number(val)
  if (isNaN(num)) return '0,0%'
  return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/**
 * Gera nome de arquivo padronizado: '[Nome do Relatório][data_inicial][data_final].ext'
 * Exemplo: 'Admissoes_01-01-2026_31-08-2026.xlsx'
 */
export function buildFilename(
  prefix: string,
  startDate?: string,
  endDate?: string,
  ext: 'xlsx' | 'pdf' = 'xlsx',
): string {
  const dtInicio = formatDataParaArquivo(startDate, '01-01-2026')
  const dtFim = formatDataParaArquivo(endDate, '31-12-2026')
  const cleanPrefix = prefix
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
  return `${cleanPrefix}_${dtInicio}_${dtFim}.${ext}`
}

/**
 * Formata o valor de uma célula para exportação de acordo com o tipo
 */
export function formatCellValue<T>(col: ColumnDefinition<T>, row: T): any {
  const rawValue = (row as any)[col.key]
  if (col.formatter) {
    return col.formatter(rawValue, row)
  }
  if (rawValue === null || rawValue === undefined) return '-'

  switch (col.format) {
    case 'date':
      return formatDataPtBr(rawValue)
    case 'currency':
      return formatMoedaPtBr(rawValue)
    case 'percent':
      return formatPercentualPtBr(rawValue)
    case 'number': {
      const num = Number(rawValue)
      return isNaN(num) ? rawValue : num.toLocaleString('pt-BR')
    }
    case 'text':
    default:
      return String(rawValue)
  }
}

/**
 * Exporta para arquivo Excel (.xlsx) com:
 * - Cabeçalho formatado com estilo corporativo
 * - Fundo azul claro #E3F2FD e texto em negrito
 * - Dados formatados (dd/mm/aaaa, R$ X.XXX,XX, XX,X%)
 * - Largura automática das colunas
 * - Download automático no navegador
 */
export async function exportToExcel<T = any>(options: ExportReportOptions<T>): Promise<string> {
  const { reportTitle, filePrefix, startDate, endDate, columns, data } = options
  const filename = buildFilename(filePrefix, startDate, endDate, 'xlsx')

  // Prepara as linhas de dados
  const headerRow = columns.map((c) => c.header)
  const rows = data.map((item) => {
    return columns.map((col) => formatCellValue(col, item))
  })

  // Constrói a planilha com SheetJS
  const wsData = [headerRow, ...rows]
  const worksheet = XLSX.utils.aoa_to_sheet(wsData)

  // Calcula largura automática das colunas
  const colWidths = columns.map((col, colIdx) => {
    let maxLen = col.header.length
    rows.forEach((r) => {
      const cellVal = String(r[colIdx] ?? '')
      if (cellVal.length > maxLen) {
        maxLen = cellVal.length
      }
    })
    return { wch: Math.min(Math.max(maxLen + 4, col.width || 12), 50) }
  })
  worksheet['!cols'] = colWidths

  // Aplica estilos de células onde suportado por engines SheetJS
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const headerAddress = XLSX.utils.encode_cell({ r: 0, c: C })
    if (worksheet[headerAddress]) {
      worksheet[headerAddress].s = {
        font: { bold: true, color: { rgb: '0D47A1' } },
        fill: { fgColor: { rgb: 'E3F2FD' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          bottom: { style: 'thin', color: { rgb: 'BBDEFB' } },
        },
      }
    }
  }

  // Cria o workbook e adiciona a aba
  const workbook = XLSX.utils.book_new()
  const sheetName = reportTitle.slice(0, 31).replace(/[:\\/?*[\]]/g, '')
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Relatório')

  // Grava e dispara o download automático
  XLSX.writeFile(workbook, filename)

  return filename
}

/**
 * Exporta para arquivo PDF (.pdf) usando jsPDF + jspdf-autotable com:
 * - Cabeçalho do PDF:
 *    * Logotipo 'Gente e Gestão Tesla' (texto estilizado corporativo #0D47A1)
 *    * Título do relatório
 *    * Período selecionado
 *    * Data de geração
 * - Tabela formatada com zebra stripes (linhas alternadas cinza claro #F8F9FA)
 * - Cabeçalhos na cor corporativa (#0D47A1) com texto branco
 * - Rodapé: 'Gerado por Gente e Gestão Tesla em [data/hora]' e número de página ('Página X de Y')
 * - Nome do arquivo: '[Nome do Relatório][data_inicial][data_final].pdf'
 * - Download automático no navegador
 */
export async function exportToPdf<T = any>(options: ExportReportOptions<T>): Promise<string> {
  const { reportTitle, filePrefix, startDate, endDate, columns, data } = options
  const filename = buildFilename(filePrefix, startDate, endDate, 'pdf')

  // Orientação paisagem se tiver mais de 5 colunas para melhor visualização
  const isLandscape = columns.length > 5
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Formatação de data/hora atual
  const agora = new Date()
  const dataHoraGeracao = agora.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const dtInicioFormatada = formatDataPtBr(startDate)
  const dtFimFormatada = formatDataPtBr(endDate)
  const periodoStr =
    startDate && endDate
      ? `Período: ${dtInicioFormatada} a ${dtFimFormatada}`
      : startDate
        ? `A partir de: ${dtInicioFormatada}`
        : 'Período: Todo o histórico'

  // Prepara cabeçalhos e linhas para o autotable
  const tableHeaders = [columns.map((c) => c.header)]
  const tableBody = data.map((item) => {
    return columns.map((col) => formatCellValue(col, item))
  })

  // Executa o autoTable com cabeçalho de página e rodapé configurados
  autoTable(doc, {
    head: tableHeaders,
    body: tableBody,
    startY: 42,
    margin: { top: 42, bottom: 20, left: 14, right: 14 },
    theme: 'striped',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [33, 33, 33],
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [13, 71, 161], // #0D47A1 Azul corporativo
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250], // Cinza bem claro para zebra striping
    },
    didDrawPage: (hookData) => {
      // 1. Cabeçalho Corporativo no topo de cada página
      doc.saveGraphicsState?.()

      // Barra superior decorativa
      doc.setFillColor(13, 71, 161)
      doc.rect(14, 10, pageWidth - 28, 1.5, 'F')

      // Logotipo estilizado "Gente e Gestão Tesla"
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(13, 71, 161)
      doc.text('GENTE E GESTÃO TESLA', 14, 18)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(117, 117, 117)
      doc.text('Plataforma RH Multi-tenant', 14, 22)

      // Data de geração à direita do topo
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(117, 117, 117)
      doc.text(`Gerado em: ${dataHoraGeracao}`, pageWidth - 14, 18, { align: 'right' })

      // Título do relatório
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(33, 33, 33)
      doc.text(`Relatório: ${reportTitle}`, 14, 31)

      // Período e total de registros
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(97, 97, 97)
      const subInfo = `${periodoStr}  •  Total de Registros: ${data.length}`
      doc.text(subInfo, 14, 36)

      // Linha separadora antes da tabela
      doc.setDrawColor(224, 224, 224)
      doc.setLineWidth(0.5)
      doc.line(14, 39, pageWidth - 14, 39)

      // 2. Rodapé com numeração de página
      const footerY = pageHeight - 10
      doc.setDrawColor(224, 224, 224)
      doc.line(14, footerY - 3, pageWidth - 14, footerY - 3)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(117, 117, 117)
      doc.text(`Gerado por Gente e Gestão Tesla em ${dataHoraGeracao}`, 14, footerY + 2)

      const pageNumber = (doc as any).internal.getCurrentPageInfo
        ? (doc as any).internal.getCurrentPageInfo().pageNumber
        : hookData.pageNumber
      doc.text(`Página ${pageNumber}`, pageWidth - 14, footerY + 2, { align: 'right' })

      doc.restoreGraphicsState?.()
    },
  })

  // Dispara o download automático do arquivo no navegador
  doc.save(filename)

  return filename
}
