import React, { useState } from 'react'
import { X, Minimize2, Maximize2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NikoChatInterface } from '@/components/chat/NikoChatInterface'
import { NIKO_ROBOT_AVATAR_URL } from '@/lib/nikoAsset'
import { useAuth } from '@/context/AuthContext'
import { usePermission } from '@/hooks/usePermission'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const NikoFloatingWidget: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const { podeAcessarItem } = usePermission()
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // O assistente está disponível para todos os usuários autenticados,
  // respeitando bloqueio explícito via permissao_usuario se configurado
  if (!isAuthenticated) {
    return null
  }

  // Verifica se a flag niko_rh não foi expressamente bloqueada
  if (!podeAcessarItem('niko_rh')) {
    return null
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end select-none print:hidden">
      {/* Janela de Chat Aberta */}
      {isOpen && (
        <div
          className={`mb-3 flex flex-col bg-white rounded-2xl shadow-2xl border border-[#0D47A1]/20 overflow-hidden transition-all duration-200 animate-in fade-in-50 zoom-in-95 ${
            isExpanded
              ? 'w-[92vw] sm:w-[600px] md:w-[700px] h-[82vh] max-h-[780px]'
              : 'w-[92vw] sm:w-[380px] md:w-[420px] h-[540px] max-h-[82vh]'
          }`}
        >
          {/* Barra de Controles superior do Widget */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0A3A82] text-white border-b border-white/10 shrink-0">
            <span className="text-[11px] font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-300" />
              Gente e Gestão Tesla • Assistente 24/7
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 text-white hover:bg-white/20"
                title={isExpanded ? 'Restaurar tamanho' : 'Maximizar janela'}
              >
                {isExpanded ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 text-white hover:bg-white/20"
                title="Minimizar assistente"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Componente Central de Chat */}
          <div className="flex-1 min-h-0">
            <NikoChatInterface
              isCompact={!isExpanded}
              className="h-full border-0 rounded-none shadow-none"
            />
          </div>
        </div>
      )}

      {/* Botão Flutuante (Launcher) */}
      {!isOpen && (
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label="Abrir assistente virtual NIKO RH"
              className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-[#0D47A1] ring-4 ring-[#0D47A1]/20 cursor-pointer p-1 overflow-hidden"
            >
              <img
                src={NIKO_ROBOT_AVATAR_URL}
                alt="NIKO RH"
                loading="lazy"
                className="h-full w-full object-contain drop-shadow-xs transition-transform group-hover:scale-110"
              />

              {/* Indicador de Status Ativo */}
              <span className="absolute top-0 right-0 flex h-3.5 w-3.5 -mt-0.5 -mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
              </span>

              {/* Tag flutuante sutil ao passar o mouse */}
              <span className="absolute -left-2 top-1/2 -translate-x-full -translate-y-1/2 hidden group-hover:md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#212121] text-white text-[11px] font-semibold shadow-lg whitespace-nowrap pointer-events-none">
                <Sparkles className="h-3 w-3 text-amber-300" />
                NIKO RH
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="left"
            className="bg-[#212121] text-white text-xs font-semibold py-1.5 px-3"
          >
            Fale com o NIKO RH — Assistente Virtual
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
