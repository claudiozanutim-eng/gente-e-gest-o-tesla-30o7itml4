import React, { useState, useEffect } from 'react'
import {
  HeartHandshake,
  Star,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Send,
  Edit2,
  Smile,
  Meh,
  Frown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { PesquisaClima, PesquisaClimaResposta } from '@/types'
import { pesquisaClimaService } from '@/services/pesquisaClimaService'

export interface CardPesquisaClimaPortalProps {
  tenantId: string
  colaboradorId: string
  userId?: string
}

export const CardPesquisaClimaPortal: React.FC<CardPesquisaClimaPortalProps> = ({
  tenantId,
  colaboradorId,
  userId,
}) => {
  const { toast } = useToast()

  const [pesquisa, setPesquisa] = useState<PesquisaClima | null>(null)
  const [resposta, setResposta] = useState<PesquisaClimaResposta | null>(null)
  const [loading, setLoading] = useState(true)

  const [notaSelecionada, setNotaSelecionada] = useState<number | null>(null)
  const [comentario, setComentario] = useState<string>('')
  const [editando, setEditando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const carregarPesquisa = async () => {
    if (!tenantId || !colaboradorId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const ativa = await pesquisaClimaService.getPesquisaAtiva(tenantId)
      setPesquisa(ativa)

      if (ativa) {
        const resp = await pesquisaClimaService.getRespostaColaborador(
          tenantId,
          ativa.id,
          colaboradorId,
        )
        setResposta(resp)
        if (resp) {
          setNotaSelecionada(resp.nota)
          setComentario(resp.comentario || '')
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar pesquisa de clima no Portal:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPesquisa()
  }, [tenantId, colaboradorId])

  if (loading || !pesquisa) {
    return null
  }

  const handleEnviarResposta = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!notaSelecionada || !pesquisa) {
      toast({
        title: 'Selecione uma nota',
        description: 'Por favor, avalie clicando em uma das opções da escala antes de enviar.',
        variant: 'destructive',
      })
      return
    }

    setEnviando(true)
    try {
      const resp = await pesquisaClimaService.responderPesquisa({
        tenantId,
        pesquisaId: pesquisa.id,
        colaboradorId,
        nota: notaSelecionada,
        comentario: comentario.trim(),
        userId,
      })

      setResposta(resp)
      setEditando(false)
      toast({
        title: 'Resposta gravada!',
        description: 'Obrigado por contribuir com a nossa pesquisa de clima organizacional.',
      })
    } catch (err) {
      console.error('Erro ao responder pesquisa de clima:', err)
      toast({
        title: 'Erro ao enviar resposta',
        description: 'Não foi possível registrar sua avaliação. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  // Opções para escala 1-5
  const opcoesEscala = [
    { valor: 1, label: 'Muito Insatisfeito', icone: Frown, color: 'text-rose-500' },
    { valor: 2, label: 'Insatisfeito', icone: Frown, color: 'text-amber-500' },
    { valor: 3, label: 'Neutro / Regular', icone: Meh, color: 'text-yellow-600' },
    { valor: 4, label: 'Satisfeito', icone: Smile, color: 'text-emerald-500' },
    { valor: 5, label: 'Muito Satisfeito', icone: Smile, color: 'text-emerald-700' },
  ]

  const maxEscala = pesquisa.escala === '1-10' ? 10 : 5

  return (
    <Card className="border border-blue-200 bg-gradient-to-r from-blue-50/70 via-white to-blue-50/40 shadow-xs overflow-hidden">
      <div className="h-1.5 w-full bg-[#0D47A1]" />

      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 text-[#0D47A1]">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900">
                  Pesquisa de Clima Organizacional
                </CardTitle>
                <Badge className="bg-[#0D47A1] text-white text-[10px] font-bold">
                  Enquete Ativa
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Sua opinião é fundamental para aprimorarmos continuamente nosso ambiente de
                trabalho.
              </CardDescription>
            </div>
          </div>

          {resposta && !editando && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-bold gap-1 py-1 px-2.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Você já respondeu (Nota: {resposta.nota})
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditando(true)}
                className="h-8 text-xs font-semibold text-[#0D47A1] hover:bg-blue-50 gap-1"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Alterar Resposta
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-2 space-y-4">
        {/* Pergunta em Destaque */}
        <div className="p-3.5 bg-white rounded-xl border border-blue-100 shadow-2xs">
          <p className="text-sm sm:text-base font-extrabold text-[#0D47A1] leading-snug">
            &quot;{pesquisa.pergunta}&quot;
          </p>
        </div>

        {/* Modo de Visualização Respondida (Sem edição) */}
        {resposta && !editando ? (
          <div className="bg-white/90 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <span>Sua avaliação:</span>
                <div className="flex items-center text-amber-500">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={`h-4 w-4 ${
                        idx < (resposta.nota || 0)
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[#0D47A1] font-mono text-sm">
                  ({resposta.nota} / {maxEscala})
                </span>
              </div>
              {resposta.comentario ? (
                <p className="text-slate-600 italic mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                  &quot;{resposta.comentario}&quot;
                </p>
              ) : (
                <p className="text-slate-400 text-[11px]">Nenhum comentário adicional inserido.</p>
              )}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditando(true)}
              className="border-[#0D47A1] text-[#0D47A1] hover:bg-blue-50 text-xs shrink-0"
            >
              <Edit2 className="h-3.5 w-3.5 mr-1" />
              Editar Avaliação
            </Button>
          </div>
        ) : (
          /* Modo de Resposta / Edição */
          <form onSubmit={handleEnviarResposta} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Selecione sua avaliação na escala (1 a {maxEscala}):
              </label>

              {pesquisa.escala === '1-5' ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {opcoesEscala.map((item) => {
                    const isSelected = notaSelecionada === item.valor
                    const IconComponent = item.icone
                    return (
                      <button
                        type="button"
                        key={item.valor}
                        onClick={() => setNotaSelecionada(item.valor)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-[#0D47A1] bg-blue-100/60 ring-2 ring-[#0D47A1] shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <IconComponent className={`h-6 w-6 mb-1 ${item.color}`} />
                        <span className="text-base font-black text-slate-900 font-mono">
                          {item.valor}
                        </span>
                        <span className="text-[10px] text-center font-medium text-slate-600 line-clamp-1">
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: maxEscala }).map((_, idx) => {
                    const valor = idx + 1
                    const isSelected = notaSelecionada === valor
                    return (
                      <button
                        type="button"
                        key={valor}
                        onClick={() => setNotaSelecionada(valor)}
                        className={`h-10 w-10 rounded-xl border flex items-center justify-center font-black font-mono text-sm transition-all ${
                          isSelected
                            ? 'bg-[#0D47A1] text-white border-[#0D47A1] shadow-xs scale-105'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                        }`}
                      >
                        {valor}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Comentário Opcional */}
            <div className="space-y-1.5">
              <label
                htmlFor="comentario-pesquisa"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                Comentário ou Sugestão Construtiva (Opcional):
              </label>
              <Textarea
                id="comentario-pesquisa"
                rows={2}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Compartilhe detalhes do que está funcionando bem ou sugestões para a liderança e RH..."
                className="text-xs resize-none bg-white"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {editando && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditando(false)}
                  className="text-xs text-slate-500"
                >
                  Cancelar Edição
                </Button>
              )}

              <Button
                type="submit"
                size="sm"
                disabled={enviando || !notaSelecionada}
                className="bg-[#0D47A1] hover:bg-[#0b3c8a] text-white text-xs font-semibold gap-1.5 shadow-xs ml-auto"
              >
                <Send className="h-3.5 w-3.5" />
                {enviando
                  ? 'Enviando...'
                  : resposta
                    ? 'Salvar Alteração'
                    : 'Enviar Resposta com 1 Clique'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
