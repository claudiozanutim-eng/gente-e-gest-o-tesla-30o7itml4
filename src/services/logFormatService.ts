import {
  FileCheck2,
  FileUp,
  FileX,
  FileEdit,
  ShieldCheck,
  UserCheck,
  Award,
  Gift,
  Clock,
  Layers,
  LucideIcon,
} from 'lucide-react'
import { LogAuditoria } from '@/types'

export interface LogHumanizado {
  id: string
  acao: string
  descricao: string
  icone: LucideIcon
  corIcone: string
  bgIcone: string
  dataHora: string
  dataRelativa: string
  usuarioNome: string
  dados?: Record<string, unknown>
}

/**
 * Formata um timestamp ISO em string de tempo relativo amigável em português.
 * Ex.: "há alguns instantes", "há 5 minutos", "há 2 horas", "ontem", "há 3 dias".
 */
export function formatarTempoRelativo(dataIso?: string): string {
  if (!dataIso) return 'recentemente'
  try {
    const data = new Date(dataIso)
    if (isNaN(data.getTime())) return 'recentemente'

    const agora = Date.now()
    const diffMs = agora - data.getTime()

    if (diffMs < 0) return 'agora'

    const segundos = Math.floor(diffMs / 1000)
    if (segundos < 60) return 'há poucos segundos'

    const minutos = Math.floor(segundos / 60)
    if (minutos < 60) {
      return minutos === 1 ? 'há 1 minuto' : `há ${minutos} minutos`
    }

    const horas = Math.floor(minutos / 60)
    if (horas < 24) {
      return horas === 1 ? 'há 1 hora' : `há ${horas} horas`
    }

    const dias = Math.floor(horas / 24)
    if (dias === 1) return 'ontem'
    if (dias < 30) return `há ${dias} dias`

    const meses = Math.floor(dias / 30)
    if (meses === 1) return 'há 1 mês'
    if (meses < 12) return `há ${meses} meses`

    const anos = Math.floor(meses / 12)
    return anos === 1 ? 'há 1 ano' : `há ${anos} anos`
  } catch {
    return 'recentemente'
  }
}

/**
 * Converte um registro de log_auditoria em uma descrição humanizada em português.
 * Considera acao, entidade e dados_json gravados pelas funcionalidades do sistema.
 */
