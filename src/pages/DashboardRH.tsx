import React, { useEffect, useState } from 'react'
import {
  Users,
  UserCheck,
  UserX,
  Building2,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import { useAuth } from '@/context/AuthContext'
import { Link } from 'react-router-dom'
import { FileWarning, ShieldAlert, ArrowRight, FileCheck2 } from 'lucide-react'
import { colaboradorService, documentoService, cienciaDocumentoService } from '@/services/api'
import { Colaborador, Documento, CienciaDocumento } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardRH() {
  const { user } = useAuth()
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [documentosObrigatorios, setDocumentosObrigatorios] = useState<Documento[]>([])
  const [cienciasTenant, setCienciasTenant] = useState<CienciaDocumento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!user?.tenant_id) return
      try {
        setLoading(true)
        const [colabs, docs, ciencias] = await Promise.all([
          colaboradorService.getColaboradores(user.tenant_id),
          documentoService.getDocumentos(user.tenant_id),
          cienciaDocumentoService.getCienciasTenant(user.tenant_id),
        ])
        setColaboradores(colabs)
        setDocumentosObrigatorios(docs.filter((d) => d.obrigatorio && !d.colaborador_id))
        setCienciasTenant(ciencias)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user?.tenant_id])

  // KPIs
  const totalAtivos = colaboradores.filter((c) => c.status === 'ativo').length
  const totalInativos = colaboradores.filter((c) => c.status === 'inativo').length
  const uniqueDepartments = Array.from(
    new Set(colaboradores.map((c) => c.departamento).filter(Boolean)),
  )
  const totalDeptos = uniqueDepartments.length

  // Chart 1: Distribution by Department
  const deptDataMap: Record<string, number> = {}
  colaboradores.forEach((c) => {
    const dept = c.departamento || 'Não atribuído'
    deptDataMap[dept] = (deptDataMap[dept] || 0) + 1
  })

  const departmentChartData = Object.entries(deptDataMap).map(([name, count]) => ({
    departamento: name,
    total: count,
  }))

  // Chart 2: Distribution by Status
  const statusChartData = [
    { name: 'Ativos', value: totalAtivos, color: '#0D47A1' },
    { name: 'Inativos', value: totalInativos, color: '#C62828' },
  ]

  // Colorful palette per requirement
  const departmentColors = ['#0D47A1', '#1565C0', '#42A5F5', '#90CAF9', '#6A1B9A', '#00897B']

  // Cálculo do KPI de Conformidade / Pessoas sem Ciência na Versão Atual
  const kpiCienciasPorDoc = documentosObrigatorios.map((doc) => {
    const versaoDoc = (doc.versao || '1.0').trim()
    // Identifica quais colaboradores ativos deram ciência nesta versão específica
    const colabsCientesSet = new Set(
      cienciasTenant
        .filter(
          (c) =>
            c.documento_id === doc.id &&
            (c.versao_ciente || '').trim() === versaoDoc &&
            colaboradores.some(
              (colab) => colab.id === c.colaborador_id && colab.status === 'ativo',
            ),
        )
        .map((c) => c.colaborador_id),
    )

    const totalCientes = colabsCientesSet.size
    const semCiencia = Math.max(0, totalAtivos - totalCientes)
    const taxaAdesao = totalAtivos > 0 ? Math.round((totalCientes / totalAtivos) * 100) : 100

    return {
      doc,
      totalCientes,
      semCiencia,
      taxaAdesao,
      versaoDoc,
    }
  })

  // Ordena pelo que tem maior número de pessoas sem ciência (mais urgente)
  const docsMaisPendentes = [...kpiCienciasPorDoc].sort((a, b) => b.semCiencia - a.semCiencia)
  const principalPendente = docsMaisPendentes[0]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#212121]">
            Dashboard de Recursos Humanos
          </h2>
          <p className="text-sm text-[#757575]">
            Métricas organizacionais e visão geral do quadro funcional da Tesla RH.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-[#E0F2F1] text-[#00695C] border-[#00695C]/30 text-xs px-3 py-1 font-semibold"
          >
            Visão Geral RH
          </Badge>
        </div>
      </div>

      {/* Bloco de KPI de Conformidade: Pessoas sem Ciência de Documentos Obrigatórios */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-bold text-[#212121]">
              Conformidade e Ciência de Documentos
            </h3>
          </div>
          <Link
            to="/documentos"
            className="text-xs text-[#0D47A1] font-semibold hover:underline flex items-center gap-1"
          >
            Gerenciar no Módulo Documentos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : kpiCienciasPorDoc.length === 0 ? (
          <Card className="border border-[#E0E0E0] bg-white p-4 text-center">
            <p className="text-xs text-[#757575]">
              Nenhum documento corporativo obrigatório cadastrado no momento.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpiCienciasPorDoc.map((item) => (
              <Card
                key={item.doc.id}
                className={`border transition-all shadow-xs bg-white ${
                  item.semCiencia > 0
                    ? 'border-amber-300 hover:border-amber-400'
                    : 'border-emerald-200 hover:border-emerald-300'
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-[#0D47A1] bg-[#E8EEF7] px-2 py-0.5 rounded">
                        Versão {item.versaoDoc}
                      </span>
                      <h4 className="text-sm font-bold text-[#212121] leading-snug line-clamp-1 mt-1">
                        {item.doc.nome}
                      </h4>
                    </div>
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        item.semCiencia > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-[#2E7D32]'
                      }`}
                    >
                      {item.semCiencia > 0 ? (
                        <FileWarning className="h-4 w-4" />
                      ) : (
                        <FileCheck2 className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  {/* Texto do KPI solicitado: "X pessoas sem ciência do [nome do documento]" */}
                  <div className="bg-[#FAFAFA] rounded-lg p-2.5 border border-[#F0F0F0] flex items-baseline justify-between">
                    <div>
                      <span className="text-xs text-[#757575] font-medium block">
                        Status de Ciência:
                      </span>
                      <p className="text-sm font-extrabold text-[#212121]">
                        {item.semCiencia === 0 ? (
                          <span className="text-[#2E7D32]">Todos cientes</span>
                        ) : (
                          <span className="text-amber-800">
                            <strong className="text-base text-amber-900">{item.semCiencia}</strong>{' '}
                            {item.semCiencia === 1 ? 'pessoa sem ciência' : 'pessoas sem ciência'}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-[#757575]">
                        {item.taxaAdesao}% cientes
                      </span>
                      <span className="block text-[10px] text-[#9E9E9E]">
                        {item.totalCientes} de {totalAtivos} ativos
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Colaboradores */}
        <Card className="border border-[#E0E0E0] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#757575]">
              Total de Colaboradores
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1]">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20 bg-slate-200" />
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-[#212121]">
                  {colaboradores.length}
                </div>
                <p className="text-xs text-[#757575] mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-[#2E7D32]" /> Base total cadastrada no tenant
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Ativos */}
        <Card className="border border-[#E0E0E0] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#757575]">
              Colaboradores Ativos
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20 bg-slate-200" />
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-[#2E7D32]">{totalAtivos}</div>
                <p className="text-xs text-[#757575] mt-1">
                  {colaboradores.length > 0
                    ? `${Math.round((totalAtivos / colaboradores.length) * 100)}% da força de trabalho`
                    : '100%'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Inativos */}
        <Card className="border border-[#E0E0E0] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#757575]">
              Colaboradores Inativos
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-[#FFEBEE] flex items-center justify-center text-[#C62828]">
              <UserX className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20 bg-slate-200" />
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-[#C62828]">{totalInativos}</div>
                <p className="text-xs text-[#757575] mt-1">Desligados ou suspensos</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Departamentos */}
        <Card className="border border-[#E0E0E0] bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#757575]">
              Departamentos Distintos
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-[#F3E5F5] flex items-center justify-center text-[#6A1B9A]">
              <Building2 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20 bg-slate-200" />
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-[#6A1B9A]">{totalDeptos}</div>
                <p className="text-xs text-[#757575] mt-1">Áreas corporativas ativas</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recharts Graphics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Bar Chart: By Department */}
        <Card className="lg:col-span-2 border border-[#E0E0E0] bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#0D47A1]" />
              Distribuição por Departamento
            </CardTitle>
            <CardDescription className="text-xs text-[#757575]">
              Total de colaboradores alocados em cada área da organização
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-full w-full bg-slate-100" />
              </div>
            ) : departmentChartData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-[#757575]">
                Nenhum dado departamental disponível.
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentChartData}
                    margin={{ top: 20, right: 30, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEEEE" />
                    <XAxis
                      dataKey="departamento"
                      tick={{ fill: '#757575', fontSize: 12 }}
                      interval={0}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#757575', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E0E0E0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        fontSize: '12px',
                      }}
                      formatter={(val: unknown) => [`${Number(val)} colaboradores`, 'Total']}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={55}>
                      {departmentChartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={departmentColors[index % departmentColors.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution Pie Chart */}
        <Card className="border border-[#E0E0E0] bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-[#0D47A1]" />
              Distribuição por Status
            </CardTitle>
            <CardDescription className="text-xs text-[#757575]">
              Proporção de colaboradores ativos vs inativos
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col items-center justify-center">
            {loading ? (
              <div className="h-[280px] w-full flex items-center justify-center">
                <Skeleton className="h-48 w-48 rounded-full bg-slate-100" />
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`status-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E0E0E0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (
                        <span className="text-xs text-[#212121] font-medium">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
