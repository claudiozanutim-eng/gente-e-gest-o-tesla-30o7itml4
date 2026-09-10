import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  ShieldAlert,
  Info,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BancoHorasFechamento } from '@/types'
import { bancoHorasService } from '@/services/bancoHorasService'
import { formatDataPtBr } from '@/lib/exportReports'

export const BancoHorasColaboradorPage: React.FC = () => {
  const { user, colaborador } = useAuth()
  const [fechamentos, setFechamentos] = useState<BancoHorasFechamento[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const carregarFechamentos = useCallback(async () => {
    if (!user?.tenant_id || !colaborador?.id) return
    setLoading(true)
    try {
      const lista = await bancoHorasService.getFechamentosColaborador(
        user.tenant_id,
        colaborador.id,
      )
      setFechamentos(lista)
    } catch (err) {
      console.error('Erro ao buscar fechamentos de banco de horas:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.tenant_id, colaborador?.id])

  useEffect(() => {
    carregarFechamentos()
  }, [carregarFechamentos])

  // Cálculo do saldo acumulado baseado nos fechamentos mensais homologados
  const { saldoAcumuladoMs, totalTrabalhadasMs, totalEscaladasMs } = useMemo(() => {
    let acum = 0
    let trab = 0
    let esc = 0
    fechamentos.forEach((f) => {
      acum += f.saldo_ms
      trab += f.horas_trabalhadas_ms
      esc += f.horas_escaladas_ms
    })
    return {
      saldoAcumuladoMs: acum,
      totalTrabalhadasMs: trab,
      totalEscaladasMs: esc,
    }
  }, [fechamentos])

  // Tabela acumulada linha a linha (da mais antiga para a mais recente para acumular corretamente)
  const fechamentosComAcumulado = useMemo(() => {
    const ordenadoCronologico = [...fechamentos].sort((a, b) =>
      a.competencia.localeCompare(b.competencia),
    )
    let saldoCorrido = 0
    const mapaAcumulado = new Map<string, number>()

    ordenadoCronologico.forEach((f) => {
      saldoCorrido += f.saldo_ms
      mapaAcumulado.set(f.id, saldoCorrido)
    })

    // Retorna na ordem decrescente de exibição com o saldo acumulado naquele ponto
    return fechamentos.map((f) => ({
      ...f,
      saldoAcumuladoAteMesMs: mapaAcumulado.get(f.id) || f.saldo_ms,
    }))
  }, [fechamentos])

  const isSaldoPositivo = saldoAcumuladoMs >= 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Clock className="h-6 w-6 text-[#0D47A1]" />
            Banco de Horas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe o saldo consolidado de suas horas trabalhadas, apurações e fechamentos mensais
            homologados pelo RH.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={carregarFechamentos}
          disabled={loading}
          className="self-start sm:self-auto gap-2 border-slate-300 text-slate-700 hover:text-[#0D47A1]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards de Métricas Principais */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Saldo Acumulado Atual (Verde Positivo / Vermelho Negativo) */}
          <Card
            className={`border-2 shadow-xs transition-colors ${
              isSaldoPositivo
                ? 'border-emerald-200 bg-linear-to-br from-emerald-50/70 to-white'
                : 'border-rose-200 bg-linear-to-br from-rose-50/70 to-white'
            }`}
          >
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isSaldoPositivo ? 'text-emerald-800' : 'text-rose-800'
                }`}
              >
                Saldo Acumulado Consolidado
              </span>
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center ${
                  isSaldoPositivo ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {isSaldoPositivo ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div
                className={`text-3xl font-black font-mono tracking-tight ${
                  isSaldoPositivo ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {bancoHorasService.formatarSaldoMs(saldoAcumuladoMs)}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                {isSaldoPositivo ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Crédito disponível para compensação</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                    <span>Horas em débito a compensar</span>
                  </>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Total de Horas Trabalhadas */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Horas Trabalhadas (Fechadas)
              </span>
              <div className="h-9 w-9 rounded-full bg-blue-50 text-[#0D47A1] flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {bancoHorasService.formatarHorasMs(totalTrabalhadasMs)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Soma de todas as jornadas apuradas nos meses fechados
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Total de Horas Escaladas / Esperadas */}
          <Card className="border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Horas Previstas em Escala
              </span>
              <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {bancoHorasService.formatarHorasMs(totalEscaladasMs)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Jornada contratual esperada para as competências
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Fechamentos Mensais */}
      <Card className="border border-slate-200 bg-white shadow-xs">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#0D47A1]" />
              <CardTitle className="text-base font-bold text-slate-900">
                Histórico de Fechamentos Mensais
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-blue-50 text-[#0D47A1] border-blue-200 text-xs font-semibold"
              >
                {fechamentos.length} {fechamentos.length === 1 ? 'competência' : 'competências'}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Saldos mensais congelados pelo Recursos Humanos após apuração do espelho de ponto.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : fechamentosComAcumulado.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="h-12 w-12 rounded-full bg-blue-50 text-[#0D47A1] flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-sm font-semibold text-slate-900">Nenhum mês fechado ainda</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Assim que o departamento de RH consolidar o fechamento de uma competência mensal,
                  o extrato detalhado e o saldo acumulado aparecerão nesta listagem.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Competência
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-right">
                    Trabalhadas
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-right">
                    Escaladas
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-right">
                    Saldo do Mês
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-right">
                    Saldo Acumulado
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3 text-center">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Fechamento em
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-900 py-3">
                    Observação RH
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fechamentosComAcumulado.map((item) => {
                  const saldoMesPositivo = item.saldo_ms >= 0
                  const saldoAcumPositivo = item.saldoAcumuladoAteMesMs >= 0

                  return (
                    <TableRow
                      key={item.id}
                      className="text-xs border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
                    >
                      <TableCell className="font-bold text-slate-900 py-3.5 flex items-center gap-1.5">
                        <Lock className="h-3 w-3 text-slate-400" />
                        <span>{bancoHorasService.formatarCompetenciaLabel(item.competencia)}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-normal">
                          ({item.competencia})
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-slate-700 text-right py-3.5">
                        {bancoHorasService.formatarHorasMs(item.horas_trabalhadas_ms)}
                      </TableCell>
                      <TableCell className="font-mono text-slate-700 text-right py-3.5">
                        {bancoHorasService.formatarHorasMs(item.horas_escaladas_ms)}
                      </TableCell>
                      <TableCell
                        className={`font-mono font-bold text-right py-3.5 ${
                          saldoMesPositivo ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {bancoHorasService.formatarSaldoMs(item.saldo_ms)}
                      </TableCell>
                      <TableCell
                        className={`font-mono font-black text-right py-3.5 ${
                          saldoAcumPositivo ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {bancoHorasService.formatarSaldoMs(item.saldoAcumuladoAteMesMs)}
                      </TableCell>
                      <TableCell className="text-center py-3.5">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold"
                        >
                          Fechado
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 font-mono text-[11px] py-3.5">
                        {formatDataPtBr(item.data_fechamento)}
                      </TableCell>
                      <TableCell className="text-slate-600 max-w-xs truncate py-3.5">
                        {item.comentario_rh || <span className="text-slate-400 italic">—</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Placeholder discreto para compensação de saldo futuro */}
      <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-600 flex items-start gap-3">
        <Info className="h-5 w-5 text-[#0D47A1] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-900">
            Compensação de Banco de Horas (Planejada para próxima fase)
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            A solicitação direta de folgas compensatórias e o abatimento automático de banco de
            horas estarão integrados nas próximas etapas da plataforma. Os saldos apresentados acima
            são oficiais e homologados pelo fechamento mensal do RH.
          </p>
        </div>
      </div>
    </div>
  )
}
export default BancoHorasColaboradorPage
