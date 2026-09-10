import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Colaborador, Tenant, HoleriteRegistro } from '@/types'
import { formatDataPtBr, formatMoedaPtBr } from './exportReports'
import { pb } from './pocketbase/client'

export interface ItemHolerite {
  descritivo: string
  tipo: 'provento' | 'desconto'
  valor: number
  origem: 'periodico' | 'pontual'
  origemAutomatica?: boolean
  comentario?: string
}

export interface DadosHoleritePDF {
  tenant: Tenant | null
  colaborador: Colaborador
  competenciaMes: number // 1 a 12
  competenciaAno: number
  proventos: ItemHolerite[]
  descontos: ItemHolerite[]
  totalProventos: number
  totalDescontos: number
  totalLiquido: number
  codigoVerificacao?: string
  dataEmissao?: Date
}

/**
 * Gera um hash SHA-256 das informações críticas do holerite
 * Formato exibido: 16 caracteres hexadecimais em maiúsculo (4 blocos de 4)
 */
export async function gerarHashVerificacao(dados: {
  tenantId: string
  colaboradorId: string
  competencia: string
  totalProventos: number
  totalDescontos: number
  totalLiquido: number
  timestampIso: string
}): Promise<string> {
  const payload = [
    dados.tenantId,
    dados.colaboradorId,
    dados.competencia,
    dados.totalProventos.toFixed(2),
    dados.totalDescontos.toFixed(2),
    dados.totalLiquido.toFixed(2),
    dados.timestampIso,
  ].join('|')

  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(payload)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const fullHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    // 16 caracteres formatados: XXXX-XXXX-XXXX-XXXX
    const trunc = fullHex.substring(0, 16)
    return `${trunc.slice(0, 4)}-${trunc.slice(4, 8)}-${trunc.slice(8, 12)}-${trunc.slice(12, 16)}`
  } catch {
    // Fallback caso crypto.subtle não esteja disponível
    const pseudo =
      Math.random().toString(36).substring(2, 10).toUpperCase() +
      Date.now().toString(36).substring(2, 10).toUpperCase()
    const clean = pseudo.padEnd(16, '0').slice(0, 16)
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}`
  }
}

/**
 * Registra a emissão do holerite no backend Skip Cloud (coleção holerite_registro)
 */
export async function salvarRegistroHolerite(dados: {
  tenantId: string
  colaboradorId: string
  competencia: string
  totalProventos: number
  totalDescontos: number
  totalLiquido: number
  codigoVerificacao: string
  dataEmissao: Date
}): Promise<HoleriteRegistro> {
  const registro = await pb.collection('holerite_registro').create<HoleriteRegistro>({
    tenant_id: dados.tenantId,
    colaborador_id: dados.colaboradorId,
    competencia: dados.competencia,
    total_proventos: Math.round(dados.totalProventos * 100) / 100,
    total_descontos: Math.round(dados.totalDescontos * 100) / 100,
    total_liquido: Math.round(dados.totalLiquido * 100) / 100,
    codigo_verificacao: dados.codigoVerificacao,
    data_emissao: dados.dataEmissao.toISOString(),
  })
  return registro
}

/**
 * Consulta registro de holerite por código de verificação
 */
export async function verificarCodigoHolerite(codigo: string): Promise<HoleriteRegistro | null> {
  const codigoLimpo = codigo.trim().toUpperCase()
  try {
    const record = await pb
      .collection('holerite_registro')
      .getFirstListItem<HoleriteRegistro>(`codigo_verificacao = '${codigoLimpo}'`, {
        expand: 'colaborador_id,tenant_id',
      })
    return record
  } catch {
    return null
  }
}

/**
 * Gera o documento PDF do holerite com layout corporativo Gente e Gestão Tesla
 * jsPDF + jspdf-autotable
 */
export async function gerarHoleritePDF(dados: DadosHoleritePDF): Promise<{
  codigoVerificacao: string
  dataEmissao: Date
  nomeArquivo: string
}> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const dataEmissao = dados.dataEmissao || new Date()
  const compStr = `${String(dados.competenciaMes).padStart(2, '0')}/${dados.competenciaAno}`

  // Gerar código de verificação caso não tenha vindo pronto
  const codigoVerificacao =
    dados.codigoVerificacao ||
    (await gerarHashVerificacao({
      tenantId: dados.tenant?.id || dados.colaborador.tenant_id,
      colaboradorId: dados.colaborador.id,
      competencia: compStr,
      totalProventos: dados.totalProventos,
      totalDescontos: dados.totalDescontos,
      totalLiquido: dados.totalLiquido,
      timestampIso: dataEmissao.toISOString(),
    }))

  // 1. Cabeçalho Corporativo (#0D47A1)
  doc.setFillColor(13, 71, 161)
  doc.rect(margin, 12, pageWidth - margin * 2, 24, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('GENTE E GESTÃO TESLA', margin + 6, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const razaoSocial = dados.tenant?.razao_social || 'Tesla Tecnologia e Serviços S.A.'
  const cnpj = dados.tenant?.cnpj ? `CNPJ: ${dados.tenant.cnpj}` : 'CNPJ: 12.345.678/0001-90'
  doc.text(`${razaoSocial}  |  ${cnpj}`, margin + 6, 26)
  doc.text('Sistema Integrado de Gestão de Pessoas & Departamento Pessoal', margin + 6, 31)

  // Caixa da Competência no lado direito do cabeçalho
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('DEMONSTRATIVO DE PAGAMENTO', pageWidth - margin - 6, 20, { align: 'right' })
  doc.setFontSize(10)
  doc.text(`COMPETÊNCIA: ${compStr}`, pageWidth - margin - 6, 27, { align: 'right' })

  // 2. Quadro Dados do Colaborador
  const boxTop = 40
  const boxHeight = 24
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.rect(margin, boxTop, pageWidth - margin * 2, boxHeight, 'FD')

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)

  // Linha 1 do quadro
  const nomeExibicao = dados.colaborador.nome_completo || dados.colaborador.nome
  doc.text('Colaborador:', margin + 4, boxTop + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(nomeExibicao, margin + 26, boxTop + 6)

  doc.setFont('helvetica', 'bold')
  doc.text('CPF:', margin + 115, boxTop + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.colaborador.cpf || '—', margin + 125, boxTop + 6)

  // Linha 2 do quadro
  doc.setFont('helvetica', 'bold')
  doc.text('Cargo:', margin + 4, boxTop + 13)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.colaborador.cargo || 'Não informado', margin + 26, boxTop + 13)

  doc.setFont('helvetica', 'bold')
  doc.text('Departamento:', margin + 115, boxTop + 13)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.colaborador.departamento || 'Geral', margin + 138, boxTop + 13)

  // Linha 3 do quadro
  doc.setFont('helvetica', 'bold')
  doc.text('Admissão:', margin + 4, boxTop + 20)
  doc.setFont('helvetica', 'normal')
  const dataAdm = dados.colaborador.data_admissao
    ? formatDataPtBr(dados.colaborador.data_admissao)
    : '—'
  doc.text(dataAdm, margin + 26, boxTop + 20)

  doc.setFont('helvetica', 'bold')
  doc.text('Emissão:', margin + 115, boxTop + 20)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${formatDataPtBr(dataEmissao.toISOString())} às ${dataEmissao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    margin + 130,
    boxTop + 20,
  )
  // 3. Montar Tabela com Proventos e Descontos lado a lado ou unificada
  // Tabela no estilo clássico de holerite com Colunas: Código / Descrição / Tipo / Proventos (R$) / Descontos (R$)
  const bodyRows: Array<[string, string, string, string, string]> = []

  let seq = 1
  dados.proventos.forEach((item) => {
    const tag = item.origemAutomatica ? ' [Automático (férias)]' : ''
    bodyRows.push([
      String(seq++).padStart(3, '0'),
      `${item.descritivo}${tag}`,
      'Provento',
      formatMoedaPtBr(item.valor),
      '—',
    ])
  })

  dados.descontos.forEach((item) => {
    bodyRows.push([
      String(seq++).padStart(3, '0'),
      item.descritivo,
      'Desconto',
      '—',
      formatMoedaPtBr(Math.abs(item.valor)),
    ])
  })

  if (bodyRows.length === 0) {
    bodyRows.push([
      '—',
      'Nenhum lançamento registrado nesta competência',
      '—',
      'R$ 0,00',
      'R$ 0,00',
    ])
  }

  autoTable(doc, {
    startY: boxTop + boxHeight + 6,
    head: [['Código', 'Descrição da Rubrica', 'Tipo', 'Proventos (R$)', 'Descontos (R$)']],
    body: bodyRows,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [13, 71, 161],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  })

  // 4. Bloco de Totais
  // Posição final da tabela
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  const totalsBoxHeight = 26
  doc.setFillColor(241, 245, 249)
  doc.setDrawColor(203, 213, 225)
  doc.rect(margin, finalY, pageWidth - margin * 2, totalsBoxHeight, 'FD')

  const colWidth = (pageWidth - margin * 2) / 3

  // Total Proventos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('TOTAL DE PROVENTOS', margin + 8, finalY + 8)
  doc.setFontSize(11)
  doc.setTextColor(46, 125, 50) // Verde
  doc.text(formatMoedaPtBr(dados.totalProventos), margin + 8, finalY + 18)

  // Total Descontos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('TOTAL DE DESCONTOS', margin + colWidth + 8, finalY + 8)
  doc.setFontSize(11)
  doc.setTextColor(198, 40, 40) // Vermelho
  doc.text(formatMoedaPtBr(dados.totalDescontos), margin + colWidth + 8, finalY + 18)

  // Valor Líquido (Destaque Tesla Azul)
  doc.setFillColor(13, 71, 161)
  doc.rect(margin + colWidth * 2, finalY, colWidth, totalsBoxHeight, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('VALOR LÍQUIDO A RECEBER', margin + colWidth * 2 + 8, finalY + 8)
  doc.setFontSize(13)
  doc.text(formatMoedaPtBr(dados.totalLiquido), margin + colWidth * 2 + 8, finalY + 19)

  // 5. Caixa de Assinatura Eletrônica e Autenticidade
  const signTop = finalY + totalsBoxHeight + 8
  const signHeight = 26
  doc.setFillColor(254, 252, 232) // Amarelo suave / dourado de autenticidade
  doc.setDrawColor(234, 179, 8)
  doc.rect(margin, signTop, pageWidth - margin * 2, signHeight, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(113, 63, 18)
  doc.text('ASSINATURA ELETRÔNICA E AUTENTICIDADE DO DOCUMENTO', margin + 6, signTop + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(68, 64, 60)
  doc.text(
    'Documento assinado eletronicamente — verifique a autenticidade com o RH informando o código abaixo.',
    margin + 6,
    signTop + 13,
  )

  doc.setFont('courier', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 71, 161)
  doc.text(`CÓDIGO DE VERIFICAÇÃO: ${codigoVerificacao}`, margin + 6, signTop + 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Emitido eletronicamente em ${formatDataPtBr(dataEmissao.toISOString())} às ${dataEmissao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
    pageWidth - margin - 6,
    signTop + 20,
    { align: 'right' },
  )

  // 6. Rodapé da Página
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  const rodapeTexto = `Gerado por Gente e Gestão Tesla em ${formatDataPtBr(dataEmissao.toISOString())} às ${dataEmissao.toLocaleTimeString('pt-BR')} — Página 1 de 1`
  doc.text(rodapeTexto, pageWidth / 2, pageHeight - 8, { align: 'center' })
  // Salvar / Baixar
  const nomeColabSanitizado = (dados.colaborador.nome || 'Colaborador')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
  const nomeArquivo = `Holerite_${nomeColabSanitizado}_${String(dados.competenciaMes).padStart(2, '0')}-${dados.competenciaAno}.pdf`

  doc.save(nomeArquivo)

  return {
    codigoVerificacao,
    dataEmissao,
    nomeArquivo,
  }
}
