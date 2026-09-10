import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Clock,
  LogIn,
  LogOut,
  Coffee,
  CheckCircle2,
  Calendar,
  AlertCircle,
  RefreshCw,
  FileText,
  CalendarDays,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { pontoService, escalaService, DiaEspelhoPonto } from '@/services/pontoService'
import { atestadoService, feriasService } from '@/services/api'
import {
  RegistroPonto,
  RegistroPontoTipo,
  EscalaTrabalho,
  Atestado,
  SolicitacaoFerias,
  REGISTRO_PONTO_CONFIG,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function MeuPontoPage() {
  const { user, colaborador } = useAuth()
  const { toast } = useToast()
  const tenantId = user?.tenant_id
  const colaboradorId = colaborador?.id

  // Relógio digital em tempo real
  const [horaAtual, setHoraAtual] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [registrandoTipo, setRegistrandoTipo] = useState<RegistroPontoTipo | null>(null)
  const [registrosHoje, setRegistrosHoje] = useState<RegistroPonto[]>([])
  const [registrosMes, setRegistrosMes] = useState<RegistroPonto[]>([])
  const [escala, setEscala] = useState<EscalaTrabalho | null>(null)
  const [atestados, setAtestados] = useState<Atestado[]>([])
  const [feriasAprovadas, setFeriasAprovadas] = useState<SolicitacaoFerias[]>([])

  // Navegação de mês no espelho
  const [mesAtual, setMesAtual] = useState(() => {
    const d = new Date()
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })

  // Carregar dados
  const carregarDados = useCallback(async () => {
    if (!tenantId || !colaboradorId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const [regsHoje, escalaRes, atestsRes, regsMesRes, feriasRes] = await Promise.all([
        pontoService.getRegistrosDoDia(tenantId, colaboradorId, new Date()),
        escalaService.getEscalaAtivaColaborador(tenantId, colaboradorId),
        atestadoService.getAtestadosColaborador(tenantId, colaboradorId),
        pontoService.getRegistrosMes(tenantId, colaboradorId, mesAtual.ano, mesAtual.mes),
        feriasService.listarSolicitacoes({
          tenantId,
          colaboradorId,
          status: 'aprovada',
        }),
      ])

      setRegistrosHoje(regsHoje)
      if (escalaRes) {
        setEscala(escalaRes.escala)
      }
      setAtestados(atestsRes)
      setRegistrosMes(regsMesRes)
      setFeriasAprovadas(feriasRes)
    } catch (err) {
      console.error('Erro ao carregar dados do ponto:', err)
      toast({
        title: 'Erro ao carregar registros de ponto',
        description: 'Não foi possível buscar seu histórico e escala de trabalho.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, colaboradorId, mesAtual.ano, mesAtual.mes, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Realizar batida de ponto
  const handleBaterPonto = async (tipo: RegistroPontoTipo) => {
    if (!tenantId || !colaboradorId) return

    const config = REGISTRO_PONTO_CONFIG[tipo]
    try {
      setRegistrandoTipo(tipo)
      const novoRegistro = await pontoService.registrarPonto({
        tenant_id: tenantId,
        colaborador_id: colaboradorId,
        tipo,
        origem: 'web',
      })

      const d = new Date(novoRegistro.data_hora)
      const horaFormatada = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

      toast({
        title: `Registro de ${config.label} efetuado`,
        description: `Batida gravada com horário oficial do servidor às ${horaFormatada}.`,
        className: 'border-emerald-500 bg-emerald-50 text-emerald-900',
      })

      // Atualiza listagem de hoje e do mês
      const [novosHoje, novosMes] = await Promise.all([
        pontoService.getRegistrosDoDia(tenantId, colaboradorId, new Date()),
        pontoService.getRegistrosMes(tenantId, colaboradorId, mesAtual.ano, mesAtual.mes),
      ])
      setRegistrosHoje(novosHoje)
      setRegistrosMes(novosMes)
    } catch (err: unknown) {
      console.error('Erro ao bater ponto:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao registrar batida de ponto.'
      toast({
        title: 'Não foi possível registrar o ponto',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setRegistrandoTipo(null)
    }
  }

  // Próxima batida recomendada
  const proximaBatidaSugerida = useMemo<RegistroPontoTipo>(() => {
    const tiposHoje = registrosHoje.map((r) => r.tipo)
    if (!tiposHoje.includes('entrada')) return 'entrada'
    if (!tiposHoje.includes('saida_almoco')) return 'saida_almoco'
    if (!tiposHoje.includes('volta_almoco')) return 'volta_almoco'
    return 'saida'
  }, [registrosHoje])

  // Total de horas trabalhadas hoje
  const totalHorasHojeMs = useMemo(() => {
    return pontoService.calcularHorasDia(registrosHoje)
  }, [registrosHoje])

  // Espelho de ponto completo do mês selecionado
  const espelhoMes = useMemo<DiaEspelhoPonto[]>(() => {
    return pontoService.construirEspelhoMensal(
      mesAtual.ano,
      mesAtual.mes,
      registrosMes,
      escala || undefined,
      atestados,
      colaborador || undefined,
      feriasAprovadas,
    )
  }, [mesAtual.ano, mesAtual.mes, registrosMes, escala, atestados, colaborador, feriasAprovadas])

  // Totais do mês
  const metricasMes = useMemo(() => {
    let totalMs = 0
    let diasTrabalhados = 0
    let diasAtestado = 0
    let saldoTotalMs = 0

    espelhoMes.forEach((dia) => {
      if (dia.totalHorasMs > 0) {
        totalMs += dia.totalHorasMs
        diasTrabalhados++
      }
      if (dia.ausenciaTipo === 'atestado') {
        diasAtestado++
      }
      if (!dia.isFuturo && dia.isDiaEscalado) {
        saldoTotalMs += dia.saldoMs
      }
    })

    return {
      totalMs,
      totalFormatado: pontoService.formatarHorasMinutos(totalMs),
      diasTrabalhados,
      diasAtestado,
      saldoTotalMs,
      saldoTotalFormatado:
        saldoTotalMs >= 0
          ? `+${pontoService.formatarHorasMinutos(saldoTotalMs)}`
          : `-${pontoService.formatarHorasMinutos(Math.abs(saldoTotalMs))}`,
    }
  }, [espelhoMes])

  const nomeMesExtenso = useMemo(() => {
    const d = new Date(mesAtual.ano, mesAtual.mes, 1)
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }, [mesAtual])

  const mudarMes = (direcao: number) => {
    setMesAtual((prev) => {
      const novaData = new Date(prev.ano, prev.mes + direcao, 1)
      return { ano: novaData.getFullYear(), mes: novaData.getMonth() }
    })
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Meu Ponto Eletrônico
              </h1>
              <p className="text-xs text-[#757575] mt-0.5">
                Registre suas batidas diárias com horário oficial de servidor e consulte seu espelho
                mensal.
              </p>
            </div>
          </div>
        </div>

        {/* Status da Escala Atual */}
        <div className="flex items-center gap-3">
          {escala ? (
            <div className="flex items-center gap-2 bg-white border border-[#E0E0E0] rounded-lg px-3 py-1.5 shadow-2xs">
              <CalendarDays className="h-4 w-4 text-[#0D47A1]" />
              <div className="text-left">
                <p className="text-[10px] text-[#757575] font-semibold uppercase">Escala Vigente</p>
                <p className="text-xs font-bold text-[#212121]">
                  {escala.nome} ({escala.horario_inicio} às {escala.horario_fim})
                </p>
              </div>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="bg-slate-50 text-slate-600 border-slate-300 text-xs"
            >
              Sem escala vinculada
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="h-8 text-xs border-[#E0E0E0] gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* 2. Área Principal: Relógio Oficial + Botões Grandes de Batida */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel de Horário e Batidas */}
        <Card className="lg:col-span-2 border border-[#E0E0E0] bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-[#F0F0F0]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121]">
                  Registro de Ponto Digital
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Data e hora sincronizadas em tempo real com o servidor seguro Tesla RH
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs font-semibold gap-1"
              >
                <ShieldCheck className="h-3 w-3" />
                Sincronizado
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Relógio Grande */}
            <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#F5F8FC] to-white rounded-2xl border border-[#E3EDF8] shadow-inner text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-[#0D47A1]">
                {horaAtual.toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <div className="text-5xl sm:text-6xl font-extrabold tracking-tight text-[#0D47A1] font-mono my-2">
                {horaAtual.toLocaleTimeString('pt-BR')}
              </div>
              <p className="text-[11px] text-[#757575] flex items-center gap-1">
                <span>Horário Oficial de Brasília (Servidor)</span>
                <span>•</span>
                <span className="font-semibold text-emerald-700">
                  Bloqueio anti-duplicidade &lt;60s ativo
                </span>
              </p>
            </div>

            {/* 4 Botões Grandes com cores distintas e ícones */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#616161] mb-3">
                Selecione o tipo de registro:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Entrada */}
                <Button
                  onClick={() => handleBaterPonto('entrada')}
                  disabled={registrandoTipo !== null}
                  className={`h-24 flex flex-col items-center justify-center gap-2 rounded-xl text-white font-bold transition-transform active:scale-95 shadow-md ${
                    REGISTRO_PONTO_CONFIG.entrada.btnClass
                  } ${proximaBatidaSugerida === 'entrada' ? 'ring-4 ring-emerald-300 ring-offset-2' : ''}`}
                >
                  <LogIn className="h-6 w-6" />
                  <div className="text-center">
                    <span className="block text-sm leading-tight">Entrada</span>
                    <span className="text-[10px] font-normal opacity-90">Início da jornada</span>
                  </div>
                </Button>

                {/* 2. Saída Almoço */}
                <Button
                  onClick={() => handleBaterPonto('saida_almoco')}
                  disabled={registrandoTipo !== null}
                  className={`h-24 flex flex-col items-center justify-center gap-2 rounded-xl text-white font-bold transition-transform active:scale-95 shadow-md ${
                    REGISTRO_PONTO_CONFIG.saida_almoco.btnClass
                  } ${proximaBatidaSugerida === 'saida_almoco' ? 'ring-4 ring-amber-300 ring-offset-2' : ''}`}
                >
                  <Coffee className="h-6 w-6" />
                  <div className="text-center">
                    <span className="block text-sm leading-tight">Saída Almoço</span>
                    <span className="text-[10px] font-normal opacity-90">Intervalo</span>
                  </div>
                </Button>

                {/* 3. Volta Almoço */}
                <Button
                  onClick={() => handleBaterPonto('volta_almoco')}
                  disabled={registrandoTipo !== null}
                  className={`h-24 flex flex-col items-center justify-center gap-2 rounded-xl text-white font-bold transition-transform active:scale-95 shadow-md ${
                    REGISTRO_PONTO_CONFIG.volta_almoco.btnClass
                  } ${proximaBatidaSugerida === 'volta_almoco' ? 'ring-4 ring-sky-300 ring-offset-2' : ''}`}
                >
                  <Coffee className="h-6 w-6 rotate-180" />
                  <div className="text-center">
                    <span className="block text-sm leading-tight">Volta Almoço</span>
                    <span className="text-[10px] font-normal opacity-90">Retorno</span>
                  </div>
                </Button>

                {/* 4. Saída */}
                <Button
                  onClick={() => handleBaterPonto('saida')}
                  disabled={registrandoTipo !== null}
                  className={`h-24 flex flex-col items-center justify-center gap-2 rounded-xl text-white font-bold transition-transform active:scale-95 shadow-md ${
                    REGISTRO_PONTO_CONFIG.saida.btnClass
                  } ${proximaBatidaSugerida === 'saida' ? 'ring-4 ring-rose-300 ring-offset-2' : ''}`}
                >
                  <LogOut className="h-6 w-6" />
                  <div className="text-center">
                    <span className="block text-sm leading-tight">Saída</span>
                    <span className="text-[10px] font-normal opacity-90">Fim da jornada</span>
                  </div>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Histórico do Dia */}
        <Card className="border border-[#E0E0E0] bg-white shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-[#F0F0F0]">
            <CardTitle className="text-base font-bold text-[#212121]">Histórico de Hoje</CardTitle>
            <CardDescription className="text-xs text-[#757575]">
              Registros já efetuados na data corrente
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 flex-1">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : registrosHoje.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#E0E0E0] rounded-xl bg-[#FAFAFA]">
                <Clock className="h-8 w-8 text-[#9E9E9E] mb-2" />
                <p className="text-xs font-semibold text-[#616161]">
                  Nenhuma batida registrada hoje
                </p>
                <p className="text-[11px] text-[#9E9E9E] mt-0.5">
                  Clique no botão &quot;Entrada&quot; para iniciar sua jornada.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {registrosHoje.map((reg) => {
                  const cfg = REGISTRO_PONTO_CONFIG[reg.tipo]
                  const d = new Date(reg.data_hora)
                  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

                  return (
                    <div
                      key={reg.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA]"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cfg.corHex }}
                        />
                        <div>
                          <p className="text-xs font-bold text-[#212121]">{cfg.label}</p>
                          <p className="text-[10px] text-[#757575]">
                            Origem: {reg.origem || 'Web'}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-extrabold font-mono text-[#0D47A1]">
                        {hhmm}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>

          {/* Resumo do dia */}
          <div className="p-4 border-t border-[#F0F0F0] bg-[#FAFAFA] rounded-b-xl">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#616161] font-medium">Total trabalhado hoje:</span>
              <span className="font-extrabold text-[#0D47A1] text-sm">
                {pontoService.formatarHorasMinutos(totalHorasHojeMs)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Espelho de Ponto Mensal */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs">
        <CardHeader className="pb-3 border-b border-[#F0F0F0]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#0D47A1]" />
                Espelho de Ponto Mensal
              </CardTitle>
              <CardDescription className="text-xs text-[#757575]">
                Todos os registros do mês, cálculo de horas trabalhadas e ausências integradas
              </CardDescription>
            </div>

            {/* Controles de navegação de mês */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => mudarMes(-1)}
                className="h-8 w-8 border-[#E0E0E0]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-bold text-[#212121] capitalize min-w-[140px] text-center">
                {nomeMesExtenso}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => mudarMes(1)}
                className="h-8 w-8 border-[#E0E0E0]"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* KPIs do Mês */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-[#F0F0F0] bg-[#FAFAFA]">
          <div className="bg-white p-3 rounded-lg border border-[#E0E0E0]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#757575]">
              Horas Trabalhadas
            </span>
            <div className="text-xl font-extrabold text-[#0D47A1] mt-0.5">
              {metricasMes.totalFormatado}
            </div>
            <p className="text-[10px] text-[#757575]">
              {metricasMes.diasTrabalhados} dias com batida
            </p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#E0E0E0]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#757575]">
              Saldo do Período
            </span>
            <div
              className={`text-xl font-extrabold mt-0.5 ${
                metricasMes.saldoTotalMs >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {metricasMes.saldoTotalFormatado}
            </div>
            <p className="text-[10px] text-[#757575]">Estimativa vs Escala</p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#E0E0E0]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#757575]">
              Ausências Justificadas
            </span>
            <div className="text-xl font-extrabold text-[#212121] mt-0.5">
              {metricasMes.diasAtestado}
            </div>
            <p className="text-[10px] text-[#757575]">Atestados homologados</p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#E0E0E0]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#757575]">
              Jornada Contratual
            </span>
            <div className="text-xl font-extrabold text-[#212121] mt-0.5">
              {escala ? `${escala.horario_inicio}–${escala.horario_fim}` : '44h sem'}
            </div>
            <p className="text-[10px] text-[#757575]">{escala?.nome || 'Padrão CLT'}</p>
          </div>
        </div>

        {/* Tabela do Espelho */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA] text-[#757575] font-semibold uppercase text-[10px]">
                  <th className="py-2.5 pl-4">Data</th>
                  <th className="py-2.5">Dia</th>
                  <th className="py-2.5 text-center">Entrada</th>
                  <th className="py-2.5 text-center">Saída Almoço</th>
                  <th className="py-2.5 text-center">Volta Almoço</th>
                  <th className="py-2.5 text-center">Saída</th>
                  <th className="py-2.5 text-center">Total Horas</th>
                  <th className="py-2.5 text-center">Saldo</th>
                  <th className="py-2.5 pr-4 text-right">Observação / Ocorrência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F5]">
                {espelhoMes.map((dia) => {
                  const isFolga = dia.ausenciaTipo === 'folga'
                  const isAtestado = dia.ausenciaTipo === 'atestado'
                  const isFerias = dia.ausenciaTipo === 'ferias'

                  return (
                    <tr
                      key={dia.dataIso}
                      className={`hover:bg-[#FAFAFA] transition-colors ${
                        dia.isHoje
                          ? 'bg-blue-50/40 font-semibold'
                          : dia.isFimDeSemana
                            ? 'bg-[#FAFAFA]/60 text-[#757575]'
                            : ''
                      }`}
                    >
                      <td className="py-2.5 pl-4 font-mono font-medium text-[#212121]">
                        {String(dia.diaNumero).padStart(2, '0')}/
                        {String(mesAtual.mes + 1).padStart(2, '0')}
                      </td>

                      <td className="py-2.5 font-medium text-[#616161]">
                        {dia.diaSemanaLabel}
                        {dia.isHoje && (
                          <Badge className="ml-1.5 bg-[#0D47A1] text-white text-[9px] py-0 px-1">
                            Hoje
                          </Badge>
                        )}
                      </td>

                      {/* Batidas ou Badge de Ausência */}
                      {isAtestado ? (
                        <td colSpan={4} className="py-2.5 text-center">
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-bold"
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Atestado Médico Validado
                          </Badge>
                        </td>
                      ) : isFerias ? (
                        <td colSpan={4} className="py-2.5 text-center">
                          <Badge
                            variant="outline"
                            className="bg-purple-50 text-purple-800 border-purple-300 text-[10px] font-bold"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Férias Aprovadas
                          </Badge>
                        </td>
                      ) : isFolga ? (
                        <td colSpan={4} className="py-2.5 text-center text-[11px] text-[#9E9E9E]">
                          Folga semanal
                        </td>
                      ) : (
                        <>
                          <td className="py-2.5 text-center font-mono font-medium text-[#212121]">
                            {dia.entrada || '—'}
                          </td>
                          <td className="py-2.5 text-center font-mono font-medium text-[#212121]">
                            {dia.saidaAlmoco || '—'}
                          </td>
                          <td className="py-2.5 text-center font-mono font-medium text-[#212121]">
                            {dia.voltaAlmoco || '—'}
                          </td>
                          <td className="py-2.5 text-center font-mono font-medium text-[#212121]">
                            {dia.saida || '—'}
                          </td>
                        </>
                      )}

                      {/* Total Horas */}
                      <td className="py-2.5 text-center font-semibold font-mono text-[#0D47A1]">
                        {dia.totalHorasMs > 0 ? dia.totalHorasFormatadas : '—'}
                      </td>

                      {/* Saldo */}
                      <td className="py-2.5 text-center font-mono text-[11px]">
                        {dia.isDiaEscalado && !dia.isFuturo && !dia.ausenciaTipo ? (
                          <span
                            className={
                              dia.saldoMs > 0
                                ? 'text-emerald-700 font-bold'
                                : dia.saldoMs < 0
                                  ? 'text-rose-700 font-bold'
                                  : 'text-[#757575]'
                            }
                          >
                            {dia.saldoFormatado}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Ocorrências */}
                      <td className="py-2.5 pr-4 text-right">
                        {dia.irregularidades.length > 0 ? (
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {dia.irregularidades.map((irr, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-[9px] bg-rose-50 text-rose-700 border-rose-300"
                              >
                                {irr}
                              </Badge>
                            ))}
                          </div>
                        ) : dia.ausenciaDetalhe ? (
                          <span className="text-[11px] text-[#757575]">{dia.ausenciaDetalhe}</span>
                        ) : dia.totalHorasMs > 0 ? (
                          <span className="text-[11px] text-emerald-700 font-medium">
                            Jornada Regular
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#9E9E9E]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
