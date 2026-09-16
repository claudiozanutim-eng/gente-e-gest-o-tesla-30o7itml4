import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Search,
  Filter,
  User,
  Calendar,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  Maximize2,
  Minimize2,
  Loader2,
  X,
  History,
  FileQuestion,
  Info,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { atestadoService, logAuditoriaService, colaboradorService } from '@/services/api'
import { Atestado, AtestadoStatus, ATESTADO_STATUS_MAP, Colaborador, LogAuditoria } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

export default function ValidacaoAtestadosPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [atestados, setAtestados] = useState<Atestado[]>([])
  const [colaboradoresMap, setColaboradoresMap] = useState<Record<string, Colaborador>>({})
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroAba, setFiltroAba] = useState<'pendentes' | 'todos'>('pendentes')
  const [busca, setBusca] = useState('')

  // Atestado selecionado para validação / modal de detalhes
  const [atestadoSelecionado, setAtestadoSelecionado] = useState<Atestado | null>(null)
  const [novoStatus, setNovoStatus] = useState<AtestadoStatus>('validado')
  const [comentarioRh, setComentarioRh] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroComentario, setErroComentario] = useState<string | null>(null)
  const [modoExpandidoValidacao, setModoExpandidoValidacao] = useState(false)

  // Logs de auditoria do atestado selecionado
  const [logsAuditoria, setLogsAuditoria] = useState<LogAuditoria[]>([])
  const [carregandoLogs, setCarregandoLogs] = useState(false)

  const tenantId = user?.tenant_id

  // Carregar lista de colaboradores e atestados do tenant
  const carregarDados = useCallback(async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const [listaAtestados, listaColaboradores] = await Promise.all([
        atestadoService.getAtestadosTenant(tenantId),
        colaboradorService.getColaboradores(tenantId),
      ])

      const map: Record<string, Colaborador> = {}
      listaColaboradores.forEach((c) => {
        map[c.id] = c
      })

      setColaboradoresMap(map)
      setAtestados(listaAtestados)
    } catch (err) {
      console.error('Erro ao carregar atestados para validação:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar os atestados pendentes de validação.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Realtime subscription para refletir alterações instantaneamente
  useRealtime<Atestado>('atestado', (e) => {
    if (e.record.tenant_id === tenantId) {
      if (e.action === 'create') {
        setAtestados((prev) => {
          if (prev.some((a) => a.id === e.record.id)) return prev
          return [e.record, ...prev]
        })
      } else if (e.action === 'update') {
        setAtestados((prev) => prev.map((a) => (a.id === e.record.id ? { ...a, ...e.record } : a)))
        setAtestadoSelecionado((prev) =>
          prev?.id === e.record.id ? { ...prev, ...e.record } : prev,
        )
      } else if (e.action === 'delete') {
        setAtestados((prev) => prev.filter((a) => a.id !== e.record.id))
        setAtestadoSelecionado((prev) => (prev?.id === e.record.id ? null : prev))
      }
    }
  })

  // Carregar histórico de auditoria ao abrir um atestado
  const carregarHistoricoAuditoria = async (atestadoId: string) => {
    try {
      setCarregandoLogs(true)
      const logs = await logAuditoriaService.getLogsPorEntidade('atestado', atestadoId)
      setLogsAuditoria(logs)
    } catch {
      setLogsAuditoria([])
    } finally {
      setCarregandoLogs(false)
    }
  }

  // Ao selecionar um atestado para validar
  const handleAbrirAtestado = (atestado: Atestado) => {
    setAtestadoSelecionado(atestado)
    setNovoStatus(atestado.status)
    setComentarioRh(atestado.comentario_rh || '')
    setErroComentario(null)
    carregarHistoricoAuditoria(atestado.id)
  }

  // Validação e Salvamento da análise do RH
  const handleSalvarValidacao = async () => {
    if (!atestadoSelecionado) return

    // O campo de comentário do RH é OBRIGATÓRIO quando marcar "necessita_correcao"
    if (novoStatus === 'necessita_correcao' && !comentarioRh.trim()) {
      setErroComentario(
        'O comentário com o motivo da correção é obrigatório ao marcar "Necessita correção".',
      )
      toast({
        title: 'Comentário obrigatório',
        description: 'Informe ao colaborador o que necessita ser ajustado no documento.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)
      setErroComentario(null)

      const statusAnterior = atestadoSelecionado.status
      const dataResposta = new Date().toISOString()

      // 1. Atualizar atestado no PocketBase
      const atestadoAtualizado = await atestadoService.atualizarStatus(atestadoSelecionado.id, {
        status: novoStatus,
        comentario_rh: comentarioRh.trim(),
        data_resposta: dataResposta,
      })

      // 2. Registrar no log_auditoria
      const colaboradorAlvo =
        atestadoSelecionado.expand?.colaborador_id ||
        colaboradoresMap[atestadoSelecionado.colaborador_id]

      if (tenantId && user?.id) {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: 'validacao_atestado',
          entidade: 'atestado',
          entidade_id: atestadoSelecionado.id,
          data_hora: dataResposta,
          dados_json: {
            rh_nome: user.name,
            rh_email: user.email,
            status_anterior: statusAnterior,
            status_novo: novoStatus,
            comentario_rh: comentarioRh.trim(),
            colaborador_nome: colaboradorAlvo?.nome || 'Não identificado',
            colaborador_id: atestadoSelecionado.colaborador_id,
            qtd_dias: atestadoSelecionado.qtd_dias,
            data_inicio: atestadoSelecionado.data_inicio,
          },
        })
      }

      // 3. Atualizar estado local
      setAtestados((prev) =>
        prev.map((a) => (a.id === atestadoAtualizado.id ? atestadoAtualizado : a)),
      )
      setAtestadoSelecionado(atestadoAtualizado)

      toast({
        title: 'Status atualizado com sucesso',
        description: `O atestado agora está "${ATESTADO_STATUS_MAP[novoStatus].label}". A ação foi gravada na auditoria.`,
      })

      // Se for pendente e passou a ser finalizado (validado), recarrega histórico de auditoria
      carregarHistoricoAuditoria(atestadoAtualizado.id)
    } catch (err: unknown) {
      console.error('Erro ao atualizar atestado:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar o status do atestado.'
      toast({
        title: 'Erro ao salvar validação',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Filtragem da lista
  const atestadosFiltrados = useMemo(() => {
    return atestados.filter((item) => {
      // Filtro de aba
      if (filtroAba === 'pendentes') {
        if (item.status !== 'recebido' && item.status !== 'em_analise') {
          return false
        }
      }

      // Filtro de busca (nome do colaborador)
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim()
        const colab = item.expand?.colaborador_id || colaboradoresMap[item.colaborador_id]
        const nome = (colab?.nome || '').toLowerCase()
        const depto = (colab?.departamento || '').toLowerCase()
        const cargo = (colab?.cargo || '').toLowerCase()
        return nome.includes(termo) || depto.includes(termo) || cargo.includes(termo)
      }

      return true
    })
  }, [atestados, filtroAba, busca, colaboradoresMap])

  // Contadores
  const contagemPendentes = useMemo(
    () => atestados.filter((a) => a.status === 'recebido' || a.status === 'em_analise').length,
    [atestados],
  )
  const contagemRecebidos = useMemo(
    () => atestados.filter((a) => a.status === 'recebido').length,
    [atestados],
  )
  const contagemEmAnalise = useMemo(
    () => atestados.filter((a) => a.status === 'em_analise').length,
    [atestados],
  )
  const contagemValidados = useMemo(
    () => atestados.filter((a) => a.status === 'validado').length,
    [atestados],
  )
  const contagemCorrecoes = useMemo(
    () => atestados.filter((a) => a.status === 'necessita_correcao').length,
    [atestados],
  )

  // Formatação de período (data início + dias)
  const formatarPeriodo = (dataInicioStr: string, qtd: number) => {
    try {
      const inicio = new Date(dataInicioStr)
      const dataInicioFormatada = inicio.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      })

      const fim = new Date(inicio)
      fim.setUTCDate(fim.getUTCDate() + (qtd - 1))
      const dataFimFormatada = fim.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      })

      const diasLabel = qtd === 1 ? '1 dia' : `${qtd} dias`
      if (qtd === 1) {
        return `${dataInicioFormatada} (${diasLabel})`
      }
      return `${dataInicioFormatada} até ${dataFimFormatada} (${diasLabel})`
    } catch {
      return `${dataInicioStr} (${qtd} dias)`
    }
  }

  const formatarData = (dStr?: string) => {
    if (!dStr) return '-'
    try {
      const d = new Date(dStr)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dStr
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E0F2F1] flex items-center justify-center text-[#00695C]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Validação de Atestados Médicos
              </h1>
              <p className="text-xs text-[#757575] mt-0.5">
                Painel exclusivo de análise, homologação e auditoria de atestados médicos da Tesla
                RH.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/20 text-xs px-3 py-1 font-semibold"
          >
            {contagemPendentes}{' '}
            {contagemPendentes === 1 ? 'atestado aguardando' : 'atestados aguardando'}
          </Badge>
        </div>
      </div>

      {/* 2. Mini KPI Cards de Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFiltroAba('pendentes')}
          className={`bg-white border rounded-xl p-3.5 shadow-2xs cursor-pointer transition-all ${
            filtroAba === 'pendentes' ? 'ring-2 ring-[#0D47A1] border-[#0D47A1]' : ''
          }`}
          style={{ borderLeft: '4px solid #FBC02D' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9A7B00]">
            Recebidos (Triagem)
          </span>
          <div className="text-2xl font-extrabold text-[#212121] mt-1">{contagemRecebidos}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Aguardando 1ª avaliação</p>
        </div>

        <div
          onClick={() => setFiltroAba('pendentes')}
          className="bg-white border rounded-xl p-3.5 shadow-2xs cursor-pointer transition-all"
          style={{ borderLeft: '4px solid #1976D2' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1565C0]">
            Em Análise
          </span>
          <div className="text-2xl font-extrabold text-[#212121] mt-1">{contagemEmAnalise}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Em revisão pelo médico/RH</p>
        </div>

        <div
          onClick={() => setFiltroAba('todos')}
          className="bg-white border rounded-xl p-3.5 shadow-2xs cursor-pointer transition-all"
          style={{ borderLeft: '4px solid #388E3C' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#2E7D32]">
            Validados (Aprovados)
          </span>
          <div className="text-2xl font-extrabold text-[#212121] mt-1">{contagemValidados}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Homologados no histórico</p>
        </div>

        <div
          onClick={() => setFiltroAba('todos')}
          className="bg-white border rounded-xl p-3.5 shadow-2xs cursor-pointer transition-all"
          style={{ borderLeft: '4px solid #D32F2F' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#C62828]">
            Necessitam Correção
          </span>
          <div className="text-2xl font-extrabold text-[#212121] mt-1">{contagemCorrecoes}</div>
          <p className="text-[11px] text-[#757575] mt-0.5">Aguardando novo envio</p>
        </div>
      </div>

      {/* 3. Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E0E0E0] shadow-2xs">
        {/* Abas */}
        <div className="inline-flex rounded-lg bg-[#F5F5F5] p-1">
          <button
            onClick={() => setFiltroAba('pendentes')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              filtroAba === 'pendentes'
                ? 'bg-white text-[#0D47A1] shadow-xs'
                : 'text-[#616161] hover:text-[#212121]'
            }`}
          >
            Pendentes ({contagemPendentes})
          </button>
          <button
            onClick={() => setFiltroAba('todos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              filtroAba === 'todos'
                ? 'bg-white text-[#0D47A1] shadow-xs'
                : 'text-[#616161] hover:text-[#212121]'
            }`}
          >
            Todos os Atestados ({atestados.length})
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#757575]" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por colaborador..."
            className="pl-9 text-xs h-9 border-[#E0E0E0]"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#757575] hover:text-[#212121]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Lista de Atestados Pendentes / Todos */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border border-[#E0E0E0] p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-48 bg-slate-100" />
                <Skeleton className="h-6 w-24 bg-slate-100" />
              </div>
              <Skeleton className="h-4 w-3/4 mt-2 bg-slate-100" />
            </Card>
          ))}
        </div>
      ) : atestadosFiltrados.length === 0 ? (
        <Card className="border border-dashed border-[#E0E0E0] bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E0F2F1] text-[#00695C] mb-3">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-[#212121]">
            {filtroAba === 'pendentes'
              ? 'Tudo em dia! Nenhum atestado pendente de validação.'
              : 'Nenhum atestado encontrado com o filtro aplicado.'}
          </h3>
          <p className="text-xs text-[#757575] max-w-sm mx-auto mt-1">
            {filtroAba === 'pendentes'
              ? 'Todos os atestados médicos submetidos pelos colaboradores foram analisados pelo RH.'
              : 'Tente alterar os termos da busca para localizar o colaborador desejado.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {atestadosFiltrados.map((item) => {
            const colab = item.expand?.colaborador_id || colaboradoresMap[item.colaborador_id]
            const statusCfg = ATESTADO_STATUS_MAP[item.status] || ATESTADO_STATUS_MAP.recebido

            return (
              <Card
                key={item.id}
                onClick={() => handleAbrirAtestado(item)}
                className="border border-[#E0E0E0] bg-white shadow-2xs hover:shadow-md transition-all cursor-pointer hover:border-[#0D47A1]/40 overflow-hidden"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Dados do Colaborador e Afastamento */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#212121] flex items-center gap-1.5">
                          <User className="h-4 w-4 text-[#0D47A1]" />
                          {colab?.nome || 'Colaborador não identificado'}
                        </span>
                        {colab?.departamento && (
                          <span className="text-xs text-[#757575] bg-[#F5F5F5] px-2 py-0.5 rounded">
                            {colab.departamento} {colab?.cargo ? `• ${colab.cargo}` : ''}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[#616161] flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-[#212121]">
                          <Calendar className="h-3.5 w-3.5 text-[#0D47A1]" />
                          Período: {formatarPeriodo(item.data_inicio, item.qtd_dias)}
                        </span>
                        <span className="flex items-center gap-1 text-[#757575]">
                          <Clock className="h-3.5 w-3.5" />
                          Enviado: {formatarData(item.data_envio || item.created)}
                        </span>
                      </div>

                      {item.comentario_rh && (
                        <p className="text-xs text-[#757575] italic line-clamp-1 mt-1">
                          Comentário anterior: &quot;{item.comentario_rh}&quot;
                        </p>
                      )}
                    </div>

                    {/* Badge de Status e Botão Analisar */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-[#F5F5F5]">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-2xs"
                        style={{ backgroundColor: statusCfg.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        {statusCfg.label}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 border-[#0D47A1]/30 text-[#0D47A1] hover:bg-[#E8EEF7] gap-1 font-semibold"
                      >
                        Analisar
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 5. Modal Completo de Análise / Visualização do Anexo / Alteração de Status */}
      <Dialog
        open={!!atestadoSelecionado}
        onOpenChange={(open) => {
          if (!open) {
            setAtestadoSelecionado(null)
            setModoExpandidoValidacao(false)
          }
        }}
      >
        {atestadoSelecionado && (
          <DialogContent
            className={
              modoExpandidoValidacao
                ? 'fixed inset-2 z-50 w-[calc(100vw-1rem)] h-[calc(100vh-1rem)] max-w-none max-h-none translate-x-0 translate-y-0 left-2 top-2 p-5 flex flex-col overflow-hidden bg-white rounded-xl border border-[#0D47A1]/20 shadow-2xl duration-200'
                : 'max-w-5xl w-[96vw] bg-white border border-[#E0E0E0] p-6 max-h-[92vh] flex flex-col duration-200'
            }
          >
            <DialogHeader className="text-left space-y-1 pb-3 border-b border-[#E0E0E0] shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-5 w-5 text-[#0D47A1] shrink-0" />
                  <DialogTitle className="text-lg font-bold text-[#212121] truncate">
                    Análise e Homologação de Atestado
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-2 shrink-0 mr-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModoExpandidoValidacao((prev) => !prev)}
                    className="text-xs border-[#0D47A1]/30 text-[#0D47A1] hover:bg-[#E8EEF7] hover:text-[#0A3A82] gap-1.5 h-8 font-semibold shadow-2xs"
                    title={
                      modoExpandidoValidacao
                        ? 'Reduzir (ESC)'
                        : 'Expandir área de leitura para quase toda a tela'
                    }
                  >
                    {modoExpandidoValidacao ? (
                      <>
                        <Minimize2 className="h-3.5 w-3.5 text-[#0D47A1]" />
                        <span className="hidden sm:inline">Reduzir</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3.5 w-3.5 text-[#0D47A1]" />
                        <span className="hidden sm:inline">Expandir</span>
                      </>
                    )}
                  </Button>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shrink-0"
                    style={{
                      backgroundColor:
                        ATESTADO_STATUS_MAP[atestadoSelecionado.status]?.color || '#0D47A1',
                    }}
                  >
                    {ATESTADO_STATUS_MAP[atestadoSelecionado.status]?.label}
                  </span>
                </div>
              </div>
              <DialogDescription className="text-xs text-[#757575]">
                Revise os dados médicos, visualize o anexo comprovante e defina a decisão do RH.
              </DialogDescription>
            </DialogHeader>

            {/* Corpo do Modal: Layout em 2 Colunas (Esquerda: Detalhes + Anexo | Direita: Ação do RH + Auditoria) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-4 flex-1 min-h-0 overflow-y-auto">
              {/* Coluna Esquerda: Detalhes e Visualizador do Comprovante (7 colunas) */}
              <div className="lg:col-span-7 flex flex-col space-y-4 min-h-0">
                {/* Cartão de Informações do Afastamento */}
                <div className="bg-[#FAFAFA] border border-[#E0E0E0] rounded-xl p-4 space-y-3 text-xs shrink-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[#757575] font-medium block">Colaborador:</span>
                      <p className="text-sm font-bold text-[#212121] mt-0.5">
                        {atestadoSelecionado.expand?.colaborador_id?.nome ||
                          colaboradoresMap[atestadoSelecionado.colaborador_id]?.nome ||
                          'Colaborador'}
                      </p>
                      <p className="text-[#616161] text-[11px]">
                        {colaboradoresMap[atestadoSelecionado.colaborador_id]?.cargo ||
                          'Cargo não especificado'}{' '}
                        •{' '}
                        {colaboradoresMap[atestadoSelecionado.colaborador_id]?.departamento ||
                          'Departamento'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[#757575] font-medium block">CPF:</span>
                      <span className="font-mono text-[11px] text-[#424242]">
                        {colaboradoresMap[atestadoSelecionado.colaborador_id]?.cpf || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#EEEEEE]">
                    <div>
                      <span className="text-[#757575]">Período de Afastamento:</span>
                      <p className="font-bold text-[#212121] mt-0.5">
                        {formatarPeriodo(
                          atestadoSelecionado.data_inicio,
                          atestadoSelecionado.qtd_dias,
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#757575]">Data do Envio:</span>
                      <p className="font-medium text-[#212121] mt-0.5">
                        {formatarData(
                          atestadoSelecionado.data_envio || atestadoSelecionado.created,
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Visualizador do Anexo — Preenchimento total e flexível */}
                <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                  <Label className="text-xs font-bold text-[#212121] flex items-center justify-between shrink-0">
                    <span>Comprovante Anexado pelo Colaborador</span>
                    {atestadoService.getFileUrl(atestadoSelecionado) && (
                      <a
                        href={atestadoService.getFileUrl(atestadoSelecionado)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#0D47A1] hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        <ExternalLink className="h-3 w-3" /> Abrir original em nova aba
                      </a>
                    )}
                  </Label>

                  <div
                    className={
                      modoExpandidoValidacao
                        ? 'flex-1 min-h-[420px] bg-white border border-[#E0E0E0] rounded-xl overflow-hidden flex flex-col relative'
                        : 'h-[360px] lg:h-[400px] bg-white border border-[#E0E0E0] rounded-xl overflow-hidden flex flex-col relative'
                    }
                  >
                    {(() => {
                      const url = atestadoService.getFileUrl(atestadoSelecionado)
                      if (!url) {
                        return (
                          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-xs text-[#757575] bg-slate-50">
                            <FileQuestion className="h-8 w-8 mx-auto mb-2 text-[#9E9E9E]" />
                            Nenhum arquivo anexado a este atestado.
                          </div>
                        )
                      }

                      const isPdf =
                        url.toLowerCase().endsWith('.pdf') ||
                        atestadoSelecionado.anexo?.toLowerCase().endsWith('.pdf')

                      if (isPdf) {
                        return (
                          <iframe
                            src={`${url}#toolbar=1&navpanes=0&view=FitH`}
                            title="Comprovante do Atestado"
                            className="w-full h-full border-0 block bg-white"
                          />
                        )
                      }

                      return (
                        <div className="w-full h-full flex items-center justify-center p-3 bg-slate-100 overflow-auto">
                          <img
                            src={url}
                            alt="Comprovante do Atestado Médico"
                            className="max-h-full max-w-full object-contain rounded shadow-xs"
                          />
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Formulário de Decisão do RH + Histórico de Auditoria (5 colunas) */}
              <div className="lg:col-span-5 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="bg-[#E8EEF7]/60 border border-[#0D47A1]/20 rounded-xl p-3.5 space-y-1 text-xs">
                    <span className="font-bold text-[#0D47A1] flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      Homologação pelo RH
                    </span>
                    <p className="text-[#424242] leading-relaxed">
                      Ao alterar o status, o colaborador receberá a atualização em tempo real em seu
                      portal. Todas as alterações são gravadas na auditoria.
                    </p>
                  </div>

                  {/* Alterar Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#212121]">
                      Status da Validação <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={novoStatus}
                      onValueChange={(val: AtestadoStatus) => {
                        setNovoStatus(val)
                        if (val !== 'necessita_correcao') {
                          setErroComentario(null)
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 text-xs border-[#E0E0E0] font-medium">
                        <SelectValue placeholder="Selecione o novo status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recebido">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#FBC02D]" />
                            Recebido (Aguardando triagem)
                          </span>
                        </SelectItem>
                        <SelectItem value="em_analise">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#1976D2]" />
                            Em análise (RH está revisando)
                          </span>
                        </SelectItem>
                        <SelectItem value="validado">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#388E3C]" />
                            Validado (Aprovado)
                          </span>
                        </SelectItem>
                        <SelectItem value="necessita_correcao">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#D32F2F]" />
                            Necessita correção (Requer reenvio)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campo Comentário do RH (Obrigatório se "necessita_correcao") */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="comentario_rh"
                        className="text-xs font-semibold text-[#212121]"
                      >
                        Comentário / Parecer do RH
                        {novoStatus === 'necessita_correcao' && (
                          <span className="text-red-600 font-bold ml-1">* (Obrigatório)</span>
                        )}
                      </Label>
                    </div>

                    <Textarea
                      id="comentario_rh"
                      value={comentarioRh}
                      onChange={(e) => {
                        setComentarioRh(e.target.value)
                        if (e.target.value.trim()) setErroComentario(null)
                      }}
                      placeholder={
                        novoStatus === 'necessita_correcao'
                          ? 'Especifique com clareza o motivo: ex.: carimbo ilegível, rasura, ausência de CID/período...'
                          : 'Observações internas ou orientações ao colaborador (opcional)'
                      }
                      rows={4}
                      className={`text-xs border-[#E0E0E0] resize-none ${
                        erroComentario ? 'border-red-500 focus-visible:ring-red-500' : ''
                      }`}
                    />

                    {erroComentario && (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {erroComentario}
                      </p>
                    )}
                  </div>

                  {/* Botão Salvar Validação */}
                  <Button
                    onClick={handleSalvarValidacao}
                    disabled={salvando}
                    className="w-full bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs h-10 font-bold gap-2 shadow-sm"
                  >
                    {salvando ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvando decisão e registrando auditoria...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Salvar e Atualizar Colaborador
                      </>
                    )}
                  </Button>
                </div>

                {/* Histórico de Auditoria */}
                <div className="pt-3 border-t border-[#E0E0E0] space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#424242]">
                    <History className="h-3.5 w-3.5 text-[#0D47A1]" />
                    <span>Trilha de Auditoria</span>
                  </div>

                  {carregandoLogs ? (
                    <div className="space-y-1.5">
                      <Skeleton className="h-8 w-full bg-slate-100" />
                      <Skeleton className="h-8 w-full bg-slate-100" />
                    </div>
                  ) : logsAuditoria.length === 0 ? (
                    <p className="text-[11px] text-[#9E9E9E] italic">
                      Nenhuma alteração registrada em auditoria ainda.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {logsAuditoria.map((log) => {
                        const dados = log.dados_json as Record<string, unknown> | undefined
                        return (
                          <div
                            key={log.id}
                            className="bg-[#FAFAFA] border border-[#EEEEEE] rounded p-2 text-[11px] text-[#616161]"
                          >
                            <div className="flex items-center justify-between text-[#212121] font-semibold">
                              <span>
                                {log.expand?.user_id?.name ||
                                  (dados?.rh_nome as string) ||
                                  'Usuário RH'}
                              </span>
                              <span className="text-[10px] text-[#9E9E9E] font-normal">
                                {formatarData(log.data_hora || log.created)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[#424242]">
                              Status alterado para:{' '}
                              <strong>
                                {dados?.status_novo
                                  ? ATESTADO_STATUS_MAP[dados.status_novo as AtestadoStatus]?.label
                                  : log.acao}
                              </strong>
                            </p>
                            {dados?.comentario_rh && (
                              <p className="text-[10px] text-[#757575] mt-0.5 line-clamp-1 italic">
                                &quot;{String(dados.comentario_rh)}&quot;
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="pt-3 border-t border-[#E0E0E0] flex items-center justify-between text-xs">
              <span className="text-[11px] text-[#757575]">
                Módulo Atestados e Licenças • Tesla RH
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAtestadoSelecionado(null)}
                className="h-8 text-xs border-[#E0E0E0]"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
