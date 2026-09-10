import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileText,
  UserPlus,
  UserMinus,
  TrendingDown,
  CalendarDays,
  Palmtree,
  Stethoscope,
  Clock,
  ShieldCheck,
  FileWarning,
  RefreshCw,
  Search,
  Filter,
  Info,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  colaboradorService,
  documentoService,
  cienciaDocumentoService,
  atestadoService,
} from '@/services/api'
import { feriasService } from '@/services/feriasService'
import { Colaborador, Documento, CienciaDocumento, Atestado } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportExportActions } from '@/components/relatorios/ReportExportActions'
import { ColumnDefinition, formatDataPtBr } from '@/lib/exportReports'

export type RelatorioTab =
  | 'admissoes'
  | 'desligamentos'
  | 'turnover'
  | 'absenteismo'
  | 'ferias'
  | 'atestados'
  | 'ciencias'
  | 'documentos'
  | 'horas_extras'

export default function RelatoriosPage() {
  const { user } = useAuth()
  const tenantId = user?.tenant_id

  // Tab ativa
  const [activeTab, setActiveTab] = useState<RelatorioTab>('admissoes')

  // Filtros de período (Ano corrente por padrão)
  const currentYear = new Date().getFullYear()
  const [dataInicio, setDataInicio] = useState<string>(`${currentYear}-01-01`)
  const [dataFim, setDataFim] = useState<string>(`${currentYear}-12-31`)
  const [filtroDepto, setFiltroDepto] = useState<string>('todos')
  const [busca, setBusca] = useState<string>('')

  // Dados do tenant
  const [loading, setLoading] = useState(true)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [ciencias, setCiencias] = useState<CienciaDocumento[]>([])
  const [atestados, setAtestados] = useState<Atestado[]>([])

  const carregarDados = useCallback(async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const [colabs, docs, cienciasList, atestadosList] = await Promise.all([
        colaboradorService.getColaboradores(tenantId),
        documentoService.getDocumentos(tenantId),
        cienciaDocumentoService.getCienciasTenant(tenantId),
        atestadoService.getAtestadosTenant(tenantId),
      ])

      setColaboradores(colabs)
      setDocumentos(docs)
      setCiencias(cienciasList)
      setAtestados(atestadosList)
    } catch (err) {
      console.error('Erro ao carregar dados para relatórios:', err)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Lista única de departamentos
  const departamentos = useMemo(() => {
    const set = new Set<string>()
    colaboradores.forEach((c) => {
      if (c.departamento) set.add(c.departamento)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [colaboradores])

  // Helpers de verificação de período
  const dtInicioDate = useMemo(
    () => (dataInicio ? new Date(`${dataInicio}T00:00:00Z`) : null),
    [dataInicio],
  )
  const dtFimDate = useMemo(() => (dataFim ? new Date(`${dataFim}T23:59:59Z`) : null), [dataFim])

  const isInPeriod = useCallback(
    (dateStr?: string | null) => {
      if (!dateStr) return false
      try {
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return false
        if (dtInicioDate && d < dtInicioDate) return false
        if (dtFimDate && d > dtFimDate) return false
        return true
      } catch {
        return false
      }
    },
    [dtInicioDate, dtFimDate],
  )

  // -------------------------------------------------------------
  // 1. RELATÓRIO: Admissões
  // -------------------------------------------------------------
  const dadosAdmissoes = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return colaboradores
      .filter((c) => {
        if (!isInPeriod(c.data_admissao)) return false
        if (filtroDepto !== 'todos' && c.departamento !== filtroDepto) return false
        if (termo) {
          const matchNome = (c.nome || '').toLowerCase().includes(termo)
          const matchCargo = (c.cargo || '').toLowerCase().includes(termo)
          const matchCpf = (c.cpf || '').includes(termo)
          return matchNome || matchCargo || matchCpf
        }
        return true
      })
      .sort((a, b) => new Date(b.data_admissao).getTime() - new Date(a.data_admissao).getTime())
  }, [colaboradores, isInPeriod, filtroDepto, busca])

  const colunasAdmissoes: ColumnDefinition<Colaborador>[] = [
    { header: 'Nome do Colaborador', key: 'nome', width: 25 },
    { header: 'CPF', key: 'cpf', width: 16 },
    { header: 'Cargo', key: 'cargo', width: 22 },
    { header: 'Departamento', key: 'departamento', width: 20 },
    { header: 'Data de Admissão', key: 'data_admissao', format: 'date', width: 16 },
    { header: 'Jornada', key: 'jornada', width: 20, formatter: (val) => val || 'Integral' },
    {
      header: 'Status',
      key: 'status',
      width: 14,
      formatter: (val) => (val === 'ativo' ? 'Ativo' : 'Inativo'),
    },
  ]

  // -------------------------------------------------------------
  // 2. RELATÓRIO: Desligamentos
  // -------------------------------------------------------------
  const dadosDesligamentos = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return colaboradores
      .filter((c) => {
        if (c.status !== 'inativo') return false
        // Colaboradores inativos no período de atualização/saída
        const dataSaida = c.updated || c.created
        if (!isInPeriod(dataSaida)) return false
        if (filtroDepto !== 'todos' && c.departamento !== filtroDepto) return false
        if (termo) {
          const matchNome = (c.nome || '').toLowerCase().includes(termo)
          const matchCargo = (c.cargo || '').toLowerCase().includes(termo)
          const matchCpf = (c.cpf || '').includes(termo)
          return matchNome || matchCargo || matchCpf
        }
        return true
      })
      .map((c) => ({
        ...c,
        data_desligamento: c.updated || c.created,
        tempo_empresa: calcularTempoEmpresa(c.data_admissao, c.updated || c.created),
      }))
  }, [colaboradores, isInPeriod, filtroDepto, busca])

  const colunasDesligamentos: ColumnDefinition<any>[] = [
    { header: 'Nome do Colaborador', key: 'nome', width: 25 },
    { header: 'CPF', key: 'cpf', width: 16 },
    { header: 'Cargo', key: 'cargo', width: 22 },
    { header: 'Departamento', key: 'departamento', width: 20 },
    { header: 'Data Admissão', key: 'data_admissao', format: 'date', width: 16 },
    { header: 'Data Desligamento', key: 'data_desligamento', format: 'date', width: 16 },
    { header: 'Tempo de Empresa', key: 'tempo_empresa', width: 18 },
  ]

  // -------------------------------------------------------------
  // 3. RELATÓRIO: Turnover (Rotatividade por Departamento)
  // -------------------------------------------------------------
  interface TurnoverRow {
    departamento: string
    admissoes: number
    desligamentos: number
    ativosAtuais: number
    efetivoMedio: number
    taxaTurnover: number // percentual ex: 5.2
  }

  const dadosTurnover = useMemo<TurnoverRow[]>(() => {
    const deptosMap: Record<string, { adm: number; des: number; ativos: number }> = {}

    // Inicializa todos os departamentos
    departamentos.forEach((d) => {
      deptosMap[d] = { adm: 0, des: 0, ativos: 0 }
    })
    deptosMap['Geral (Tenant)'] = { adm: 0, des: 0, ativos: 0 }

    colaboradores.forEach((c) => {
      const depto = c.departamento ? c.departamento.trim() : 'Sem departamento'
      if (!deptosMap[depto]) {
        deptosMap[depto] = { adm: 0, des: 0, ativos: 0 }
      }

      if (c.status === 'ativo') {
        deptosMap[depto].ativos++
        deptosMap['Geral (Tenant)'].ativos++
      }

      if (isInPeriod(c.data_admissao)) {
        deptosMap[depto].adm++
        deptosMap['Geral (Tenant)'].adm++
      }

      if (c.status === 'inativo' && isInPeriod(c.updated || c.created)) {
        deptosMap[depto].des++
        deptosMap['Geral (Tenant)'].des++
      }
    })

    const rows: TurnoverRow[] = Object.entries(deptosMap)
      .filter(
        ([depto]) => filtroDepto === 'todos' || depto === filtroDepto || depto === 'Geral (Tenant)',
      )
      .map(([depto, stats]) => {
        // Fórmula oficial RH: ((Admissões + Desligamentos) / 2) / Efetivo Médio * 100
        const efetivoMedio = Math.max(1, stats.ativos)
        const taxa = ((stats.adm + stats.des) / 2 / efetivoMedio) * 100
        return {
          departamento: depto,
          admissoes: stats.adm,
          desligamentos: stats.des,
          ativosAtuais: stats.ativos,
          efetivoMedio,
          taxaTurnover: Math.round(taxa * 10) / 10,
        }
      })

    return rows
  }, [colaboradores, departamentos, isInPeriod, filtroDepto])

  const colunasTurnover: ColumnDefinition<TurnoverRow>[] = [
    { header: 'Departamento', key: 'departamento', width: 26 },
    { header: 'Colaboradores Ativos', key: 'ativosAtuais', format: 'number', width: 18 },
    { header: 'Admissões no Período', key: 'admissoes', format: 'number', width: 18 },
    { header: 'Desligamentos no Período', key: 'desligamentos', format: 'number', width: 20 },
    { header: 'Efetivo Médio', key: 'efetivoMedio', format: 'number', width: 16 },
    { header: 'Taxa de Turnover (%)', key: 'taxaTurnover', format: 'percent', width: 18 },
  ]

  // -------------------------------------------------------------
  // 4. RELATÓRIO: Absenteísmo (Faltas e Atestados Médicos)
  // -------------------------------------------------------------
  interface AbsenteismoRow {
    colaborador: string
    cpf: string
    departamento: string
    cargo: string
    totalAtestados: number
    totalDiasAfastamento: number
    diasUteisEstimados: number
    taxaAbsenteismo: number // percentual ex: 4.5%
  }

  const dadosAbsenteismo = useMemo<AbsenteismoRow[]>(() => {
    const termo = busca.trim().toLowerCase()
    const mapColabAtestados: Record<string, { count: number; dias: number }> = {}

    atestados.forEach((att) => {
      if (isInPeriod(att.data_inicio || att.data_envio)) {
        if (!mapColabAtestados[att.colaborador_id]) {
          mapColabAtestados[att.colaborador_id] = { count: 0, dias: 0 }
        }
        mapColabAtestados[att.colaborador_id].count++
        mapColabAtestados[att.colaborador_id].dias += Number(att.qtd_dias) || 1
      }
    })

    return colaboradores
      .filter((c) => {
        if (filtroDepto !== 'todos' && c.departamento !== filtroDepto) return false
        if (termo) {
          const matchNome = (c.nome || '').toLowerCase().includes(termo)
          const matchCargo = (c.cargo || '').toLowerCase().includes(termo)
          const matchCpf = (c.cpf || '').includes(termo)
          return matchNome || matchCargo || matchCpf
        }
        return true
      })
      .map((c) => {
        const stats = mapColabAtestados[c.id] || { count: 0, dias: 0 }
        // Estimativa padrão de 22 dias úteis/mês
        const diasUteis = 22
        const taxa = diasUteis > 0 ? (stats.dias / diasUteis) * 100 : 0
        return {
          colaborador: c.nome,
          cpf: c.cpf,
          departamento: c.departamento || '-',
          cargo: c.cargo || '-',
          totalAtestados: stats.count,
          totalDiasAfastamento: stats.dias,
          diasUteisEstimados: diasUteis,
          taxaAbsenteismo: Math.round(taxa * 10) / 10,
        }
      })
      .sort((a, b) => b.totalDiasAfastamento - a.totalDiasAfastamento)
  }, [colaboradores, atestados, isInPeriod, filtroDepto, busca])

  const colunasAbsenteismo: ColumnDefinition<AbsenteismoRow>[] = [
    { header: 'Colaborador', key: 'colaborador', width: 25 },
    { header: 'CPF', key: 'cpf', width: 16 },
    { header: 'Departamento', key: 'departamento', width: 20 },
    { header: 'Cargo', key: 'cargo', width: 20 },
    { header: 'Total Atestados', key: 'totalAtestados', format: 'number', width: 16 },
    { header: 'Dias de Afastamento', key: 'totalDiasAfastamento', format: 'number', width: 18 },
    { header: 'Taxa de Absenteísmo (%)', key: 'taxaAbsenteismo', format: 'percent', width: 20 },
  ]

  // -------------------------------------------------------------
  // 5. RELATÓRIO: Férias (Vencimentos e Previsões CLT)
  // -------------------------------------------------------------
  interface FeriasRow {
    colaborador: string
    cpf: string
    departamento: string
    cargo: string
    dataAdmissao: string
    limiteConcessivo: string
    diasAteLimite: number
    situacao: string
  }

  const dadosFerias = useMemo<FeriasRow[]>(() => {
    const termo = busca.trim().toLowerCase()
    const analise = feriasService.analisarFeriasProximas(
      colaboradores.filter((c) => c.status === 'ativo'),
      new Date(),
    )

    return analise.colaboradoresProximos
      .filter((s) => {
        const c = s.colaborador
        if (filtroDepto !== 'todos' && c.departamento !== filtroDepto) return false
        if (termo) {
          const matchNome = (c.nome || '').toLowerCase().includes(termo)
          const matchCargo = (c.cargo || '').toLowerCase().includes(termo)
          const matchCpf = (c.cpf || '').includes(termo)
          return matchNome || matchCargo || matchCpf
        }
        return true
      })
      .map((s) => {
        let situacao = 'Em dia'
        if (s.diasAteLimite < 0) situacao = 'Vencida (Risco Dobra)'
        else if (s.diasAteLimite <= 60) situacao = 'Atenção (<= 60 dias)'
        else if (s.diasAteLimite <= 90) situacao = 'Próximo do limite'

        return {
          colaborador: s.colaborador.nome,
          cpf: s.colaborador.cpf,
          departamento: s.colaborador.departamento || '-',
          cargo: s.colaborador.cargo || '-',
          dataAdmissao: s.dataAdmissao.toISOString().split('T')[0],
          limiteConcessivo: s.dataLimiteConcessao.toISOString().split('T')[0],
          diasAteLimite: s.diasAteLimite,
          situacao,
        }
      })
      .sort((a, b) => a.diasAteLimite - b.diasAteLimite)
  }, [colaboradores, filtroDepto, busca])

  const colunasFerias: ColumnDefinition<FeriasRow>[] = [
    { header: 'Colaborador', key: 'colaborador', width: 25 },
    { header: 'CPF', key: 'cpf', width: 16 },
    { header: 'Departamento', key: 'departamento', width: 20 },
    { header: 'Cargo', key: 'cargo', width: 20 },
    { header: 'Data Admissão', key: 'dataAdmissao', format: 'date', width: 16 },
    { header: 'Limite Concessivo CLT', key: 'limiteConcessivo', format: 'date', width: 18 },
    { header: 'Dias até Limite', key: 'diasAteLimite', format: 'number', width: 16 },
    { header: 'Situação', key: 'situacao', width: 20 },
  ]

  // -------------------------------------------------------------
  // 6. RELATÓRIO: Atestados
  // -------------------------------------------------------------
  interface AtestadoRow {
    colaborador: string
    cpf: string
    departamento: string
    dataInicio: string
    qtdDias: number
    status: string
    comentarioRh: string
    dataEnvio: string
  }

  const dadosAtestados = useMemo<AtestadoRow[]>(() => {
    const termo = busca.trim().toLowerCase()
    const colabMap = new Map<string, Colaborador>()
    colaboradores.forEach((c) => colabMap.set(c.id, c))

    return atestados
      .filter((att) => {
        if (!isInPeriod(att.data_inicio || att.data_envio)) return false
        const colab = colabMap.get(att.colaborador_id)
        if (filtroDepto !== 'todos' && colab?.departamento !== filtroDepto) return false
        if (termo) {
          const matchNome = (colab?.nome || '').toLowerCase().includes(termo)
          const matchCargo = (colab?.cargo || '').toLowerCase().includes(termo)
          const matchCpf = (colab?.cpf || '').includes(termo)
          return matchNome || matchCargo || matchCpf
        }
        return true
      })
      .map((att) => {
        const colab = colabMap.get(att.colaborador_id)
        let statusLabel: string = att.status
        if (att.status === 'validado') statusLabel = 'Validado'
        else if (att.status === 'recebido') statusLabel = 'Recebido'
        else if (att.status === 'em_analise') statusLabel = 'Em análise'
        else if (att.status === 'necessita_correcao') statusLabel = 'Necessita correção'

        return {
          colaborador: colab?.nome || 'Não identificado',
          cpf: colab?.cpf || '-',
          departamento: colab?.departamento || '-',
          dataInicio: att.data_inicio,
          qtdDias: att.qtd_dias,
          status: statusLabel,
          comentarioRh: att.comentario_rh || '-',
          dataEnvio: att.data_envio || att.created,
        }
      })
      .sort((a, b) => new Date(b.dataInicio).getTime() - new Date(a.dataInicio).getTime())
  }, [atestados, colaboradores, isInPeriod, filtroDepto, busca])

  const colunasAtestados: ColumnDefinition<AtestadoRow>[] = [
    { header: 'Colaborador', key: 'colaborador', width: 25 },
    { header: 'CPF', key: 'cpf', width: 16 },
    { header: 'Departamento', key: 'departamento', width: 20 },
    { header: 'Data de Início', key: 'dataInicio', format: 'date', width: 16 },
    { header: 'Qtd. Dias', key: 'qtdDias', format: 'number', width: 12 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Data de Envio', key: 'dataEnvio', format: 'date', width: 16 },
    { header: 'Comentário do RH', key: 'comentarioRh', width: 28 },
  ]

  // -------------------------------------------------------------
  // 7. RELATÓRIO: Ciências Pendentes (Compliance em Documentos Obrigatórios)
  // -------------------------------------------------------------
  interface CienciaPendenteRow {
    documento: string
    versao: string
    colaborador: string
    cpf: string
    departamento: string
    cargo: string
    dataPublicacao: string
  }

  const dadosCienciasPendentes = useMemo<CienciaPendenteRow[]>(() => {
    const termo = busca.trim().toLowerCase()
    const docsObrigatorios = documentos.filter((d) => d.obrigatorio && !d.colaborador_id)
    const colabsAtivos = colaboradores.filter((c) => c.status === 'ativo')

    const rows: CienciaPendenteRow[] = []

    docsObrigatorios.forEach((doc) => {
      const versaoVigente = (doc.versao || '1.0').trim()
      const cientesSet = new Set(
        ciencias
          .filter(
            (c) => c.documento_id === doc.id && (c.versao_ciente || '').trim() === versaoVigente,
          )
          .map((c) => c.colaborador_id),
      )

      colabsAtivos.forEach((colab) => {
        if (!cientesSet.has(colab.id)) {
          // Filtros
          if (filtroDepto !== 'todos' && colab.departamento !== filtroDepto) return
          if (termo) {
            const matchNome = (colab.nome || '').toLowerCase().includes(termo)
            const matchDoc = (doc.nome || '').toLowerCase().includes(termo)
            const matchCargo = (colab.cargo || '').toLowerCase().includes(termo)
            const matchCpf = (colab.cpf || '').includes(termo)
            if (!matchNome && !matchDoc && !matchCargo && !matchCpf) return
          }

          rows.push({
            documento: doc.nome,
            versao: doc.versao || '1.0',
            colaborador: colab.nome,
            cpf: colab.cpf,
            departamento: colab.departamento || '-',
            cargo: colab.cargo || '-',
            dataPublicacao: doc.data_publicacao || doc.created || '',
          })
        }
      })
    })

    return rows.sort((a, b) => a.documento.localeCompare(b.documento))
  }, [documentos, colaboradores, ciencias, filtroDepto, busca])

  const colunasCienciasPendentes: ColumnDefinition<CienciaPendenteRow>[] = [
    { header: 'Documento Obrigatório', key: 'documento', width: 28 },
    { header: 'Versão', key: 'versao', width: 10 },
    { header: 'Colaborador Pendente', key: 'colaborador', width: 25 },
    { header: 'CPF', key: 'cpf', width: 16 },
    { header: 'Departamento', key: 'departamento', width: 20 },
    { header: 'Cargo', key: 'cargo', width: 20 },
    { header: 'Data Publicação', key: 'dataPublicacao', format: 'date', width: 16 },
  ]

  // -------------------------------------------------------------
  // 8. RELATÓRIO: Documentos Pendentes (Documentação Admissional / Cadastral)
  // -------------------------------------------------------------
  interface DocPendenteRow {
    colaborador: string
    cpf: string
    departamento: string
    cargo: string
    dataAdmissao: string
    documentosFaltantes: string
    totalPendentes: number
  }

  const dadosDocumentosPendentes = useMemo<DocPendenteRow[]>(() => {
    const termo = busca.trim().toLowerCase()
    const colabsAtivos = colaboradores.filter((c) => c.status === 'ativo')

    // Documentos anexados por colaborador
    const docsPorColab = new Map<string, Documento[]>()
    documentos.forEach((d) => {
      if (d.colaborador_id) {
        const list = docsPorColab.get(d.colaborador_id) || []
        list.push(d)
        docsPorColab.set(d.colaborador_id, list)
      }
    })

    return colabsAtivos
      .map((colab) => {
        const faltantes: string[] = []
        if (!colab.rg) faltantes.push('RG')
        if (!colab.titulo_eleitor) faltantes.push('Título de Eleitor')
        if (!colab.endereco) faltantes.push('Comprovante de Residência')
        if (!colab.dados_bancarios && !colab.pix) faltantes.push('Dados Bancários')
        if (colab.sexo === 'Masculino' && !colab.reservista)
          faltantes.push('Certificado de Reservista')

        return {
          colaborador: colab.nome,
          cpf: colab.cpf,
          departamento: colab.departamento || '-',
          cargo: colab.cargo || '-',
          dataAdmissao: colab.data_admissao,
          documentosFaltantes: faltantes.length > 0 ? faltantes.join(', ') : 'Nenhuma pendência',
          totalPendentes: faltantes.length,
        }
      })
      .filter((row) => {
        if (row.totalPendentes === 0) return false
        if (filtroDepto !== 'todos' && row.departamento !== filtroDepto) return false
        if (termo) {
          const matchNome = row.colaborador.toLowerCase().includes(termo)
          const matchCargo = row.cargo.toLowerCase().includes(termo)
          const matchCpf = row.cpf.includes(termo)
          return matchNome || matchCargo || matchCpf
        }
        return true
      })
      .sort((a, b) => b.totalPendentes - a.totalPendentes)
  }, [colaboradores, documentos, filtroDepto, busca])

  const colunasDocumentosPendentes: ColumnDefinition<DocPendenteRow>[] = [
    { header: 'Colaborador', key: 'colaborador', width: 25 },
    { header: 'CPF', key: 'cpf', width: 16 },
    { header: 'Departamento', key: 'departamento', width: 20 },
    { header: 'Cargo', key: 'cargo', width: 20 },
    { header: 'Data Admissão', key: 'dataAdmissao', format: 'date', width: 16 },
    { header: 'Pendências Cadastrais', key: 'documentosFaltantes', width: 35 },
    { header: 'Total Pendências', key: 'totalPendentes', format: 'number', width: 16 },
  ]

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">Relatórios de RH</h1>
            <Badge
              variant="outline"
              className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-xs px-2.5 py-0.5 font-semibold"
            >
              Exportação Excel & PDF
            </Badge>
          </div>
          <p className="text-sm text-[#757575] mt-1">
            Geração e exportação analítica de indicadores de gestão de pessoas com download em .xlsx
            e .pdf.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="border-[#E0E0E0] text-[#212121] hover:bg-[#E8EEF7] hover:text-[#0D47A1] text-xs font-semibold h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* Barra de Filtros Globais */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Período De */}
            <div className="md:col-span-3 space-y-1">
              <Label className="text-xs font-semibold text-[#757575]">Data Inicial</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-9 text-xs border-[#E0E0E0] focus-visible:ring-[#0D47A1]"
              />
            </div>

            {/* Período Até */}
            <div className="md:col-span-3 space-y-1">
              <Label className="text-xs font-semibold text-[#757575]">Data Final</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-9 text-xs border-[#E0E0E0] focus-visible:ring-[#0D47A1]"
              />
            </div>

            {/* Departamento */}
            <div className="md:col-span-3 space-y-1">
              <Label className="text-xs font-semibold text-[#757575]">Departamento</Label>
              <select
                value={filtroDepto}
                onChange={(e) => setFiltroDepto(e.target.value)}
                className="w-full h-9 rounded-md border border-[#E0E0E0] bg-white px-3 text-xs text-[#212121] focus:outline-none focus:ring-1 focus:ring-[#0D47A1]"
              >
                <option value="todos">Todos os departamentos</option>
                {departamentos.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Busca rápida */}
            <div className="md:col-span-3 space-y-1">
              <Label className="text-xs font-semibold text-[#757575]">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#757575]" />
                <Input
                  placeholder="Nome, CPF ou cargo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8 h-9 text-xs border-[#E0E0E0] focus-visible:ring-[#0D47A1]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Seleção de Relatórios */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as RelatorioTab)}
        className="space-y-4"
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="bg-[#E8EEF7]/60 p-1 border border-[#E0E0E0] h-auto flex flex-wrap sm:flex-nowrap gap-1 min-w-max">
            <TabsTrigger
              value="admissoes"
              className="text-xs py-1.5 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Admissões
            </TabsTrigger>
            <TabsTrigger
              value="desligamentos"
              className="text-xs py-1.5 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <UserMinus className="h-3.5 w-3.5 mr-1.5" />
              Desligamentos
            </TabsTrigger>
            <TabsTrigger
              value="turnover"
              className="text-xs py-1.5 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <TrendingDown className="h-3.5 w-3.5 mr-1.5" />
              Turnover
            </TabsTrigger>
            <TabsTrigger
              value="absenteismo"
              className="text-xs py-1.5 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Absenteísmo
            </TabsTrigger>
            <TabsTrigger
              value="ferias"
              className="text-xs py-1.5 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Palmtree className="h-3.5 w-3.5 mr-1.5" />
              Férias
            </TabsTrigger>
            <TabsTrigger
              value="atestados"
              className="text-xs py-1.5 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Stethoscope className="h-3.5 w-3.5 mr-1.5" />
              Atestados
            </TabsTrigger>
            <TabsTrigger
              value="ciencias"
              className="text-xs py-1.5 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              Ciências Pendentes
            </TabsTrigger>
            <TabsTrigger
              value="documentos"
              className="text-xs py-1.5 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <FileWarning className="h-3.5 w-3.5 mr-1.5" />
              Documentos Pendentes
            </TabsTrigger>
            <TabsTrigger
              value="horas_extras"
              className="text-xs py-1.5 px-3 data-[state=active]:bg-[#0D47A1] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Horas Extras
              <Badge
                variant="outline"
                className="ml-1.5 text-[9px] py-0 px-1 bg-yellow-50 text-yellow-700 border-yellow-300"
              >
                Em breve
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 1. ABA ADMISSÕES */}
        <TabsContent value="admissoes" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-[#0D47A1]" />
                  Relatório de Admissões
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Histórico de novos colaboradores admitidos no período selecionado.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-semibold bg-[#E8EEF7] text-[#0D47A1]"
              >
                {dadosAdmissoes.length} admissão(ões)
              </Badge>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-md border border-[#E0E0E0]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F9FA] text-[#757575] font-semibold uppercase border-b border-[#E0E0E0]">
                    <tr>
                      <th className="py-2.5 px-3">Colaborador</th>
                      <th className="py-2.5 px-3">CPF</th>
                      <th className="py-2.5 px-3">Cargo</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3">Data de Admissão</th>
                      <th className="py-2.5 px-3">Jornada</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#757575]">
                          Carregando dados...
                        </td>
                      </tr>
                    ) : dadosAdmissoes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#757575]">
                          Nenhuma admissão encontrada para o período selecionado.
                        </td>
                      </tr>
                    ) : (
                      dadosAdmissoes.map((c) => (
                        <tr key={c.id} className="hover:bg-[#FAFAFA]">
                          <td className="py-2.5 px-3 font-semibold text-[#212121]">{c.nome}</td>
                          <td className="py-2.5 px-3 text-[#616161]">{c.cpf}</td>
                          <td className="py-2.5 px-3 text-[#212121]">{c.cargo}</td>
                          <td className="py-2.5 px-3 text-[#616161]">{c.departamento}</td>
                          <td className="py-2.5 px-3 font-medium text-[#0D47A1]">
                            {formatDataPtBr(c.data_admissao)}
                          </td>
                          <td className="py-2.5 px-3 text-[#757575]">{c.jornada || 'Integral'}</td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={
                                c.status === 'ativo'
                                  ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30'
                                  : 'bg-[#FFEBEE] text-[#C62828] border-[#C62828]/30'
                              }
                            >
                              {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Botões de Exportação Excel e PDF */}
              <ReportExportActions
                options={{
                  reportTitle: 'Relatório de Admissões',
                  filePrefix: 'Admissoes',
                  startDate: dataInicio,
                  endDate: dataFim,
                  columns: colunasAdmissoes,
                  data: dadosAdmissoes,
                }}
                disabled={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. ABA DESLIGAMENTOS */}
        <TabsContent value="desligamentos" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                  <UserMinus className="h-5 w-5 text-[#C62828]" />
                  Relatório de Desligamentos
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Histórico de colaboradores desligados e tempo de permanência na empresa.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-semibold bg-red-50 text-[#C62828] border-red-200"
              >
                {dadosDesligamentos.length} desligamento(s)
              </Badge>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-md border border-[#E0E0E0]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F9FA] text-[#757575] font-semibold uppercase border-b border-[#E0E0E0]">
                    <tr>
                      <th className="py-2.5 px-3">Colaborador</th>
                      <th className="py-2.5 px-3">CPF</th>
                      <th className="py-2.5 px-3">Cargo</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3">Data Admissão</th>
                      <th className="py-2.5 px-3">Data Desligamento</th>
                      <th className="py-2.5 px-3">Tempo de Empresa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#757575]">
                          Carregando...
                        </td>
                      </tr>
                    ) : dadosDesligamentos.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#757575]">
                          Nenhum desligamento registrado no período selecionado.
                        </td>
                      </tr>
                    ) : (
                      dadosDesligamentos.map((c) => (
                        <tr key={c.id} className="hover:bg-[#FAFAFA]">
                          <td className="py-2.5 px-3 font-semibold text-[#212121]">{c.nome}</td>
                          <td className="py-2.5 px-3 text-[#616161]">{c.cpf}</td>
                          <td className="py-2.5 px-3 text-[#212121]">{c.cargo}</td>
                          <td className="py-2.5 px-3 text-[#616161]">{c.departamento}</td>
                          <td className="py-2.5 px-3 text-[#757575]">
                            {formatDataPtBr(c.data_admissao)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#C62828]">
                            {formatDataPtBr(c.data_desligamento)}
                          </td>
                          <td className="py-2.5 px-3 text-[#616161]">{c.tempo_empresa}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <ReportExportActions
                options={{
                  reportTitle: 'Relatório de Desligamentos',
                  filePrefix: 'Desligamentos',
                  startDate: dataInicio,
                  endDate: dataFim,
                  columns: colunasDesligamentos,
                  data: dadosDesligamentos,
                }}
                disabled={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. ABA TURNOVER */}
        <TabsContent value="turnover" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-[#0D47A1]" />
                  Relatório de Turnover (Rotatividade de Pessoal)
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Cálculo oficial de turnover por departamento no período selecionado: ((Admissões +
                  Desligamentos) / 2) / Efetivo Médio.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-md border border-[#E0E0E0]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F9FA] text-[#757575] font-semibold uppercase border-b border-[#E0E0E0]">
                    <tr>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3 text-right">Ativos Atuais</th>
                      <th className="py-2.5 px-3 text-right">Admissões</th>
                      <th className="py-2.5 px-3 text-right">Desligamentos</th>
                      <th className="py-2.5 px-3 text-right">Efetivo Médio</th>
                      <th className="py-2.5 px-3 text-right font-bold text-[#0D47A1]">
                        Taxa de Turnover
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[#757575]">
                          Carregando...
                        </td>
                      </tr>
                    ) : dadosTurnover.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[#757575]">
                          Nenhum dado de turnover disponível.
                        </td>
                      </tr>
                    ) : (
                      dadosTurnover.map((row) => (
                        <tr
                          key={row.departamento}
                          className={`hover:bg-[#FAFAFA] ${row.departamento.includes('Geral') ? 'bg-[#F0F4FA] font-bold' : ''}`}
                        >
                          <td className="py-2.5 px-3 text-[#212121]">{row.departamento}</td>
                          <td className="py-2.5 px-3 text-right text-[#616161]">
                            {row.ativosAtuais}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#2E7D32] font-semibold">
                            +{row.admissoes}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#C62828] font-semibold">
                            -{row.desligamentos}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#616161]">
                            {row.efetivoMedio}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#0D47A1]">
                            {row.taxaTurnover.toFixed(1).replace('.', ',')}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <ReportExportActions
                options={{
                  reportTitle: 'Relatório de Turnover',
                  filePrefix: 'Turnover',
                  startDate: dataInicio,
                  endDate: dataFim,
                  columns: colunasTurnover,
                  data: dadosTurnover,
                }}
                disabled={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. ABA ABSENTEÍSMO */}
        <TabsContent value="absenteismo" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-[#E65100]" />
                  Relatório de Absenteísmo e Atestados Médicos
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Controle de faltas justificadas, atestados homologados e impacto em dias de
                  afastamento.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-md border border-[#E0E0E0]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F9FA] text-[#757575] font-semibold uppercase border-b border-[#E0E0E0]">
                    <tr>
                      <th className="py-2.5 px-3">Colaborador</th>
                      <th className="py-2.5 px-3">CPF</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3">Cargo</th>
                      <th className="py-2.5 px-3 text-right">Total Atestados</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-[#E65100]">
                        Dias Afastados
                      </th>
                      <th className="py-2.5 px-3 text-right font-bold text-[#0D47A1]">
                        Taxa de Absenteísmo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#757575]">
                          Carregando...
                        </td>
                      </tr>
                    ) : dadosAbsenteismo.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#757575]">
                          Nenhum registro de absenteísmo no período.
                        </td>
                      </tr>
                    ) : (
                      dadosAbsenteismo.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#FAFAFA]">
                          <td className="py-2.5 px-3 font-semibold text-[#212121]">
                            {row.colaborador}
                          </td>
                          <td className="py-2.5 px-3 text-[#616161]">{row.cpf}</td>
                          <td className="py-2.5 px-3 text-[#616161]">{row.departamento}</td>
                          <td className="py-2.5 px-3 text-[#757575]">{row.cargo}</td>
                          <td className="py-2.5 px-3 text-right">{row.totalAtestados}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-[#E65100]">
                            {row.totalDiasAfastamento} dias
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#0D47A1]">
                            {row.taxaAbsenteismo.toFixed(1).replace('.', ',')}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <ReportExportActions
                options={{
                  reportTitle: 'Relatório de Absenteísmo',
                  filePrefix: 'Absenteismo',
                  startDate: dataInicio,
                  endDate: dataFim,
                  columns: colunasAbsenteismo,
                  data: dadosAbsenteismo,
                }}
                disabled={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. ABA FÉRIAS */}
        <TabsContent value="ferias" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                  <Palmtree className="h-5 w-5 text-[#2E7D32]" />
                  Relatório de Férias e Vencimentos CLT
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Acompanhamento preventivo de períodos concessivos e colaboradores próximos do
                  prazo limite (CLT).
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-md border border-[#E0E0E0]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F9FA] text-[#757575] font-semibold uppercase border-b border-[#E0E0E0]">
                    <tr>
                      <th className="py-2.5 px-3">Colaborador</th>
                      <th className="py-2.5 px-3">CPF</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3">Data Admissão</th>
                      <th className="py-2.5 px-3">Limite Concessivo</th>
                      <th className="py-2.5 px-3 text-right">Dias até Limite</th>
                      <th className="py-2.5 px-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#757575]">
                          Carregando...
                        </td>
                      </tr>
                    ) : dadosFerias.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#757575]">
                          Nenhum registro de férias encontrado.
                        </td>
                      </tr>
                    ) : (
                      dadosFerias.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#FAFAFA]">
                          <td className="py-2.5 px-3 font-semibold text-[#212121]">
                            {row.colaborador}
                          </td>
                          <td className="py-2.5 px-3 text-[#616161]">{row.cpf}</td>
                          <td className="py-2.5 px-3 text-[#616161]">{row.departamento}</td>
                          <td className="py-2.5 px-3 text-[#757575]">
                            {formatDataPtBr(row.dataAdmissao)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#0D47A1]">
                            {formatDataPtBr(row.limiteConcessivo)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            {row.diasAteLimite} dias
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={
                                row.diasAteLimite <= 60
                                  ? 'bg-[#FFEBEE] text-[#C62828] border-[#C62828]/30 font-semibold'
                                  : 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30'
                              }
                            >
                              {row.situacao}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <ReportExportActions
                options={{
                  reportTitle: 'Relatório de Férias',
                  filePrefix: 'Ferias',
                  startDate: dataInicio,
                  endDate: dataFim,
                  columns: colunasFerias,
                  data: dadosFerias,
                }}
                disabled={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. ABA ATESTADOS */}
        <TabsContent value="atestados" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-[#0D47A1]" />
                  Relatório Analítico de Atestados Médicos
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Listagem completa de atestados emitidos, status de homologação pelo RH e
                  comentários.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-semibold bg-[#E8EEF7] text-[#0D47A1]"
              >
                {dadosAtestados.length} atestado(s)
              </Badge>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-md border border-[#E0E0E0]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F9FA] text-[#757575] font-semibold uppercase border-b border-[#E0E0E0]">
                    <tr>
                      <th className="py-2.5 px-3">Colaborador</th>
                      <th className="py-2.5 px-3">CPF</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3">Data Início</th>
                      <th className="py-2.5 px-3 text-right">Qtd. Dias</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Data de Envio</th>
                      <th className="py-2.5 px-3">Parecer RH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-[#757575]">
                          Carregando...
                        </td>
                      </tr>
                    ) : dadosAtestados.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-[#757575]">
                          Nenhum atestado encontrado no período.
                        </td>
                      </tr>
                    ) : (
                      dadosAtestados.map((att, idx) => (
                        <tr key={idx} className="hover:bg-[#FAFAFA]">
                          <td className="py-2.5 px-3 font-semibold text-[#212121]">
                            {att.colaborador}
                          </td>
                          <td className="py-2.5 px-3 text-[#616161]">{att.cpf}</td>
                          <td className="py-2.5 px-3 text-[#616161]">{att.departamento}</td>
                          <td className="py-2.5 px-3 font-medium text-[#0D47A1]">
                            {formatDataPtBr(att.dataInicio)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold">{att.qtdDias}d</td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={
                                att.status === 'Validado'
                                  ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30'
                                  : att.status === 'Necessita correção'
                                    ? 'bg-[#FFEBEE] text-[#C62828] border-[#C62828]/30'
                                    : 'bg-[#FFFDE7] text-[#F57F17] border-yellow-300'
                              }
                            >
                              {att.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-[#757575]">
                            {formatDataPtBr(att.dataEnvio)}
                          </td>
                          <td
                            className="py-2.5 px-3 text-[#616161] max-w-xs truncate"
                            title={att.comentarioRh}
                          >
                            {att.comentarioRh}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <ReportExportActions
                options={{
                  reportTitle: 'Relatório de Atestados',
                  filePrefix: 'Atestados',
                  startDate: dataInicio,
                  endDate: dataFim,
                  columns: colunasAtestados,
                  data: dadosAtestados,
                }}
                disabled={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. ABA CIÊNCIAS PENDENTES */}
        <TabsContent value="ciencias" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#0D47A1]" />
                  Relatório de Ciências Pendentes em Documentos Obrigatórios
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Colaboradores ativos que ainda não deram aceite/ciência na versão vigente das
                  normas da empresa.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-semibold bg-amber-50 text-[#E65100] border-amber-200"
              >
                {dadosCienciasPendentes.length} pendência(s)
              </Badge>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-md border border-[#E0E0E0]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F9FA] text-[#757575] font-semibold uppercase border-b border-[#E0E0E0]">
                    <tr>
                      <th className="py-2.5 px-3">Documento Obrigatório</th>
                      <th className="py-2.5 px-3">Versão</th>
                      <th className="py-2.5 px-3">Colaborador Pendente</th>
                      <th className="py-2.5 px-3">CPF</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3">Cargo</th>
                      <th className="py-2.5 px-3">Publicação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#757575]">
                          Carregando...
                        </td>
                      </tr>
                    ) : dadosCienciasPendentes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#2E7D32] font-semibold">
                          Parabéns! 100% de conformidade — nenhuma ciência pendente encontrada.
                        </td>
                      </tr>
                    ) : (
                      dadosCienciasPendentes.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#FAFAFA]">
                          <td className="py-2.5 px-3 font-semibold text-[#0D47A1]">
                            {row.documento}
                          </td>
                          <td className="py-2.5 px-3 text-[#616161]">v{row.versao}</td>
                          <td className="py-2.5 px-3 font-semibold text-[#212121]">
                            {row.colaborador}
                          </td>
                          <td className="py-2.5 px-3 text-[#616161]">{row.cpf}</td>
                          <td className="py-2.5 px-3 text-[#616161]">{row.departamento}</td>
                          <td className="py-2.5 px-3 text-[#757575]">{row.cargo}</td>
                          <td className="py-2.5 px-3 text-[#757575]">
                            {formatDataPtBr(row.dataPublicacao)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <ReportExportActions
                options={{
                  reportTitle: 'Relatório de Ciências Pendentes',
                  filePrefix: 'Ciencias_Pendentes',
                  startDate: dataInicio,
                  endDate: dataFim,
                  columns: colunasCienciasPendentes,
                  data: dadosCienciasPendentes,
                }}
                disabled={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 8. ABA DOCUMENTOS PENDENTES */}
        <TabsContent value="documentos" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-[#E65100]" />
                  Relatório de Documentos e Dados Cadastrais Pendentes
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Colaboradores ativos com itens cadastrais pendentes (RG, Título de Eleitor,
                  Comprovante de Residência, etc).
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-semibold bg-amber-50 text-[#E65100] border-amber-200"
              >
                {dadosDocumentosPendentes.length} colaborador(es) com pendências
              </Badge>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-md border border-[#E0E0E0]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F9FA] text-[#757575] font-semibold uppercase border-b border-[#E0E0E0]">
                    <tr>
                      <th className="py-2.5 px-3">Colaborador</th>
                      <th className="py-2.5 px-3">CPF</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3">Cargo</th>
                      <th className="py-2.5 px-3">Data Admissão</th>
                      <th className="py-2.5 px-3">Itens Cadastrais Pendentes</th>
                      <th className="py-2.5 px-3 text-right">Total Faltante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#757575]">
                          Carregando...
                        </td>
                      </tr>
                    ) : dadosDocumentosPendentes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#2E7D32] font-semibold">
                          Todos os cadastros dos colaboradores ativos estão completos!
                        </td>
                      </tr>
                    ) : (
                      dadosDocumentosPendentes.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#FAFAFA]">
                          <td className="py-2.5 px-3 font-semibold text-[#212121]">
                            {row.colaborador}
                          </td>
                          <td className="py-2.5 px-3 text-[#616161]">{row.cpf}</td>
                          <td className="py-2.5 px-3 text-[#616161]">{row.departamento}</td>
                          <td className="py-2.5 px-3 text-[#757575]">{row.cargo}</td>
                          <td className="py-2.5 px-3 text-[#757575]">
                            {formatDataPtBr(row.dataAdmissao)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#C62828]">
                            {row.documentosFaltantes}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#E65100]">
                            {row.totalPendentes}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <ReportExportActions
                options={{
                  reportTitle: 'Relatório de Documentos Pendentes',
                  filePrefix: 'Documentos_Pendentes',
                  startDate: dataInicio,
                  endDate: dataFim,
                  columns: colunasDocumentosPendentes,
                  data: dadosDocumentosPendentes,
                }}
                disabled={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 9. ABA HORAS EXTRAS (Placeholder "Em breve", sem tabela e sem exportação) */}
        <TabsContent value="horas_extras" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0]">
              <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#FB8C00]" />
                Relatório de Horas Extras e Banco de Horas
                <Badge
                  variant="outline"
                  className="bg-yellow-50 text-yellow-800 border-yellow-300 text-xs font-semibold"
                >
                  Em breve
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-[#757575]">
                Módulo em desenvolvimento para apuração de ponto eletrônico, horas extraordinárias e
                compensações.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-yellow-100 text-[#FB8C00] flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-[#212121]">Módulo em Construção</h3>
              <p className="text-xs text-[#757575] max-w-md mx-auto">
                A emissão do relatório analítico de Horas Extras estará disponível após a integração
                com o módulo de Gestão de Ponto Eletrônico (REP-P).
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function calcularTempoEmpresa(admissaoStr?: string, saidaStr?: string): string {
  if (!admissaoStr || !saidaStr) return '-'
  try {
    const d1 = new Date(admissaoStr)
    const d2 = new Date(saidaStr)
    const diffMs = Math.max(0, d2.getTime() - d1.getTime())
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const meses = Math.floor(dias / 30)
    const anos = Math.floor(meses / 12)
    const mesesRestantes = meses % 12

    if (anos > 0) {
      return `${anos} ano(s)${mesesRestantes > 0 ? ` e ${mesesRestantes} m` : ''}`
    }
    if (meses > 0) {
      return `${meses} mês(es)`
    }
    return `${dias} dia(s)`
  } catch {
    return '-'
  }
}
