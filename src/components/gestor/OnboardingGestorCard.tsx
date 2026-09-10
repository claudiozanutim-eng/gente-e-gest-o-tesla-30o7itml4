import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { OnboardingGestorRecord, OnboardingEtapaDef } from '@/types'
import {
  ETAPAS_ONBOARDING_GESTOR,
  onboardingGestorService,
} from '@/services/onboardingGestorService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'

interface OnboardingGestorCardProps {
  tenantId: string
  gestorUserId: string
  concluidasSet: Set<number>
  percentual: number
  isConcluido: boolean
  onProgressoAtualizado: () => void
}

export const OnboardingGestorCard: React.FC<OnboardingGestorCardProps> = ({
  tenantId,
  gestorUserId,
  concluidasSet,
  percentual,
  isConcluido,
  onProgressoAtualizado,
}) => {
  const navigate = useNavigate()
  // Colapsável: aberto por padrão se não concluído, fechado se o gestor preferir
  const [colapsado, setColapsado] = useState(false)
  const [processandoEtapa, setProcessandoEtapa] = useState<number | null>(null)
  const [reabertoManualmente, setReabertoManualmente] = useState(false)

  // Se 100% concluído e não reaberto manualmente, exibe apenas botão discreto "Rever checklist"
  if (isConcluido && !reabertoManualmente) {
    return (
      <div className="flex items-center justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReabertoManualmente(true)}
          className="text-xs text-slate-500 hover:text-[#0D47A1] gap-1.5 h-7 font-medium"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Rever checklist de onboarding do gestor (100% concluído)
        </Button>
      </div>
    )
  }

  const handleExecutarEtapa = async (etapaDef: OnboardingEtapaDef) => {
    setProcessandoEtapa(etapaDef.etapa)
    try {
      // Se ainda não estava concluída, marca como concluída ao clicar e avisa com toast
      const jaConcluida = concluidasSet.has(etapaDef.etapa)
      if (!jaConcluida) {
        const resultado = await onboardingGestorService.alternarEtapa(
          tenantId,
          gestorUserId,
          etapaDef.etapa,
          true,
        )
        toast({
          title: 'Etapa concluída!',
          description: `Você avançou no checklist: "${etapaDef.titulo}".`,
        })

        if (resultado.todasConcluidas) {
          toast({
            title: 'Parabéns! Checklist 100% concluído 🎉',
            description: 'Você completou todas as etapas do onboarding da liderança!',
          })
        }
        onProgressoAtualizado()
      }

      // Navegar para o link da etapa
      if (etapaDef.link.startsWith('#')) {
        const el = document.querySelector(etapaDef.link)
        el?.scrollIntoView({ behavior: 'smooth' })
      } else {
        navigate(etapaDef.link)
      }
    } catch (err) {
      console.error('Erro ao marcar etapa do onboarding:', err)
      toast({
        title: 'Erro ao registrar progresso',
        description: 'Não foi possível salvar o status da etapa.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoEtapa(null)
    }
  }

  const handleAlternarCheck = async (etapaNum: number, estadoAtual: boolean) => {
    setProcessandoEtapa(etapaNum)
    try {
      const resultado = await onboardingGestorService.alternarEtapa(
        tenantId,
        gestorUserId,
        etapaNum,
        !estadoAtual,
      )
      toast({
        title: !estadoAtual ? 'Etapa marcada como concluída' : 'Etapa desmarcada',
        description: 'Progresso de onboarding atualizado.',
      })
      if (resultado.todasConcluidas && !estadoAtual) {
        toast({
          title: 'Parabéns! Checklist 100% concluído 🎉',
          description: 'Você completou todas as etapas do onboarding da liderança!',
        })
      }
      onProgressoAtualizado()
    } catch (err) {
      console.error('Erro ao alternar etapa:', err)
    } finally {
      setProcessandoEtapa(null)
    }
  }

  return (
    <Card className="border-2 border-[#0D47A1]/30 bg-gradient-to-r from-blue-50/70 via-white to-blue-50/30 shadow-sm transition-all overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-row items-center justify-between space-y-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#0D47A1] text-white flex items-center justify-center shadow-xs shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-slate-900">
                Onboarding do Gestor — Primeiros Passos
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-blue-100/80 text-[#0D47A1] border-blue-300 font-bold text-[11px]"
              >
                {percentual}% concluído
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Guia rápido de integração para gestores recém-assumidos na liderança de pessoas.
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {reabertoManualmente && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReabertoManualmente(false)}
              className="text-xs text-slate-500 hover:text-slate-800 h-8"
            >
              Fechar visualização
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setColapsado(!colapsado)}
            className="h-8 w-8 text-slate-600 hover:text-slate-900"
            title={colapsado ? 'Expandir checklist' : 'Recolher checklist'}
          >
            {colapsado ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {/* Barra de Progresso no Topo */}
      <div className="px-4 sm:px-5 pt-3 pb-1">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
          <span>Progresso do checklist</span>
          <span className="font-mono text-[#0D47A1]">{concluidasSet.size} de 5 etapas</span>
        </div>
        <Progress value={percentual} className="h-2 bg-slate-200" />
      </div>

      {/* Conteúdo Expansível com as 5 Etapas */}
      {!colapsado && (
        <CardContent className="p-4 sm:p-5 pt-3 space-y-3">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
            {ETAPAS_ONBOARDING_GESTOR.map((etapaDef) => {
              const concluida = concluidasSet.has(etapaDef.etapa)
              const estaProcessando = processandoEtapa === etapaDef.etapa

              return (
                <div
                  key={etapaDef.etapa}
                  className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    concluida ? 'bg-slate-50/50' : 'hover:bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleAlternarCheck(etapaDef.etapa, concluida)}
                      disabled={estaProcessando}
                      className="mt-0.5 text-slate-400 hover:text-[#0D47A1] transition-colors focus:outline-hidden"
                      title={concluida ? 'Marcar como não concluída' : 'Marcar como concluída'}
                    >
                      {concluida ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 fill-emerald-50" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-300" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Etapa {etapaDef.etapa}
                        </span>
                        <h4
                          className={`text-sm font-bold truncate ${
                            concluida ? 'text-slate-500 line-through' : 'text-slate-900'
                          }`}
                        >
                          {etapaDef.titulo}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                        {etapaDef.descricao}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant={concluida ? 'outline' : 'default'}
                      onClick={() => handleExecutarEtapa(etapaDef)}
                      disabled={estaProcessando}
                      className={`h-8 text-xs font-semibold gap-1.5 shadow-xs ${
                        concluida
                          ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                          : 'bg-[#0D47A1] hover:bg-[#0b3c8a] text-white'
                      }`}
                    >
                      <span>{concluida ? 'Acessar novamente' : 'Fazer agora'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
