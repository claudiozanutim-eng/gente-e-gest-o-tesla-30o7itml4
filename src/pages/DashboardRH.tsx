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
import { colaboradorService } from '@/services/api'
import { Colaborador } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardRH() {
  const { user } = useAuth()
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!user?.tenant_id) return
      try {
        setLoading(true)
        const data = await colaboradorService.getColaboradores(user.tenant_id)
        setColaboradores(data)
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
