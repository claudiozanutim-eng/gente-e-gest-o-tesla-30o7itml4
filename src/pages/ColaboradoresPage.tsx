import React, { useEffect, useState, useMemo } from 'react'
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Building2,
  Briefcase,
  Calendar,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Layers,
  ArrowUpDown,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import { colaboradorService } from '@/services/api'
import { Colaborador } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import { FichaColaboradorModal } from '@/components/colaboradores/FichaColaboradorModal'

function formatarDataBR(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return dateStr
  }
}

function getIniciais(nome?: string): string {
  if (!nome) return 'CO'
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return 'CO'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export default function ColaboradoresPage() {
  const { user } = useAuth()
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<
    'todos' | 'ativo' | 'inativo' | 'afastado' | 'ferias'
  >('todos')
  const [departamentoFilter, setDepartamentoFilter] = useState<string>('todos')

  // Modal Ficha Completa
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null)
  const [fichaModalOpen, setFichaModalOpen] = useState<boolean>(false)

  const handleColaboradorAtualizado = (colabAtualizado: Colaborador) => {
    setColaboradores((prev) => prev.map((c) => (c.id === colabAtualizado.id ? colabAtualizado : c)))
    setSelectedColaborador(colabAtualizado)
  }

  const carregarColaboradores = async (showLoadingState = true) => {
    if (!user?.tenant_id) return
    try {
      if (showLoadingState) setLoading(true)
      else setRefreshing(true)

      // 1. Sincronização retroativa: usuários do tenant que ainda não têm ficha em colaborador
      // (cria a ficha com cargo do perfil ou vincula ficha existente com mesmo e-mail)
      await colaboradorService.sincronizarUsuariosSemFicha(user.tenant_id).catch((err) => {
        console.warn('Aviso na sincronização retroativa de usuários:', err)
      })

      // 2. Carregar lista completa de colaboradores
      const list = await colaboradorService.getColaboradores(user.tenant_id)
      setColaboradores(list)
    } catch (err) {
      console.error('Erro ao listar colaboradores:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    carregarColaboradores()
  }, [user?.tenant_id])

  // Lista de departamentos para o filtro
  const departamentos = useMemo(() => {
    const depts = new Set<string>()
    colaboradores.forEach((c) => {
      if (c.departamento && c.departamento.trim()) {
        depts.add(c.departamento.trim())
      }
    })
    return Array.from(depts).sort()
  }, [colaboradores])

  // Filtragem conforme especificação:
  // "Barra de busca por nome, cargo ou departamento"
  // "Filtro por status (Ativo, Inativo, Todos)"
  const filtered = useMemo(() => {
    return colaboradores.filter((c) => {
      const termo = searchTerm.trim().toLowerCase()
      const matchesSearch =
        !termo ||
        c.nome.toLowerCase().includes(termo) ||
        (c.nome_completo && c.nome_completo.toLowerCase().includes(termo)) ||
        (c.cargo && c.cargo.toLowerCase().includes(termo)) ||
        (c.departamento && c.departamento.toLowerCase().includes(termo)) ||
        (c.cpf && c.cpf.includes(termo))

      const matchesStatus =
        statusFilter === 'todos' || c.status.toLowerCase() === statusFilter.toLowerCase()

      const matchesDept =
        departamentoFilter === 'todos' ||
        (c.departamento && c.departamento.trim() === departamentoFilter)

      return matchesSearch && matchesStatus && matchesDept
    })
  }, [colaboradores, searchTerm, statusFilter, departamentoFilter])

  // Métricas rápidas do topo
  const totalAtivos = useMemo(
    () => colaboradores.filter((c) => c.status === 'ativo').length,
    [colaboradores],
  )
  const totalInativos = useMemo(
    () => colaboradores.filter((c) => c.status === 'inativo').length,
    [colaboradores],
  )

  const handleOpenFicha = (colaborador: Colaborador) => {
    setSelectedColaborador(colaborador)
    setFichaModalOpen(true)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header com estilo corporativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge
              variant="outline"
              className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/20 text-xs font-semibold px-2.5 py-0.5"
            >
              Gestão de Pessoas
            </Badge>
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-medium"
            >
              Acesso Restrito: RH e Admin
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#212121]">
            Base de Colaboradores
          </h1>
          <p className="text-sm text-[#757575] mt-0.5">
            Cadastro unificado, histórico funcional e ficha cadastral completa dos colaboradores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => carregarColaboradores(false)}
            disabled={refreshing || loading}
            className="border-[#E0E0E0] text-xs h-9 gap-1.5 text-[#424242] hover:bg-slate-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#0D47A1]' : ''}`}
            />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Métricas do Quadro */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-[#E0E0E0] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                Total de Registros
              </span>
              <p className="text-2xl font-extrabold text-[#212121]">{colaboradores.length}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0D47A1] flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#E0E0E0] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                Colaboradores Ativos
              </span>
              <p className="text-2xl font-extrabold text-[#2E7D32]">{totalAtivos}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#E0E0E0] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                Inativos / Desligados
              </span>
              <p className="text-2xl font-extrabold text-[#C62828]">{totalInativos}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-[#FFEBEE] text-[#C62828] flex items-center justify-center">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros conforme o requisito do usuário:
          - Barra de busca por nome, cargo ou departamento
          - Filtro por status (Ativo, Inativo, Todos) */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Input de Busca */}
            <div className="relative sm:col-span-6">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#757575]" />
              <Input
                placeholder="Buscar por nome, cargo ou departamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs border-[#E0E0E0] h-9 focus-visible:ring-[#0D47A1]"
              />
            </div>

            {/* Filtro Status (Ativo, Inativo, Afastado, Férias, Todos) */}
            <div className="sm:col-span-3">
              <Select
                value={statusFilter}
                onValueChange={(val: 'todos' | 'ativo' | 'inativo' | 'afastado' | 'ferias') =>
                  setStatusFilter(val)
                }
              >
                <SelectTrigger className="text-xs border-[#E0E0E0] h-9 bg-white">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[#757575]">Status:</span>
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-white border-[#E0E0E0]">
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro Departamento complementar */}
            <div className="sm:col-span-3">
              <Select value={departamentoFilter} onValueChange={setDepartamentoFilter}>
                <SelectTrigger className="text-xs border-[#E0E0E0] h-9 bg-white">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[#757575]">Área:</span>
                    <SelectValue placeholder="Departamento" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-white border-[#E0E0E0]">
                  <SelectItem value="todos">Todos os departamentos</SelectItem>
                  {departamentos.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="mt-3 pt-3 border-t border-[#F5F5F5] flex flex-wrap items-center justify-between text-xs text-[#757575]">
            <span>
              Exibindo <strong className="text-[#0D47A1]">{filtered.length}</strong> de{' '}
              <strong>{colaboradores.length}</strong> colaboradores
            </span>

            {(searchTerm || statusFilter !== 'todos' || departamentoFilter !== 'todos') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('todos')
                  setDepartamentoFilter('todos')
                }}
                className="h-6 px-2 text-[11px] text-[#0D47A1] hover:bg-blue-50"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Colaboradores:
          Colunas: Foto (miniatura), Nome, Cargo, Departamento, Status (Ativo/Inativo), Data de Admissão.
          Ao clicar em um colaborador, abre a ficha completa */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#FAFAFA]">
              <TableRow className="border-b border-[#E0E0E0] hover:bg-transparent">
                <TableHead className="w-[72px] text-center font-bold text-xs text-[#212121]">
                  Foto
                </TableHead>
                <TableHead className="font-bold text-xs text-[#212121]">Nome</TableHead>
                <TableHead className="font-bold text-xs text-[#212121]">Cargo</TableHead>
                <TableHead className="font-bold text-xs text-[#212121]">Departamento</TableHead>
                <TableHead className="font-bold text-xs text-[#212121]">Status</TableHead>
                <TableHead className="font-bold text-xs text-[#212121]">Data de Admissão</TableHead>
                <TableHead className="w-[100px] text-right font-bold text-xs text-[#212121]">
                  Ação
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4, 5, 6].map((i) => (
                  <TableRow key={i}>
                    <TableCell className="text-center">
                      <Skeleton className="h-9 w-9 rounded-full mx-auto bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40 bg-slate-100 mb-1" />
                      <Skeleton className="h-3 w-24 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24 bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-16 bg-slate-100 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-xs text-[#757575]">
                    <Users className="h-8 w-8 text-[#B0BEC5] mx-auto mb-2 opacity-60" />
                    <p className="font-semibold text-sm text-[#424242]">
                      Nenhum colaborador encontrado
                    </p>
                    <p className="text-[11px] text-[#757575] mt-0.5">
                      Tente ajustar os termos da busca ou os filtros aplicados.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  const nomeExibicao = c.nome_completo || c.nome
                  const iniciais = getIniciais(nomeExibicao)

                  return (
                    <TableRow
                      key={c.id}
                      onClick={() => handleOpenFicha(c)}
                      className="cursor-pointer border-b border-[#F0F0F0] hover:bg-[#F8FAFC] transition-colors group"
                    >
                      {/* Foto (miniatura com fallback de c.foto via pb.files ou c.foto_url) */}
                      <TableCell className="text-center py-3">
                        <Avatar className="h-9 w-9 border border-[#E0E0E0] mx-auto shadow-xs group-hover:ring-2 group-hover:ring-[#0D47A1]/30 transition-all">
                          {(c.foto || c.foto_url) && (
                            <AvatarImage
                              src={c.foto ? pb.files.getURL(c, c.foto) : c.foto_url}
                              alt={nomeExibicao}
                              className="object-cover"
                            />
                          )}
                          <AvatarFallback className="bg-[#E8EEF7] text-[#0D47A1] text-xs font-bold">
                            {iniciais}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>

                      {/* Nome */}
                      <TableCell className="py-3">
                        <div>
                          <p className="text-xs font-bold text-[#212121] group-hover:text-[#0D47A1] transition-colors">
                            {nomeExibicao}
                          </p>
                          <p className="text-[11px] text-[#757575] font-mono mt-0.5">
                            CPF: {c.cpf}
                          </p>
                        </div>
                      </TableCell>

                      {/* Cargo */}
                      <TableCell className="py-3 text-xs text-[#424242] font-medium">
                        {c.cargo || 'Cargo não definido'}
                      </TableCell>

                      {/* Departamento */}
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className="bg-[#FAFAFA] text-[#424242] border-[#E0E0E0] text-[11px] font-medium"
                        >
                          {c.departamento || '—'}
                        </Badge>
                      </TableCell>

                      {/* Status com badges elegantes: Ativo, Inativo, Afastado, Férias */}
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-semibold capitalize ${
                            c.status === 'ativo'
                              ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30'
                              : c.status === 'afastado'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : c.status === 'ferias'
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : 'bg-[#FFEBEE] text-[#C62828] border-[#C62828]/30'
                          }`}
                        >
                          {c.status === 'ativo' ? (
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D32]" />
                              Ativo
                            </span>
                          ) : c.status === 'afastado' ? (
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Afastado
                            </span>
                          ) : c.status === 'ferias' ? (
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              Férias
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#C62828]" />
                              Inativo
                            </span>
                          )}
                        </Badge>
                      </TableCell>

                      {/* Data de Admissão */}
                      <TableCell className="py-3 text-xs text-[#424242] font-medium">
                        {formatarDataBR(c.data_admissao)}
                      </TableCell>

                      {/* Ação */}
                      <TableCell className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenFicha(c)
                          }}
                          className="h-8 px-2.5 text-xs text-[#0D47A1] hover:bg-blue-50 font-semibold gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Ver Ficha</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal Ficha Completa com as 10 abas e registro de auditoria */}
      <FichaColaboradorModal
        colaborador={selectedColaborador}
        open={fichaModalOpen}
        onClose={() => {
          setFichaModalOpen(false)
          setSelectedColaborador(null)
        }}
        onColaboradorUpdated={handleColaboradorAtualizado}
      />
    </div>
  )
}
