import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  User,
  Activity,
  Layers,
  Clock,
  Download,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { logAuditoriaService, userService } from '@/services/api'
import { LogAuditoria, AppUser } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { TESLA_LOGO_URL } from '@/lib/logoAsset'

export default function AdminLogsPage() {
  const { user } = useAuth()
  const tenantId = user?.tenant_id
  const { toast } = useToast()

  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [usuarios, setUsuarios] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState('todos')
  const [filtroAcao, setFiltroAcao] = useState('todos')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const carregarDados = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const [logsData, usersData] = await Promise.all([
        logAuditoriaService.getLogsFiltrados(
          tenantId,
          {
            userId: filtroUsuario,
            acao: filtroAcao,
            dataInicio: filtroDataInicio || undefined,
            dataFim: filtroDataFim || undefined,
          },
          100,
        ),
        userService.getUsersByTenant(tenantId),
      ])
      setLogs(logsData)
      setUsuarios(usersData)
    } catch (err) {
      console.error('Erro ao carregar logs:', err)
      toast({
        title: 'Erro ao carregar logs',
        description: 'Não foi possível buscar a trilha de auditoria.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [tenantId, filtroUsuario, filtroAcao, filtroDataInicio, filtroDataFim])

  // Ações conhecidas para popular dropdown
  const acoesConhecidas = [
    { value: 'todos', label: 'Todas as Ações' },
    { value: 'login', label: 'Login de Usuário' },
    { value: 'criacao_usuario', label: 'Criação de Usuário' },
    { value: 'edicao_usuario', label: 'Edição de Usuário' },
    { value: 'desativacao_usuario', label: 'Desativação de Usuário' },
    { value: 'reativacao_usuario', label: 'Reativação de Usuário' },
    { value: 'aprovacao_alteracao', label: 'Aprovação de Alteração' },
    { value: 'rejeicao_alteracao', label: 'Rejeição de Alteração' },
    { value: 'publicacao_comunicado', label: 'Publicação de Comunicado' },
    { value: 'arquivamento_comunicado', label: 'Arquivamento de Comunicado' },
    { value: 'atualizacao_configuracoes_empresa', label: 'Configurações da Empresa' },
    { value: 'lancamento_folha', label: 'Lançamento de Folha' },
    { value: 'validacao_atestado', label: 'Validação de Atestado' },
  ]

  // Formatação de data
  const formatarData = (d?: string) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return '—'
    }
  }

  // Filtragem local por texto (busca rápida em detalhes e nomes)
  const logsFiltrados = logs.filter((log) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    const matchAcao = (log.acao || '').toLowerCase().includes(term)
    const matchEntidade = (log.entidade || '').toLowerCase().includes(term)
    const matchUser = (log.expand?.user_id?.name || log.expand?.user_id?.email || '')
      .toLowerCase()
      .includes(term)
    const matchJson = JSON.stringify(log.dados_json || {})
      .toLowerCase()
      .includes(term)
    return matchAcao || matchEntidade || matchUser || matchJson
  })

  // Exportar logs como CSV simples
  const handleExportarCsv = () => {
    if (logsFiltrados.length === 0) return

    const header = ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Detalhes']
    const rows = logsFiltrados.map((log) => {
      const dataHora = formatarData(log.data_hora || log.created)
      const usuario = log.expand?.user_id?.name || log.expand?.user_id?.email || 'Sistema'
      const acao = log.acao
      const entidade = log.entidade
      const detalhes = JSON.stringify(log.dados_json || {}).replace(/"/g, '""')
      return `"${dataHora}","${usuario}","${acao}","${entidade}","${detalhes}"`
    })

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [header.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `logs_auditoria_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatarDetalhesLegiveis = (log: LogAuditoria) => {
    if (!log.dados_json || typeof log.dados_json !== 'object') {
      return '—'
    }
    const entries = Object.entries(log.dados_json)
    if (entries.length === 0) return '—'

    return (
      <div className="space-y-1">
        {entries.slice(0, 4).map(([k, v]) => (
          <div key={k} className="text-[11px] text-[#424242]">
            <span className="font-semibold text-[#616161] capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
            <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-12 w-12 rounded-full border-2 border-[#0D47A1]/20 shadow-xs p-0.5 bg-white shrink-0 ring-2 ring-[#0D47A1]/10 flex items-center justify-center">
            <img
              src={TESLA_LOGO_URL}
              alt="Logo Tesla Mecatrônica"
              className="h-full w-full rounded-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Logs de Auditoria
              </h1>
              <Badge
                variant="outline"
                className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-xs font-semibold"
              >
                Trilha de Conformidade
              </Badge>
            </div>
            <p className="text-sm text-[#757575] mt-1">
              Rastreamento completo e imutável de todas as ações sensíveis realizadas no tenant
              (aprovações, exclusões, edições de salários e acessos).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="border-[#E0E0E0] text-[#212121] text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarCsv}
            disabled={logsFiltrados.length === 0}
            className="border-[#0D47A1] text-[#0D47A1] hover:bg-[#E8EEF7] text-xs font-semibold h-9 gap-1.5"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Painel de Filtros Avançados */}
      <Card className="border border-[#E0E0E0] bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          {/* Busca textual */}
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-[11px] font-semibold text-[#757575]">Buscar nos Detalhes</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#757575]" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por palavras-chave ou IDs..."
                className="pl-8 text-xs h-9 border-[#E0E0E0]"
              />
            </div>
          </div>

          {/* Filtro Usuário */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-[#757575]">Usuário Responsável</Label>
            <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
              <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                <SelectValue placeholder="Todos os usuários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os usuários</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Tipo de Ação */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-[#757575]">Tipo de Ação</Label>
            <Select value={filtroAcao} onValueChange={setFiltroAcao}>
              <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                {acoesConhecidas.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Período (Data Início / Fim) */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-[#757575]">A partir de</Label>
            <Input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="text-xs h-9 border-[#E0E0E0]"
            />
          </div>
        </div>

        {(filtroUsuario !== 'todos' ||
          filtroAcao !== 'todos' ||
          filtroDataInicio ||
          filtroDataFim ||
          searchTerm) && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#F5F5F5] text-xs">
            <span className="text-[#757575] text-[11px]">Filtros ativos aplicados</span>
            <button
              onClick={() => {
                setFiltroUsuario('todos')
                setFiltroAcao('todos')
                setFiltroDataInicio('')
                setFiltroDataFim('')
                setSearchTerm('')
              }}
              className="text-xs text-[#0D47A1] hover:underline font-semibold"
            >
              Limpar todos os filtros
            </button>
          </div>
        )}
      </Card>

      {/* Tabela de Trilha de Auditoria */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-[#F0F0F0]">
          <CardTitle className="text-sm font-bold text-[#212121] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0D47A1]" />
            Registros Encontrados ({logsFiltrados.length})
          </CardTitle>
          <CardDescription className="text-xs text-[#757575]">
            Ordenado do evento mais recente para o mais antigo (trilha append-only)
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full bg-slate-100" />
              ))}
            </div>
          ) : logsFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <ShieldCheck className="h-10 w-10 text-[#9E9E9E] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-[#212121]">Nenhum registro de log encontrado</p>
              <p className="text-xs text-[#757575] mt-1">
                Tente relaxar os filtros de busca ou intervalo de datas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto divide-y divide-[#F0F0F0]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E0E0E0] text-[#757575] uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Data e Hora</th>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Ação</th>
                    <th className="py-3 px-4">Entidade</th>
                    <th className="py-3 px-4">Detalhes e Parâmetros</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5]">
                  {logsFiltrados.map((item) => {
                    const userName =
                      item.expand?.user_id?.name || item.expand?.user_id?.email || 'Sistema / Bot'
                    const userPerfil = item.expand?.user_id?.perfil

                    return (
                      <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-[#757575] font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-[#0D47A1]" />
                            <span>{formatarData(item.data_hora || item.created)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-bold text-[#212121] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="h-6 w-6 rounded-full bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center text-[10px] font-bold">
                              {userName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span>{userName}</span>
                              {userPerfil && (
                                <span className="text-[10px] text-[#757575] block font-normal">
                                  {userPerfil}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className="bg-slate-100 text-[#212121] border-slate-300 font-mono text-[10px]"
                          >
                            {item.acao}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-xs font-semibold text-[#0D47A1]">
                            {item.entidade}
                          </span>
                          {item.entidade_id && (
                            <span className="text-[10px] text-[#757575] block font-mono">
                              ID: {item.entidade_id.slice(0, 10)}...
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 max-w-md">{formatarDetalhesLegiveis(item)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
