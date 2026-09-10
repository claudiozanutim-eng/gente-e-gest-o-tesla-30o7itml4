import React, { useState, useEffect } from 'react'
import {
  UserCheck,
  Check,
  X,
  RefreshCw,
  Clock,
  Calendar,
  AlertCircle,
  FileEdit,
  ArrowRight,
  ShieldCheck,
  Building,
  Loader2,
  Filter,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { solicitacaoService } from '@/services/api'
import { SolicitacaoAlteracao, Colaborador } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type SolicitacaoItem = SolicitacaoAlteracao & {
  expand?: {
    colaborador_id?: Colaborador
  }
}

export default function AlteracoesPendentesPage() {
  const { user } = useAuth()
  const tenantId = user?.tenant_id
  const { toast } = useToast()

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Modal de Rejeição (para justificativa)
  const [solicRejeitar, setSolicRejeitar] = useState<SolicitacaoItem | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')

  // Aba / Filtro: Pendentes vs Todas
  const [filtroAba, setFiltroAba] = useState<'pendente' | 'todas'>('pendente')

  const carregarSolicitacoes = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const list = await solicitacaoService.getSolicitacoesTenant(tenantId)
      setSolicitacoes(list)
    } catch (err) {
      console.error('Erro ao carregar solicitações de alteração:', err)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as alterações cadastrais.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarSolicitacoes()
  }, [tenantId])

  // Ação de Aprovação
  const handleAprovar = async (solic: SolicitacaoItem) => {
    if (!user?.id) return
    try {
      setProcessingId(solic.id)
      const res = await solicitacaoService.aprovarSolicitacao(solic, user.id)

      if (res.success) {
        setSolicitacoes((prev) =>
          prev.map((s) => (s.id === solic.id ? { ...s, status: 'aprovada' } : s)),
        )

        const nomeColab =
          solic.expand?.colaborador_id?.nome_completo ||
          solic.expand?.colaborador_id?.nome ||
          'Colaborador'

        toast({
          title: 'Alteração cadastral aprovada!',
          description: `O campo "${solic.campo}" de ${nomeColab} foi atualizado com sucesso no cadastro. Auditoria registrada.`,
        })
      }
    } catch (err) {
      console.error('Erro ao aprovar solicitação:', err)
      toast({
        title: 'Erro na aprovação',
        description: 'Não foi possível salvar as alterações no registro do colaborador.',
        variant: 'destructive',
      })
    } finally {
      setProcessingId(null)
    }
  }

  // Ação de Rejeição
  const handleConfirmarRejeicao = async () => {
    if (!solicRejeitar || !user?.id) return

    try {
      setProcessingId(solicRejeitar.id)
      const motivo = motivoRejeicao.trim() || 'Solicitação reprovada pelo setor de RH.'
      await solicitacaoService.rejeitarSolicitacao(solicRejeitar, user.id, motivo)

      setSolicitacoes((prev) =>
        prev.map((s) =>
          s.id === solicRejeitar.id ? { ...s, status: 'rejeitada', motivo_resposta: motivo } : s,
        ),
      )

      toast({
        title: 'Solicitação rejeitada',
        description: `A alteração de "${solicRejeitar.campo}" foi recusada. O colaborador não terá seus dados modificados.`,
      })

      setSolicRejeitar(null)
      setMotivoRejeicao('')
    } catch (err) {
      console.error('Erro ao rejeitar solicitação:', err)
      toast({
        title: 'Erro na rejeição',
        description: 'Não foi possível rejeitar a solicitação.',
        variant: 'destructive',
      })
    } finally {
      setProcessingId(null)
    }
  }

  const formatarData = (d?: string) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '—'
    }
  }

  const solicitacoesExibidas = solicitacoes.filter((s) => {
    if (filtroAba === 'pendente') {
      return s.status === 'pendente'
    }
    return true
  })

  const totalPendentes = solicitacoes.filter((s) => s.status === 'pendente').length

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
              Alterações Cadastrais Pendentes
            </h1>
            <Badge
              variant="outline"
              className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-xs font-semibold"
            >
              Aprovação RH
            </Badge>
          </div>
          <p className="text-sm text-[#757575] mt-1">
            Revise solicitações de atualização enviadas pelos colaboradores no Meu Perfil. Ao
            aprovar, o dado no registro é atualizado imediatamente com auditoria rastreável.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarSolicitacoes}
            disabled={loading}
            className="border-[#E0E0E0] text-[#212121] text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Card de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-[#E0E0E0] bg-white shadow-xs p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#757575] uppercase">Pendentes de Revisão</p>
            <p className="text-2xl font-extrabold text-[#E65100] mt-1">{totalPendentes}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-orange-100 text-[#E65100] flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </Card>

        <Card className="border border-[#E0E0E0] bg-white shadow-xs p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#757575] uppercase">Aprovadas no Mês</p>
            <p className="text-2xl font-extrabold text-[#2E7D32] mt-1">
              {solicitacoes.filter((s) => s.status === 'aprovada').length}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </Card>

        <Card className="border border-[#E0E0E0] bg-white shadow-xs p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#757575] uppercase">Total de Solicitações</p>
            <p className="text-2xl font-extrabold text-[#0D47A1] mt-1">{solicitacoes.length}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center">
            <FileEdit className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Seletor de Abas: Pendentes vs Todas */}
      <div className="flex items-center gap-2 border-b border-[#E0E0E0] pb-2">
        <button
          onClick={() => setFiltroAba('pendente')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            filtroAba === 'pendente'
              ? 'bg-[#0D47A1] text-white shadow-xs'
              : 'text-[#616161] hover:bg-slate-100'
          }`}
        >
          <span>Aguardando Aprovação</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              filtroAba === 'pendente' ? 'bg-white/20 text-white' : 'bg-[#E0E0E0] text-[#424242]'
            }`}
          >
            {totalPendentes}
          </span>
        </button>

        <button
          onClick={() => setFiltroAba('todas')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            filtroAba === 'todas'
              ? 'bg-[#0D47A1] text-white shadow-xs'
              : 'text-[#616161] hover:bg-slate-100'
          }`}
        >
          <span>Todas as Solicitações</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              filtroAba === 'todas' ? 'bg-white/20 text-white' : 'bg-[#E0E0E0] text-[#424242]'
            }`}
          >
            {solicitacoes.length}
          </span>
        </button>
      </div>

      {/* Lista de Solicitações */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full bg-slate-100 rounded-xl" />
          ))}
        </div>
      ) : solicitacoesExibidas.length === 0 ? (
        <Card className="border border-dashed border-[#E0E0E0] bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32] mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-[#212121]">
            {filtroAba === 'pendente'
              ? 'Tudo em dia! Nenhuma solicitação pendente'
              : 'Nenhuma solicitação encontrada'}
          </h3>
          <p className="text-xs text-[#757575] mt-1 max-w-sm mx-auto">
            {filtroAba === 'pendente'
              ? 'Todas as alterações cadastrais submetidas pelos colaboradores já foram analisadas.'
              : 'Nenhum colaborador realizou pedidos de alteração cadastral até o momento.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3.5">
          {solicitacoesExibidas.map((solic) => {
            const colab = solic.expand?.colaborador_id
            const nomeColab = colab?.nome_completo || colab?.nome || 'Colaborador'
            const isProcessing = processingId === solic.id
            const isPendente = solic.status === 'pendente'

            return (
              <Card
                key={solic.id}
                className={`border bg-white shadow-xs transition-all ${
                  isPendente
                    ? 'border-amber-200 hover:border-[#0D47A1]/50'
                    : solic.status === 'aprovada'
                      ? 'border-emerald-200 bg-[#FAFCFA]'
                      : 'border-slate-200 opacity-80'
                }`}
              >
                <CardContent className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Informações do Colaborador e Campo Solicitado */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#212121]">{nomeColab}</span>
                      {colab?.cargo && (
                        <span className="text-xs text-[#757575] font-normal">• {colab.cargo}</span>
                      )}
                      {colab?.departamento && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-slate-50 text-[#616161] border-slate-200"
                        >
                          {colab.departamento}
                        </Badge>
                      )}

                      {/* Status Badge */}
                      {solic.status === 'pendente' && (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-[#E65100] border-amber-300 text-[10px] font-bold"
                        >
                          Pendente de Aprovação
                        </Badge>
                      )}
                      {solic.status === 'aprovada' && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-[#2E7D32] border-emerald-300 text-[10px] font-bold"
                        >
                          ✓ Aprovada
                        </Badge>
                      )}
                      {solic.status === 'rejeitada' && (
                        <Badge
                          variant="outline"
                          className="bg-rose-50 text-[#C62828] border-rose-300 text-[10px] font-bold"
                        >
                          ✕ Rejeitada
                        </Badge>
                      )}
                    </div>

                    {/* Comparativo: Campo, Valor Antigo -> Valor Novo */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs pt-1">
                      <span className="font-semibold text-[#0D47A1] bg-[#E8EEF7] px-2.5 py-1 rounded-md shrink-0">
                        Campo: {solic.campo}
                      </span>

                      <div className="flex items-center gap-2 flex-wrap text-xs text-[#424242]">
                        <span className="text-[#757575] line-through bg-slate-100 px-2 py-0.5 rounded">
                          {solic.valor_antigo || 'Não informado'}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#0D47A1] shrink-0" />
                        <span className="font-bold text-[#212121] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                          {solic.valor_novo}
                        </span>
                      </div>
                    </div>

                    {/* Metadados: Data de solicitação */}
                    <div className="flex items-center gap-3 text-[11px] text-[#757575] pt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Solicitado em: {formatarData(solic.data_solicitacao || solic.created)}
                      </span>
                      {solic.motivo_resposta && (
                        <span className="text-rose-700 italic">
                          Motivo: &ldquo;{solic.motivo_resposta}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botões de Ação: Aprovar (Verde) e Rejeitar (Vermelho) */}
                  {isPendente ? (
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-0 border-[#F0F0F0]">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => setSolicRejeitar(solic)}
                        className="border-[#EF9A9A] text-[#C62828] hover:bg-[#FFEBEE] hover:text-[#B71C1C] text-xs font-semibold h-8 px-3 gap-1"
                      >
                        <X className="h-3.5 w-3.5" />
                        Rejeitar
                      </Button>

                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleAprovar(solic)}
                        className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-semibold h-8 px-3.5 gap-1.5 shadow-xs"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Aprovar
                      </Button>
                    </div>
                  ) : (
                    <div className="text-right text-[11px] text-[#757575] shrink-0">
                      <span>
                        Respondido em {formatarData(solic.data_resposta || solic.updated)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de Confirmação de Rejeição */}
      <Dialog open={!!solicRejeitar} onOpenChange={(open) => !open && setSolicRejeitar(null)}>
        {solicRejeitar && (
          <DialogContent className="max-w-md bg-white border border-[#E0E0E0]">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-rose-100 text-[#C62828] flex items-center justify-center">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-[#212121]">
                    Rejeitar Solicitação de Alteração
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#757575]">
                    Confirme o motivo da reprovação para registrar no histórico do colaborador.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <p>
                  <strong>Colaborador:</strong>{' '}
                  {solicRejeitar.expand?.colaborador_id?.nome_completo ||
                    solicRejeitar.expand?.colaborador_id?.nome}
                </p>
                <p>
                  <strong>Campo solicitado:</strong> {solicRejeitar.campo}
                </p>
                <p>
                  <strong>Novo valor proposto:</strong> {solicRejeitar.valor_novo}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="motivo" className="text-xs font-semibold text-[#212121]">
                  Motivo da recusa (opcional)
                </Label>
                <Textarea
                  id="motivo"
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  placeholder="Ex: Documento comprobatório ilegível, divergência com comprovante de endereço..."
                  rows={3}
                  className="border-[#E0E0E0] text-xs"
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSolicRejeitar(null)}
                className="border-[#E0E0E0] text-xs h-8"
              >
                Voltar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmarRejeicao}
                disabled={processingId === solicRejeitar.id}
                className="bg-[#C62828] hover:bg-[#B71C1C] text-white text-xs font-semibold h-8"
              >
                {processingId === solicRejeitar.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Confirmar Rejeição'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
