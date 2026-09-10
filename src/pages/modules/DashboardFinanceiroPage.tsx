import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  Building2,
  FileDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Palmtree,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info,
  Sliders,
  Check,
  PlusCircle,
  Edit2,
  Target,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuth } from '@/context/AuthContext'
import {
  Colaborador,
  LancamentoPeriodico,
  LancamentoPontual,
  BancoHorasFechamento,
  CompensacaoBancoHoras,
  OrcamentoFolha,
} from '@/types'
import pb from '@/lib/pocketbase/client'
import { folhaService } from '@/services/folhaService'
import { orcamentoFolhaService } from '@/services/orcamentoFolhaService'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { bancoHorasService } from '@/services/bancoHorasService'
import { compensacaoService } from '@/services/compensacaoService'
import { feriasService, ColaboradorFeriasStatus } from '@/services/feriasService'
import { colaboradorService } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { getTeslaLogoBase64 } from '@/lib/logoAsset'
import { formatMoedaPtBr } from '@/lib/exportReports'

export const DashboardFinanceiroPage: React.FC = () => {
  const { user } = useAuth()
  const tenantId = user?.tenant_id || ''

  // Competência selecionada (mês/ano)
  const agora = useMemo(() => new Date(), [])
  const [anoCompetencia, setAnoCompetencia] = useState<number>(agora.getFullYear())
  const [mesCompetencia, setMesCompetencia] = useState<number>(agora.getMonth() + 1) // 1 a 12

  // Lista de meses para o select
  const mesesOpcoes = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ]

  // Anos de seleção: ano atual - 2 até ano atual + 1
  const anosOpcoes = useMemo(() => {
    const atual = agora.getFullYear()
    return [atual - 2, atual - 1, atual, atual + 1]
  }, [agora])

  // Estados de dados
  const [loading, setLoading] = useState<boolean>(true)
  const [exportingPdf, setExportingPdf] = useState<boolean>(false)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [periodicos, setPeriodicos] = useState<LancamentoPeriodico[]>([])
  const [pontuais, setPontuais] = useState<LancamentoPontual[]>([])
  const [fechamentosBanco, setFechamentosBanco] = useState<BancoHorasFechamento[]>([])
  const [compensacoes, setCompensacoes] = useState<CompensacaoBancoHoras[]>([])
  const [feriasProximas, setFeriasProximas] = useState<ColaboradorFeriasStatus[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoFolha[]>([])

  // Modal de Orçamento
  const [modalOrcamentoAberto, setModalOrcamentoAberto] = useState<boolean>(false)
  const [orcamentoEditandoAno, setOrcamentoEditandoAno] = useState<number>(agora.getFullYear())
  const [orcamentoEditandoMes, setOrcamentoEditandoMes] = useState<number>(agora.getMonth() + 1)
  const [formValorFolha, setFormValorFolha] = useState<string>('')
  const [formValorBanco, setFormValorBanco] = useState<string>('')
  const [formObs, setFormObs] = useState<string>('')
  const [salvandoOrcamento, setSalvandoOrcamento] = useState<boolean>(false)

  // Apenas admin_rh e admin têm permissão de orçamento
  const podeGerenciarOrcamento = useMemo(() => {
    const p = user?.perfil
    return p === 'admin_rh' || p === 'admin'
  }, [user?.perfil])

  // Carregar todos os dados necessários
  const carregarDadosFinanceiros = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    try {
      const [colabs, pers, ponts, fBank, comps, orcs] = await Promise.all([
        colaboradorService.getColaboradores(tenantId),
        folhaService.getPeriodicosTenant(tenantId),
        folhaService.getPontuaisTenant(tenantId),
        bancoHorasService.getAllFechamentosTenant(tenantId).catch(() => []),
        compensacaoService.getCompensacoesTenant(tenantId).catch(() => []),
        orcamentoFolhaService.getOrcamentosTenant(tenantId).catch(() => []),
      ])

      setColaboradores(colabs)
      setPeriodicos(pers)
      setPontuais(ponts)
      setFechamentosBanco(fBank)
      setCompensacoes(comps)
      setOrcamentos(orcs)

      // Analisar férias próximas (saldo concessivo a vencer nos próximos 90 dias)
      try {
        const proximas = await feriasService.calcularFeriasProximas(colabs, new Date())
        setFeriasProximas(proximas)
      } catch (errFerias) {
        console.warn('Erro ao calcular provisão de férias:', errFerias)
      }
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard financeiro:', err)
      toast({
        title: 'Erro de carregamento',
        description: 'Não foi possível carregar os dados financeiros consolidados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    carregarDadosFinanceiros()
  }, [carregarDadosFinanceiros])

  // =========================================================================
  // 1. KPIs DE FOLHA DA COMPETÊNCIA SELECIONADA
  // =========================================================================
  const { totalProventosMes, totalDescontosMes, valorLiquidoMes } = useMemo(() => {
    const colabPeriodicosMap = new Map<string, LancamentoPeriodico[]>()
    for (const p of periodicos) {
      const list = colabPeriodicosMap.get(p.colaborador_id) || []
      list.push(p)
      colabPeriodicosMap.set(p.colaborador_id, list)
    }

    const colabPontuaisMap = new Map<string, LancamentoPontual[]>()
    for (const p of pontuais) {
      const list = colabPontuaisMap.get(p.colaborador_id) || []
      list.push(p)
      colabPontuaisMap.set(p.colaborador_id, list)
    }

    let sumProventos = 0
    let sumDescontos = 0

    colaboradores.forEach((colab) => {
      const colabPers = colabPeriodicosMap.get(colab.id) || []
      const colabPonts = colabPontuaisMap.get(colab.id) || []
      const res = folhaService.calcularResumoFinanceiro(
        colabPers,
        colabPonts,
        anoCompetencia,
        mesCompetencia,
      )
      sumProventos += res.totalProventos
      sumDescontos += res.totalDescontos
    })

    const sumLiquido = sumProventos - sumDescontos

    return {
      totalProventosMes: Math.round(sumProventos * 100) / 100,
      totalDescontosMes: Math.round(sumDescontos * 100) / 100,
      valorLiquidoMes: Math.round(sumLiquido * 100) / 100,
    }
  }, [colaboradores, periodicos, pontuais, anoCompetencia, mesCompetencia])

  // =========================================================================
  // 2. SALDO TOTAL DO BANCO DE HORAS DA EMPRESA
  // =========================================================================
  const saldoTotalBancoHorasEmpresa = useMemo(() => {
    // Soma o saldo_ms de todos os fechamentos de banco de horas do tenant
    const totalMs = fechamentosBanco.reduce((acc, f) => acc + (f.saldo_ms || 0), 0)
    // Desconta compensações aprovadas do tenant
    const horasCompensadas = compensacoes
      .filter((c) => c.status === 'aprovada')
      .reduce((acc, c) => acc + (c.horas || 0), 0)

    const saldoHorasFechamento = totalMs / (1000 * 60 * 60)
    const saldoLiquidoHoras = Math.round((saldoHorasFechamento - horasCompensadas) * 10) / 10
    return saldoLiquidoHoras
  }, [fechamentosBanco, compensacoes])

  // =========================================================================
  // 3. GRÁFICO DE BARRAS: PROVENTOS VS DESCONTOS POR DEPARTAMENTO NO MÊS
  // =========================================================================
  const dadosGraficoDepartamentos = useMemo(() => {
    const colabPeriodicosMap = new Map<string, LancamentoPeriodico[]>()
    for (const p of periodicos) {
      const list = colabPeriodicosMap.get(p.colaborador_id) || []
      list.push(p)
      colabPeriodicosMap.set(p.colaborador_id, list)
    }

    const colabPontuaisMap = new Map<string, LancamentoPontual[]>()
    for (const p of pontuais) {
      const list = colabPontuaisMap.get(p.colaborador_id) || []
      list.push(p)
      colabPontuaisMap.set(p.colaborador_id, list)
    }

    const mapa = new Map<string, { proventos: number; descontos: number; liquido: number }>()

    colaboradores.forEach((colab) => {
      const depto = colab.departamento || 'Geral'
      const colabPers = colabPeriodicosMap.get(colab.id) || []
      const colabPonts = colabPontuaisMap.get(colab.id) || []
      const res = folhaService.calcularResumoFinanceiro(
        colabPers,
        colabPonts,
        anoCompetencia,
        mesCompetencia,
      )

      const atual = mapa.get(depto) || { proventos: 0, descontos: 0, liquido: 0 }
      atual.proventos += res.totalProventos
      atual.descontos += res.totalDescontos
      atual.liquido += res.valorLiquido
      mapa.set(depto, atual)
    })

    return Array.from(mapa.entries()).map(([departamento, valores]) => ({
      departamento,
      proventos: Math.round(valores.proventos * 100) / 100,
      descontos: Math.round(valores.descontos * 100) / 100,
      liquido: Math.round(valores.liquido * 100) / 100,
    }))
  }, [colaboradores, periodicos, pontuais, anoCompetencia, mesCompetencia])

  // Mapa de orçamentos por competência ("YYYY-MM")
  const mapaOrcamentos = useMemo(() => {
    const map = new Map<string, OrcamentoFolha>()
    orcamentos.forEach((o) => {
      map.set(o.competencia, o)
    })
    return map
  }, [orcamentos])

  // Abrir modal de cadastro/edição de orçamento
  const abrirModalOrcamento = (ano: number, mes: number) => {
    const comp = `${ano}-${String(mes).padStart(2, '0')}`
    const existente = mapaOrcamentos.get(comp)

    setOrcamentoEditandoAno(ano)
    setOrcamentoEditandoMes(mes)
    setFormValorFolha(existente ? String(existente.valor_orcado_folha) : '')
    setFormValorBanco(
      existente && existente.valor_orcado_banco_horas !== undefined
        ? String(existente.valor_orcado_banco_horas)
        : '',
    )
    setFormObs(existente?.observacao || '')
    setModalOrcamentoAberto(true)
  }

  // Salvar orçamento
  const handleSalvarOrcamento = async (e: React.FormEvent) => {
    e.preventDefault()
    const valorFolhaNum = parseFloat(formValorFolha.replace(',', '.'))
    if (isNaN(valorFolhaNum) || valorFolhaNum <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'O valor orçado da folha deve ser um número positivo maior que zero.',
        variant: 'destructive',
      })
      return
    }

    let valorBancoNum = 0
    if (formValorBanco.trim()) {
      valorBancoNum = parseFloat(formValorBanco.replace(',', '.'))
      if (isNaN(valorBancoNum) || valorBancoNum < 0) {
        toast({
          title: 'Valor de banco de horas inválido',
          description: 'O valor orçado para banco de horas deve ser zero ou positivo.',
          variant: 'destructive',
        })
        return
      }
    }

    setSalvandoOrcamento(true)
    try {
      const rec = await orcamentoFolhaService.salvarOrcamento({
        tenantId,
        ano: orcamentoEditandoAno,
        mes: orcamentoEditandoMes,
        valorOrcadoFolha: valorFolhaNum,
        valorOrcadoBancoHoras: valorBancoNum,
        observacao: formObs,
        userId: user?.id,
      })

      // Atualizar lista local
      setOrcamentos((prev) => {
        const filtrado = prev.filter((o) => o.competencia !== rec.competencia)
        return [...filtrado, rec]
      })

      setModalOrcamentoAberto(false)
      toast({
        title: 'Orçamento gravado',
        description: `Orçamento da competência ${String(orcamentoEditandoMes).padStart(
          2,
          '0',
        )}/${orcamentoEditandoAno} salvo com sucesso.`,
      })
    } catch (err) {
      console.error('Erro ao salvar orçamento de folha:', err)
      toast({
        title: 'Erro ao salvar orçamento',
        description: 'Não foi possível registrar o orçamento. Verifique permissões.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoOrcamento(false)
    }
  }

  // =========================================================================
  // 4. CICLOS FUTUROS & ORÇADO VS. REALIZADO (Competência Atual + Próximos 3 Meses)
  // =========================================================================
  const ciclosOrcadoVsRealizado = useMemo(() => {
    const colabPeriodicosMap = new Map<string, LancamentoPeriodico[]>()
    for (const p of periodicos) {
      const list = colabPeriodicosMap.get(p.colaborador_id) || []
      list.push(p)
      colabPeriodicosMap.set(p.colaborador_id, list)
    }

    const colabPontuaisMap = new Map<string, LancamentoPontual[]>()
    for (const p of pontuais) {
      const list = colabPontuaisMap.get(p.colaborador_id) || []
      list.push(p)
      colabPontuaisMap.set(p.colaborador_id, list)
    }

    const hojeData = new Date()
    const anoAtualReal = hojeData.getFullYear()
    const mesAtualReal = hojeData.getMonth() + 1 // 1..12

    // Gerar 4 ciclos: competência selecionada (i=0) + próximos 3 meses (i=1,2,3)
    const ciclos: {
      ano: number
      mes: number
      competenciaKey: string
      mesNome: string
      label: string
      isCompetenciaSelecionada: boolean
      isFuturo: boolean
      orcadoFolha?: number
      orcadoBanco?: number
      realizadoFolha?: number
      temRealizado: boolean
      variacaoRs?: number
      variacaoPct?: number
      estourou: boolean
      dentroDoOrcado: boolean
    }[] = []

    const refDate = new Date(anoCompetencia, mesCompetencia - 1, 1)

    for (let i = 0; i < 4; i++) {
      const cicloDate = new Date(refDate.getFullYear(), refDate.getMonth() + i, 1)
      const a = cicloDate.getFullYear()
      const m = cicloDate.getMonth() + 1
      const compKey = `${a}-${String(m).padStart(2, '0')}`

      // Verificar se é mês estritamente futuro em relação à data do sistema
      const isFuturo = a > anoAtualReal || (a === anoAtualReal && m > mesAtualReal)

      // Orçamento cadastrado
      const orc = mapaOrcamentos.get(compKey)
      const orcadoFolha = orc?.valor_orcado_folha
      const orcadoBanco = orc?.valor_orcado_banco_horas

      // Calcular realizado
      let sumLiquido = 0
      let qtdLancamentos = 0
      colaboradores.forEach((colab) => {
        const colabPers = colabPeriodicosMap.get(colab.id) || []
        const colabPonts = colabPontuaisMap.get(colab.id) || []
        const res = folhaService.calcularResumoFinanceiro(colabPers, colabPonts, a, m)
        sumLiquido += res.valorLiquido
        qtdLancamentos += res.quantidadePeriodicos + res.quantidadePontuais
      })

      // Considera que tem realizado se houver lançamentos ou se for o mês corrente/passado
      const temRealizado = !isFuturo || qtdLancamentos > 0
      const realizadoFolha = temRealizado ? Math.round(sumLiquido * 100) / 100 : undefined

      let variacaoRs: number | undefined
      let variacaoPct: number | undefined
      let estourou = false
      let dentroDoOrcado = false

      if (orcadoFolha !== undefined && realizadoFolha !== undefined) {
        // Variação = Realizado - Orçado (se positivo, estourou)
        variacaoRs = Math.round((realizadoFolha - orcadoFolha) * 100) / 100
        variacaoPct = orcadoFolha > 0 ? (variacaoRs / orcadoFolha) * 100 : 0
        estourou = realizadoFolha > orcadoFolha
        dentroDoOrcado = realizadoFolha <= orcadoFolha
      }

      const mesItem = mesesOpcoes.find((item) => item.value === m)

      ciclos.push({
        ano: a,
        mes: m,
        competenciaKey: compKey,
        mesNome: mesItem?.label || '',
        label: `${mesItem?.label} de ${a}`,
        isCompetenciaSelecionada: i === 0,
        isFuturo,
        orcadoFolha,
        orcadoBanco,
        realizadoFolha,
        temRealizado,
        variacaoRs,
        variacaoPct,
        estourou,
        dentroDoOrcado,
      })
    }

    return ciclos
  }, [
    anoCompetencia,
    mesCompetencia,
    colaboradores,
    periodicos,
    pontuais,
    mapaOrcamentos,
    mesesOpcoes,
  ])

  // =========================================================================
  // 5. GRÁFICO DE LINHA: EVOLUÇÃO DO VALOR LÍQUIDO DA FOLHA (6 MESES) COM LINHA PONTILHADA DE ORÇADO
  // =========================================================================
  const dadosEvolucaoUltimos6Meses = useMemo(() => {
    const ultimos6: { ano: number; mes: number; label: string; compKey: string }[] = []
    const refDate = new Date(anoCompetencia, mesCompetencia - 1, 1)

    for (let i = 5; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1)
      const a = d.getFullYear()
      const m = d.getMonth() + 1
      const nomesCurtos = [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
      ]
      ultimos6.push({
        ano: a,
        mes: m,
        compKey: `${a}-${String(m).padStart(2, '0')}`,
        label: `${nomesCurtos[m - 1]}/${String(a).slice(2)}`,
      })
    }

    const colabPeriodicosMap = new Map<string, LancamentoPeriodico[]>()
    for (const p of periodicos) {
      const list = colabPeriodicosMap.get(p.colaborador_id) || []
      list.push(p)
      colabPeriodicosMap.set(p.colaborador_id, list)
    }

    const colabPontuaisMap = new Map<string, LancamentoPontual[]>()
    for (const p of pontuais) {
      const list = colabPontuaisMap.get(p.colaborador_id) || []
      list.push(p)
      colabPontuaisMap.set(p.colaborador_id, list)
    }

    return ultimos6.map(({ ano, mes, label, compKey }) => {
      let sumLiquido = 0
      let sumProventos = 0
      let sumDescontos = 0

      colaboradores.forEach((colab) => {
        const colabPers = colabPeriodicosMap.get(colab.id) || []
        const colabPonts = colabPontuaisMap.get(colab.id) || []
        const res = folhaService.calcularResumoFinanceiro(colabPers, colabPonts, ano, mes)
        sumLiquido += res.valorLiquido
        sumProventos += res.totalProventos
        sumDescontos += res.totalDescontos
      })

      const orc = mapaOrcamentos.get(compKey)

      return {
        competencia: label,
        liquido: Math.round(sumLiquido * 100) / 100,
        proventos: Math.round(sumProventos * 100) / 100,
        descontos: Math.round(sumDescontos * 100) / 100,
        orcado: orc ? orc.valor_orcado_folha : undefined,
      }
    })
  }, [anoCompetencia, mesCompetencia, colaboradores, periodicos, pontuais, mapaOrcamentos])

  // =========================================================================
  // 6. PAINEL "COMPENSAÇÕES NO MÊS"
  // =========================================================================
  const compensacoesNoMes = useMemo(() => {
    const compStr = `${anoCompetencia}-${String(mesCompetencia).padStart(2, '0')}`

    const filtradas = compensacoes.filter((c) => {
      const dataRef = (c.data_compensacao || c.created || '').slice(0, 7)
      return dataRef === compStr
    })

    let horasSolicitadas = 0
    let horasAprovadas = 0
    let horasRecusadas = 0
    let qtdSolicitadas = filtradas.length
    let qtdAprovadas = 0
    let qtdRecusadas = 0
    let qtdPendentes = 0

    filtradas.forEach((c) => {
      const h = c.horas || 0
      horasSolicitadas += h
      if (c.status === 'aprovada') {
        horasAprovadas += h
        qtdAprovadas++
      } else if (c.status === 'recusada') {
        horasRecusadas += h
        qtdRecusadas++
      } else {
        qtdPendentes++
      }
    })

    return {
      totalItens: qtdSolicitadas,
      horasSolicitadas: Math.round(horasSolicitadas * 10) / 10,
      horasAprovadas: Math.round(horasAprovadas * 10) / 10,
      horasRecusadas: Math.round(horasRecusadas * 10) / 10,
      qtdAprovadas,
      qtdRecusadas,
      qtdPendentes,
      impactoHorasBanco: -Math.round(horasAprovadas * 10) / 10, // Aprovadas debitam horas
    }
  }, [compensacoes, anoCompetencia, mesCompetencia])

  // =========================================================================
  // 7. PAINEL "PROVISÃO DE FÉRIAS" (Estimativa simples = Remuneração + 1/3)
  // Próximos 90 dias com saldo concessivo a vencer
  // Restrição permanente: sem INSS/IRRF/FGTS
  // =========================================================================
  const provisaoFeriasProximos90Dias = useMemo(() => {
    // Filtrar colaboradores com saldo concessivo a vencer nos próximos 90 dias
    // (diasParaVencer <= 90 e ainda não gozado)
    const elegiveis = feriasProximas.filter((fp) => fp.diasParaVencer <= 90)

    // Mapa de remuneração mensal por colaborador (busca nos periódicos com 'Remuneração' ou maior positivo)
    const salarioPorColab = new Map<string, number>()
    periodicos.forEach((p) => {
      if (p.quantidade > 0) {
        const atual = salarioPorColab.get(p.colaborador_id) || 0
        if (p.descritivo.toLowerCase().includes('remunera') || p.quantidade > atual) {
          salarioPorColab.set(p.colaborador_id, p.quantidade)
        }
      }
    })

    let somaSalarios = 0
    let somaTerco = 0
    let totalEstimado = 0
    const listaDetalhada: {
      colaborador: Colaborador
      diasParaVencer: number
      limiteConcessivo: Date
      remuneracaoVigente: number
      tercoConstitucional: number
      totalProvisao: number
    }[] = []

    elegiveis.forEach((fp) => {
      const salario = salarioPorColab.get(fp.colaborador.id) || 0
      const terco = salario / 3
      const totalColab = salario + terco

      somaSalarios += salario
      somaTerco += terco
      totalEstimado += totalColab

      listaDetalhada.push({
        colaborador: fp.colaborador,
        diasParaVencer: fp.diasParaVencer,
        limiteConcessivo: fp.limiteConcessivo,
        remuneracaoVigente: salario,
        tercoConstitucional: terco,
        totalProvisao: totalColab,
      })
    })

    return {
      qtdColaboradores: elegiveis.length,
      somaSalarios: Math.round(somaSalarios * 100) / 100,
      somaTerco: Math.round(somaTerco * 100) / 100,
      totalEstimado: Math.round(totalEstimado * 100) / 100,
      listaDetalhada: listaDetalhada.sort((a, b) => a.diasParaVencer - b.diasParaVencer),
    }
  }, [feriasProximas, periodicos])

  // =========================================================================
  // 8. EXPORTAÇÃO PDF OFICIAL COM LOGO TESLA, ZEBRA STRIPES E RODAPÉ
  // =========================================================================
  const handleExportarPdf = async () => {
    setExportingPdf(true)
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const agoraGeracao = new Date()
      const dataHoraGeracao = agoraGeracao.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

      const mesNome = mesesOpcoes.find((m) => m.value === mesCompetencia)?.label || ''
      const competenciaStr = `${mesNome} de ${anoCompetencia}`

      // Obter Logo Tesla em base64
      let logoBase64: string | null = null
      try {
        logoBase64 = await getTeslaLogoBase64()
      } catch (e) {
        console.warn('Não foi possível carregar logo para PDF financeiro:', e)
      }

      // Preparar dados da tabela por departamento
      const headTabela = [
        ['Departamento', 'Proventos (R$)', 'Descontos (R$)', 'Valor Líquido (R$)', 'Margem (%)'],
      ]

      const bodyTabela = dadosGraficoDepartamentos.map((d) => {
        const margem = d.proventos > 0 ? `${((d.liquido / d.proventos) * 100).toFixed(1)}%` : '0.0%'
        return [
          d.departamento,
          formatMoedaPtBr(d.proventos),
          formatMoedaPtBr(d.descontos),
          formatMoedaPtBr(d.liquido),
          margem,
        ]
      })

      // Linha de total geral
      bodyTabela.push([
        'TOTAL CONSOLIDADO',
        formatMoedaPtBr(totalProventosMes),
        formatMoedaPtBr(totalDescontosMes),
        formatMoedaPtBr(valorLiquidoMes),
        totalProventosMes > 0
          ? `${((valorLiquidoMes / totalProventosMes) * 100).toFixed(1)}%`
          : '0.0%',
      ])

      autoTable(doc, {
        head: headTabela,
        body: bodyTabela,
        startY: 55,
        margin: { top: 55, bottom: 20, left: 14, right: 14 },
        theme: 'striped',
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 3.5,
          textColor: [33, 33, 33],
        },
        headStyles: {
          fillColor: [13, 71, 161], // #0D47A1 Azul corporativo Tesla
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9.5,
          halign: 'left',
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250],
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right', fontStyle: 'bold' },
          4: { halign: 'center' },
        },
        didDrawPage: (hookData) => {
          doc.saveGraphicsState?.()

          // Barra azul no topo
          doc.setFillColor(13, 71, 161)
          doc.rect(14, 8, pageWidth - 28, 1.5, 'F')

          // Logo Tesla Mecatrônica
          let headerTextX = 14
          if (logoBase64) {
            try {
              doc.addImage(logoBase64, 'JPEG', 14, 11, 13, 13)
              headerTextX = 30
            } catch {
              headerTextX = 14
            }
          }

          // Identidade corporativa Tesla
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(12)
          doc.setTextColor(13, 71, 161)
          doc.text('TESLA MECATRÔNICA', headerTextX, 17)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(117, 117, 117)
          doc.text(
            'Gente e Gestão • Dashboard Financeiro Consolidado da Liderança',
            headerTextX,
            22,
          )

          // Data de geração à direita
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(117, 117, 117)
          doc.text(`Gerado em: ${dataHoraGeracao}`, pageWidth - 14, 17, { align: 'right' })

          // Título do Relatório e Competência
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(13)
          doc.setTextColor(33, 33, 33)
          doc.text(`Relatório Financeiro da Folha — Competência ${competenciaStr}`, 14, 32)

          // Linha de KPIs resumidos no cabeçalho
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.setTextColor(80, 80, 80)
          const orcAtual = mapaOrcamentos.get(
            `${anoCompetencia}-${String(mesCompetencia).padStart(2, '0')}`,
          )
          const orcadoTexto = orcAtual
            ? `  |  Orçado: ${formatMoedaPtBr(orcAtual.valor_orcado_folha)}`
            : ''
          const kpisTexto = `Total Proventos: ${formatMoedaPtBr(totalProventosMes)}  |  Total Descontos: ${formatMoedaPtBr(totalDescontosMes)}  |  Valor Líquido: ${formatMoedaPtBr(valorLiquidoMes)}${orcadoTexto}  |  Saldo Banco Horas: ${saldoTotalBancoHorasEmpresa > 0 ? `+${saldoTotalBancoHorasEmpresa}h` : `${saldoTotalBancoHorasEmpresa}h`}`
          doc.text(kpisTexto, 14, 38)
          const infoProvisao = `Provisão de Férias (90 dias): ${formatMoedaPtBr(provisaoFeriasProximos90Dias.totalEstimado)} (${provisaoFeriasProximos90Dias.qtdColaboradores} colaboradores a vencer — estimativa simples remuneração + 1/3 sem encargos)`
          doc.setFontSize(8)
          doc.setTextColor(100, 100, 100)
          doc.text(infoProvisao, 14, 44)

          doc.setDrawColor(224, 224, 224)
          doc.setLineWidth(0.5)
          doc.line(14, 48, pageWidth - 14, 48)

          // Rodapé com data/hora e número de página
          const footerY = pageHeight - 10
          doc.setDrawColor(224, 224, 224)
          doc.line(14, footerY - 3, pageWidth - 14, footerY - 3)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(117, 117, 117)
          doc.text(
            `Tesla Mecatrônica • Plataforma RH Gente e Gestão — Documento confidencial para a liderança`,
            14,
            footerY + 2,
          )

          const pageNumber = (doc as any).internal.getCurrentPageInfo
            ? (doc as any).internal.getCurrentPageInfo().pageNumber
            : hookData.pageNumber
          doc.text(`Página ${pageNumber}`, pageWidth - 14, footerY + 2, { align: 'right' })

          doc.restoreGraphicsState?.()
        },
      })

      const nomeArquivo = `Dashboard_Financeiro_Tesla_${anoCompetencia}_${String(
        mesCompetencia,
      ).padStart(2, '0')}.pdf`
      doc.save(nomeArquivo)

      toast({
        title: 'Exportação concluída',
        description: `Relatório financeiro em PDF exportado com sucesso (${nomeArquivo}).`,
      })
    } catch (err) {
      console.error('Erro ao gerar PDF financeiro:', err)
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível gerar o arquivo PDF.',
        variant: 'destructive',
      })
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Cabeçalho da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100/70 text-[#0D47A1] rounded-xl shadow-xs">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Dashboard Financeiro Consolidado
              </h1>
              <Badge
                variant="outline"
                className="border-blue-300 text-[#0D47A1] bg-blue-50 font-bold text-xs"
              >
                Visão Liderança
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Acompanhamento gerencial de folha, compensações de banco de horas, tendências e
              estimativa de provisão de férias.
            </p>
          </div>
        </div>

        {/* Seletores de Competência e Botão de Exportar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Mês */}
          <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500 mr-1.5" />
            <Select
              value={String(mesCompetencia)}
              onValueChange={(val) => setMesCompetencia(Number(val))}
            >
              <SelectTrigger className="h-7 border-none bg-transparent shadow-none text-xs font-bold text-slate-800 p-0 focus:ring-0 w-28">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {mesesOpcoes.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor de Ano */}
          <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            <Select
              value={String(anoCompetencia)}
              onValueChange={(val) => setAnoCompetencia(Number(val))}
            >
              <SelectTrigger className="h-7 border-none bg-transparent shadow-none text-xs font-bold text-slate-800 p-0 focus:ring-0 w-16">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {anosOpcoes.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botão Exportar PDF */}
          <Button
            onClick={handleExportarPdf}
            disabled={exportingPdf || loading}
            size="sm"
            className="h-9 gap-1.5 bg-[#0D47A1] hover:bg-[#0b3c8a] text-white font-semibold text-xs shadow-xs"
          >
            <FileDown className="h-4 w-4" />
            {exportingPdf ? 'Exportando PDF...' : 'Exportar PDF'}
          </Button>

          {/* Botão Recarregar */}
          <Button
            variant="ghost"
            size="icon"
            onClick={carregarDadosFinanceiros}
            disabled={loading}
            className="h-9 w-9 text-slate-600 hover:text-[#0D47A1]"
            title="Atualizar painel financeiro"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 4 Cards de KPIs no Topo */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total de Proventos */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Total de Proventos
              </span>
              <div className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-black text-emerald-700 font-mono">
                {formatMoedaPtBr(totalProventosMes)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Remunerações e acréscimos do mês selecionado
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Total de Descontos */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Total de Descontos
              </span>
              <div className="h-9 w-9 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center">
                <ArrowDownRight className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-black text-rose-700 font-mono">
                {formatMoedaPtBr(totalDescontosMes)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Deduções e lançamentos de débito da folha
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Valor Líquido da Folha */}
          <Card className="border border-blue-200 bg-blue-50/40 shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0D47A1]">
                Valor Líquido da Folha
              </span>
              <div className="h-9 w-9 rounded-full bg-blue-100 text-[#0D47A1] flex items-center justify-center">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-black text-[#0D47A1] font-mono">
                {formatMoedaPtBr(valorLiquidoMes)}
              </div>
              <p className="text-xs text-blue-900/70 mt-1">
                Custo líquido desembolsado pela empresa
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Saldo Total do Banco de Horas da Empresa */}
          <Card
            className={`border shadow-xs ${
              saldoTotalBancoHorasEmpresa >= 0
                ? 'border-emerald-200 bg-emerald-50/30'
                : 'border-rose-200 bg-rose-50/30'
            }`}
          >
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  saldoTotalBancoHorasEmpresa >= 0 ? 'text-emerald-800' : 'text-rose-800'
                }`}
              >
                Banco de Horas Total
              </span>
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center ${
                  saldoTotalBancoHorasEmpresa >= 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                <Clock className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div
                className={`text-2xl font-black font-mono ${
                  saldoTotalBancoHorasEmpresa >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {saldoTotalBancoHorasEmpresa > 0
                  ? `+${saldoTotalBancoHorasEmpresa.toFixed(1)}h`
                  : `${saldoTotalBancoHorasEmpresa.toFixed(1)}h`}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Saldo acumulado líquido da empresa (fechamentos - compensações)
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grid de Gráficos: Barras (Proventos vs Descontos) + Linha (Evolução 6 meses) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Barras - Proventos vs Descontos por Departamento */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#0D47A1]" />
                  Proventos vs. Descontos por Departamento
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Distribuição orçamentária de folha por centro de custo no mês
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {loading ? (
              <Skeleton className="h-72 w-full rounded-lg" />
            ) : dadosGraficoDepartamentos.length === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-xs">
                <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                Nenhum lançamento registrado para esta competência.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosGraficoDepartamentos}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="departamento"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip
                      formatter={(val: any) => formatMoedaPtBr(Number(val))}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        fontSize: '12px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar
                      dataKey="proventos"
                      name="Proventos (R$)"
                      fill="#0D47A1"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="descontos"
                      name="Descontos (R$)"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Gráfico 2: Linha - Evolução do Valor Líquido nos Últimos 6 Meses com Orçado */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#0D47A1]" />
                  Evolução da Folha &amp; Orçado (6 Meses)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Histórico do valor líquido realizado vs. linha pontilhada de meta orçada
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {loading ? (
              <Skeleton className="h-72 w-full rounded-lg" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dadosEvolucaoUltimos6Meses}
                    margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="competencia"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      height={30}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any) => [formatMoedaPtBr(Number(val)), name]}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        fontSize: '12px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="liquido"
                      name="Valor Líquido Realizado (R$)"
                      stroke="#0D47A1"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#0D47A1' }}
                      activeDot={{ r: 7 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="orcado"
                      name="Meta Orçada (R$)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 4, fill: '#f59e0b' }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="proventos"
                      name="Proventos Brutos (R$)"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      dot={{ r: 3, fill: '#10b981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>{' '}
      </div>

      {/* NOVO PAINEL: Orçado vs. Realizado & Ciclos Futuros (Competência Selecionada + 3 Meses) */}
      <Card className="border border-slate-200 bg-white shadow-xs">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Target className="h-5 w-5 text-[#0D47A1]" />
                Orçado vs. Realizado &amp; Ciclos Futuros
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-blue-50 text-[#0D47A1] border-blue-200 text-xs font-bold"
              >
                Planejamento &amp; Controle
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de metas orçamentárias de folha para o ciclo selecionado e os próximos
              3 meses projetados.
            </CardDescription>
          </div>

          {podeGerenciarOrcamento && (
            <Button
              size="sm"
              onClick={() => abrirModalOrcamento(anoCompetencia, mesCompetencia)}
              className="gap-1.5 bg-[#0D47A1] hover:bg-[#0b3c8a] text-white text-xs font-semibold shrink-0"
            >
              <PlusCircle className="h-4 w-4" />
              Definir / Editar Orçamento
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ciclosOrcadoVsRealizado.map((ciclo) => {
                const temOrcamento = ciclo.orcadoFolha !== undefined
                const temReal = ciclo.temRealizado && ciclo.realizadoFolha !== undefined

                return (
                  <div
                    key={ciclo.competenciaKey}
                    className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                      ciclo.isCompetenciaSelecionada
                        ? 'border-[#0D47A1] bg-blue-50/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Topo do Card de Ciclo */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="font-bold text-xs text-slate-900 capitalize">
                          {ciclo.mesNome} / {ciclo.ano}
                        </span>
                        <div className="flex items-center gap-1">
                          {ciclo.isCompetenciaSelecionada && (
                            <Badge className="bg-[#0D47A1] text-white text-[9px] px-1.5 py-0 h-4 font-bold">
                              Selecionada
                            </Badge>
                          )}
                          {ciclo.isFuturo && (
                            <Badge
                              variant="outline"
                              className="border-purple-300 bg-purple-50 text-purple-700 text-[9px] px-1.5 py-0 h-4 font-semibold"
                            >
                              Previsto
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Valores: Orçado vs Realizado */}
                      <div className="space-y-2.5 my-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Orçado:</span>
                          <span className="font-bold text-slate-800 font-mono">
                            {temOrcamento
                              ? formatMoedaPtBr(ciclo.orcadoFolha || 0)
                              : 'Não cadastrado'}
                          </span>
                        </div>

                        {ciclo.orcadoBanco !== undefined && ciclo.orcadoBanco > 0 && (
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Orçado B. Horas:</span>
                            <span className="font-mono">{formatMoedaPtBr(ciclo.orcadoBanco)}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Realizado:</span>
                          {temReal ? (
                            <span className="font-bold text-slate-900 font-mono">
                              {formatMoedaPtBr(ciclo.realizadoFolha || 0)}
                            </span>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-dashed border-slate-300 text-slate-400 text-[10px] font-normal"
                            >
                              Sem dados
                            </Badge>
                          )}
                        </div>

                        {/* Variação em R$ e % */}
                        {temOrcamento && temReal && (
                          <div
                            className={`p-2 rounded-lg border text-xs mt-2 ${
                              ciclo.estourou
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span>Variação:</span>
                              <span className="font-mono">
                                {ciclo.variacaoRs !== undefined && ciclo.variacaoRs > 0 ? '+' : ''}
                                {formatMoedaPtBr(ciclo.variacaoRs || 0)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-0.5">
                              <span>Desvio %:</span>
                              <span className="font-bold font-mono">
                                {ciclo.variacaoPct !== undefined && ciclo.variacaoPct > 0
                                  ? '+'
                                  : ''}
                                {ciclo.variacaoPct?.toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-[10px] mt-1 font-semibold">
                              {ciclo.estourou
                                ? '⚠ Estourou o orçamento planejado'
                                : '✓ Realizado dentro do orçado'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rodapé do Card com Ação de Edição */}
                    {podeGerenciarOrcamento && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirModalOrcamento(ciclo.ano, ciclo.mes)}
                          className="h-6 px-2 text-[11px] text-[#0D47A1] hover:bg-blue-50 w-full justify-center gap-1 font-semibold"
                        >
                          <Edit2 className="h-3 w-3" />
                          {temOrcamento ? 'Editar Orçado' : 'Cadastrar Orçado'}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid de Painéis: Compensações no Mês + Provisão de Férias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel 1: Compensações no Mês */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#0D47A1]" />
                Compensações no Mês
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Solicitações de folga e impacto em horas no saldo do banco
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="border-slate-300 text-xs font-semibold self-start sm:self-auto"
            >
              Competência {mesesOpcoes.find((m) => m.value === mesCompetencia)?.label}
            </Badge>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {loading ? (
              <Skeleton className="h-40 w-full rounded-lg" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Solicitadas
                    </p>
                    <p className="text-xl font-black text-slate-900 font-mono mt-1">
                      {compensacoesNoMes.horasSolicitadas.toFixed(1)}h
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {compensacoesNoMes.totalItens} solicitação(ões)
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Aprovadas
                    </p>
                    <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                      {compensacoesNoMes.horasAprovadas.toFixed(1)}h
                    </p>
                    <p className="text-[10px] text-emerald-700/80 mt-0.5">
                      {compensacoesNoMes.qtdAprovadas} homologadas
                    </p>
                  </div>

                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                      Recusadas
                    </p>
                    <p className="text-xl font-black text-rose-700 font-mono mt-1">
                      {compensacoesNoMes.horasRecusadas.toFixed(1)}h
                    </p>
                    <p className="text-[10px] text-rose-700/80 mt-0.5">
                      {compensacoesNoMes.qtdRecusadas} rejeitadas
                    </p>
                  </div>
                </div>

                {/* Impacto no banco de horas */}
                <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Impacto em Horas no Banco da Empresa
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Compensações aprovadas reduzem o passivo de horas extras da empresa.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#0D47A1] font-mono">
                      {compensacoesNoMes.impactoHorasBanco.toFixed(1)}h
                    </span>
                    <p className="text-[10px] text-slate-500">debitadas do saldo</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Painel 2: Provisão de Férias (Estimativa simples) */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Palmtree className="h-5 w-5 text-amber-600" />
                  Provisão de Férias (Estimativa)
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-bold"
                >
                  Próximos 90 dias
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Estimativa simples: Remuneração vigente + 1/3 dos colaboradores com prazo concessivo
                a expirar em até 90 dias.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {loading ? (
              <Skeleton className="h-40 w-full rounded-lg" />
            ) : (
              <>
                <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Total Estimado de Desembolso
                    </span>
                    <div className="text-2xl font-black text-amber-950 font-mono mt-0.5">
                      {formatMoedaPtBr(provisaoFeriasProximos90Dias.totalEstimado)}
                    </div>
                    <p className="text-[11px] text-amber-800/90 mt-1">
                      {provisaoFeriasProximos90Dias.qtdColaboradores} colaborador(es) com limite
                      concessivo a vencer nos próximos 90 dias.
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-600 space-y-1">
                    <div>
                      Base salarial:{' '}
                      <strong>{formatMoedaPtBr(provisaoFeriasProximos90Dias.somaSalarios)}</strong>
                    </div>
                    <div>
                      1/3 Constitucional:{' '}
                      <strong>{formatMoedaPtBr(provisaoFeriasProximos90Dias.somaTerco)}</strong>
                    </div>
                  </div>
                </div>

                {/* Nota de conformidade com as restrições da Tesla RH */}
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Aviso Corporativo:</strong> Este cálculo é estritamente uma estimativa
                    gerencial interna (soma da remuneração base e 1/3 constitucional). Não inclui
                    encargos sociais nem guias tributárias (INSS patronal, FGTS ou retenções de
                    IRRF), em conformidade com o escopo do produto.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal para Definir / Editar Orçamento de Competência */}
      <Dialog open={modalOrcamentoAberto} onOpenChange={setModalOrcamentoAberto}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Target className="h-5 w-5 text-[#0D47A1]" />
              Definir Orçamento de Folha
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre a meta orçada de desembolso para a competência{' '}
              <strong>
                {mesesOpcoes.find((m) => m.value === orcamentoEditandoMes)?.label} de{' '}
                {orcamentoEditandoAno}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarOrcamento} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="valorFolha" className="text-xs font-bold text-slate-700">
                Valor Orçado da Folha (R$) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="valorFolha"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formValorFolha}
                onChange={(e) => setFormValorFolha(e.target.value)}
                placeholder="Ex: 48500.00"
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-slate-400">
                Total previsto para o desembolso líquido da folha no mês.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valorBanco" className="text-xs font-semibold text-slate-700">
                Orçado de Banco de Horas (R$) (Opcional)
              </Label>
              <Input
                id="valorBanco"
                type="number"
                step="0.01"
                min="0"
                value={formValorBanco}
                onChange={(e) => setFormValorBanco(e.target.value)}
                placeholder="Ex: 500.00"
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-slate-400">
                Provisão financeira para eventuais pagamentos ou acertos de banco.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs" className="text-xs font-semibold text-slate-700">
                Observações / Justificativa (Opcional)
              </Label>
              <Textarea
                id="obs"
                rows={2}
                value={formObs}
                onChange={(e) => setFormObs(e.target.value)}
                placeholder="Ex: Aprovado no comitê orçamentário anual de 2026."
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOrcamentoAberto(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoOrcamento}
                className="bg-[#0D47A1] hover:bg-[#0b3c8a] text-white text-xs font-semibold gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                {salvandoOrcamento ? 'Salvando...' : 'Salvar Orçamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
