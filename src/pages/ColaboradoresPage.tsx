import React, { useEffect, useState } from 'react'
import {
  Users,
  Search,
  Building,
  Calendar,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Filter,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { colaboradorService } from '@/services/api'
import { Colaborador } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

export default function ColaboradoresPage() {
  const { user } = useAuth()
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDept, setFilterDept] = useState<string>('todos')
  const [filterStatus, setFilterStatus] = useState<string>('todos')

  useEffect(() => {
    async function loadColabs() {
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

    loadColabs()
  }, [user?.tenant_id])

  const departments = Array.from(new Set(colaboradores.map((c) => c.departamento).filter(Boolean)))

  const filtered = colaboradores.filter((c) => {
    const matchesSearch =
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cargo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cpf.includes(searchTerm)

    const matchesDept = filterDept === 'todos' || c.departamento === filterDept
    const matchesStatus = filterStatus === 'todos' || c.status === filterStatus

    return matchesSearch && matchesDept && matchesStatus
  })

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '---'
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR')
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/20 text-xs"
            >
              Gestão de Pessoas
            </Badge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#212121]">
            Colaboradores da Organização
          </h2>
          <p className="text-sm text-[#757575]">
            Lista completa de colaboradores registrados no tenant ativo.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#757575]">
          <span className="font-semibold text-[#0D47A1]">{filtered.length}</span> de{' '}
          <span className="font-medium">{colaboradores.length}</span> registros
        </div>
      </div>

      {/* Filters card */}
      <Card className="border border-[#E0E0E0] bg-white shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#757575]" />
              <Input
                placeholder="Buscar por nome, cargo ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 border-[#E0E0E0]"
              />
            </div>

            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="border-[#E0E0E0]">
                <SelectValue placeholder="Filtrar por departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os departamentos</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="border-[#E0E0E0]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border border-[#E0E0E0] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#FAFAFA]">
              <TableRow className="border-b border-[#E0E0E0]">
                <TableHead className="font-semibold text-xs text-[#212121]">Colaborador</TableHead>
                <TableHead className="font-semibold text-xs text-[#212121]">Departamento</TableHead>
                <TableHead className="font-semibold text-xs text-[#212121]">Cargo</TableHead>
                <TableHead className="font-semibold text-xs text-[#212121]">CPF</TableHead>
                <TableHead className="font-semibold text-xs text-[#212121]">Admissão</TableHead>
                <TableHead className="font-semibold text-xs text-[#212121] text-right">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-6 w-32 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16 bg-slate-100 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-[#757575]">
                    Nenhum colaborador corresponde aos filtros informados.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-[#E0E0E0]">
                          {c.foto_url && <AvatarImage src={c.foto_url} alt={c.nome} />}
                          <AvatarFallback className="bg-[#E8EEF7] text-[#0D47A1] text-xs font-semibold">
                            {c.nome.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-xs md:text-sm text-[#212121]">
                            {c.nome}
                          </p>
                          <p className="text-[11px] text-[#757575] md:hidden">{c.cargo}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-[#212121] font-medium">
                      {c.departamento}
                    </TableCell>

                    <TableCell className="text-xs text-[#757575]">{c.cargo}</TableCell>

                    <TableCell className="text-xs font-mono text-[#757575]">{c.cpf}</TableCell>

                    <TableCell className="text-xs text-[#757575]">
                      {formatDate(c.data_admissao)}
                    </TableCell>

                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium capitalize ${
                          c.status === 'ativo'
                            ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/20'
                            : 'bg-[#FFEBEE] text-[#C62828] border-[#C62828]/20'
                        }`}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