export function humanizarLogAuditoria(log: LogAuditoria): LogHumanizado {
  const dados = (log.dados_json || {}) as Record<string, unknown>
  const usuarioNome =
    (dados.usuario_nome as string) ||
    (dados.rh_nome as string) ||
    log.expand?.user_id?.name ||
    'Usuário'

  let descricao = 'Ação registrada no sistema'
  let icone: LucideIcon = Layers
  let corIcone = 'text-[#0D47A1]'
  let bgIcone = 'bg-[#E8EEF7]'

  switch (log.acao) {
    case 'ciencia_documento': {
      const docNome = (dados.nome_documento as string) || 'documento institucional'
      const versao = dados.versao_ciente ? ` v${dados.versao_ciente}` : ''
      descricao = `${usuarioNome} deu ciência no ${docNome}${versao}`
      icone = FileCheck2
      corIcone = 'text-[#2E7D32]'
      bgIcone = 'bg-[#E8F5E9]'
      break
    }

    case 'validacao_atestado': {
      const colabNome = (dados.colaborador_nome as string) || 'colaborador'
      const statusNovo = dados.status_novo as string
      if (statusNovo === 'validado') {
        descricao = `${usuarioNome} homologou o atestado de ${colabNome}`
        icone = ShieldCheck
        corIcone = 'text-[#2E7D32]'
        bgIcone = 'bg-[#E8F5E9]'
      } else if (statusNovo === 'em_analise') {
        descricao = `${usuarioNome} iniciou a análise do atestado de ${colabNome}`
        icone = Clock
        corIcone = 'text-[#1565C0]'
        bgIcone = 'bg-[#E3F2FD]'
      } else if (statusNovo === 'necessita_correcao') {
        descricao = `${usuarioNome} solicitou correção no atestado de ${colabNome}`
        icone = FileX
        corIcone = 'text-[#C62828]'
        bgIcone = 'bg-[#FFEBEE]'
      } else {
        descricao = `${usuarioNome} atualizou o status do atestado de ${colabNome}`
        icone = ShieldCheck
        corIcone = 'text-[#FB8C00]'
        bgIcone = 'bg-amber-50'
      }
      break
    }

    case 'upload_documento': {
      const docNome = (dados.nome as string) || 'documento'
      descricao = `${usuarioNome} publicou um novo documento: "${docNome}"`
      icone = FileUp
      corIcone = 'text-[#0D47A1]'
      bgIcone = 'bg-[#E8EEF7]'
      break
    }

    case 'atualizacao_versao_documento': {
      const docNome = (dados.nome as string) || 'documento'
      const versaoNova = dados.versao_nova ? ` v${dados.versao_nova}` : ''
      descricao = `${usuarioNome} publicou uma nova versão do documento "${docNome}"${versaoNova}`
      icone = FileEdit
      corIcone = 'text-[#6A1B9A]'
      bgIcone = 'bg-[#F3E5F5]'
      break
    }

    case 'edicao_documento': {
      const docNome = (dados.nome as string) || 'documento'
      descricao = `${usuarioNome} editou as informações do documento "${docNome}"`
      icone = FileEdit
      corIcone = 'text-[#546E7A]'
      bgIcone = 'bg-slate-100'
      break
    }

    case 'exclusao_documento': {
      const docNome = (dados.nome as string) || 'documento'
      descricao = `${usuarioNome} excluiu o documento "${docNome}"`
      icone = FileX
      corIcone = 'text-[#C62828]'
      bgIcone = 'bg-[#FFEBEE]'
      break
    }

    case 'vincular_colaborador_beneficio': {
      const colabNome = (dados.colaborador_nome as string) || 'colaborador'
      const benTipo = (dados.beneficio_tipo as string) || 'benefício'
      descricao = `${usuarioNome} vinculou o benefício ${benTipo.toUpperCase()} para ${colabNome}`
      icone = Gift
      corIcone = 'text-[#8E24AA]'
      bgIcone = 'bg-purple-50'
      break
    }

    case 'editar_colaborador_beneficio': {
      const colabNome = (dados.colaborador_nome as string) || 'colaborador'
      descricao = `${usuarioNome} atualizou os dados do benefício de ${colabNome}`
      icone = Gift
      corIcone = 'text-[#8E24AA]'
      bgIcone = 'bg-purple-50'
      break
    }

    case 'remover_colaborador_beneficio': {
      const colabNome = (dados.colaborador_nome as string) || 'colaborador'
      descricao = `${usuarioNome} removeu um benefício de ${colabNome}`
      icone = Gift
      corIcone = 'text-[#C62828]'
      bgIcone = 'bg-[#FFEBEE]'
      break
    }

    case 'criar_beneficio_tipo': {
      const benTipo = (dados.tipo as string) || 'benefício'
      descricao = `${usuarioNome} adicionou uma nova modalidade de benefício: ${benTipo.toUpperCase()}`
      icone = Award
      corIcone = 'text-[#0D47A1]'
      bgIcone = 'bg-[#E8EEF7]'
      break
    }

    case 'editar_beneficio_tipo': {
      const benTipo = (dados.tipo as string) || 'benefício'
      descricao = `${usuarioNome} atualizou as diretrizes do benefício ${benTipo.toUpperCase()}`
      icone = Award
      corIcone = 'text-[#0D47A1]'
      bgIcone = 'bg-[#E8EEF7]'
      break
    }

    case 'visualizacao_ficha': {
      const colabNome = (dados.colaborador_nome as string) || 'colaborador'
      descricao = `${usuarioNome} visualizou a ficha completa de ${colabNome}`
      icone = UserCheck
      corIcone = 'text-[#00897B]'
      bgIcone = 'bg-[#E0F2F1]'
      break
    }

    default: {
      const acaoFormatada = log.acao.replace(/_/g, ' ')
      descricao = `${usuarioNome} realizou a ação "${acaoFormatada}" em ${log.entidade}`
      icone = Layers
      corIcone = 'text-[#0D47A1]'
      bgIcone = 'bg-[#E8EEF7]'
      break
    }
  }

  const dataHora = log.data_hora || log.created || new Date().toISOString()
  const dataRelativa = formatarTempoRelativo(dataHora)

  return {
    id: log.id,
    acao: log.acao,
    descricao,
    icone,
    corIcone,
    bgIcone,
    dataHora,
    dataRelativa,
    usuarioNome,
    dados,
  }
}
