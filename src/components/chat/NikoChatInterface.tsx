import React, { useState, useEffect, useRef } from 'react'
import {
  Send,
  Sparkles,
  User,
  RotateCcw,
  Scale,
  ShieldAlert,
  Loader2,
  ChevronRight,
  BookOpen,
  MessageSquare,
  Copy,
  Check,
} from 'lucide-react'
import { NIKO_ROBOT_AVATAR_URL } from '@/lib/nikoAsset'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { nikoRhService, type NikoConversationSummary } from '@/services/nikoRhService'
import type { DisplayMessage, AgentCitation } from '@/lib/skipAi'

interface NikoChatInterfaceProps {
  initialConversationId?: string | null
  onConversationChange?: (id: string | null) => void
  isCompact?: boolean
  className?: string
}

const SUGESTOES_RAPIDAS = [
  'Como funciona o vencimento das minhas férias pela CLT?',
  'O que significa "autonomia com responsabilidade" na Tesla?',
  'Qual o intervalo mínimo para almoço numa jornada de 8h?',
  'Qual o prazo para entrega de atestado médico?',
  'Como solicitar adiantamento do 13º salário nas férias?',
  'Quais são os principais canais de ouvidoria e ética?',
]

export const NikoChatInterface: React.FC<NikoChatInterfaceProps> = ({
  initialConversationId = null,
  onConversationChange,
  isCompact = false,
  className = '',
}) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [recentConversations, setRecentConversations] = useState<NikoConversationSummary[]>([])
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Scroll automático para a última mensagem
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  useEffect(() => {
    scrollToBottom(false)
  }, [messages])

  // Carregar histórico de conversas
  const loadConversationsList = async () => {
    try {
      const list = await nikoRhService.listConversations(15)
      setRecentConversations(list)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadConversationsList()
  }, [])

  // Carregar mensagens caso uma conversa seja selecionada
  useEffect(() => {
    let isCancelled = false

    async function loadThread(id: string) {
      setIsLoadingHistory(true)
      try {
        const msgs = await nikoRhService.loadConversationMessages(id)
        if (!isCancelled) {
          setMessages(msgs)
        }
      } catch (err) {
        console.warn('Erro ao carregar thread selecionada:', err)
      } finally {
        if (!isCancelled) {
          setIsLoadingHistory(false)
        }
      }
    }

    if (conversationId) {
      loadThread(conversationId)
    } else {
      setMessages([])
    }

    return () => {
      isCancelled = true
    }
  }, [conversationId])

  const handleSelectConversation = (id: string) => {
    setConversationId(id)
    onConversationChange?.(id)
    setShowHistoryDrawer(false)
  }

  const handleNewConversation = () => {
    setConversationId(null)
    setMessages([])
    setInputText('')
    onConversationChange?.(null)
    setShowHistoryDrawer(false)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const handleSend = async (messageToSend?: string) => {
    const text = (messageToSend || inputText).trim()
    if (!text || isLoading) return

    setInputText('')

    // Cria ID provisório para a mensagem do usuário
    const userMsgId = `user-${Date.now()}`
    const botMsgId = `bot-${Date.now()}`

    const newMessages: DisplayMessage[] = [
      ...messages,
      {
        id: userMsgId,
        role: 'user',
        content: text,
        created: new Date().toISOString(),
      },
      {
        id: botMsgId,
        role: 'assistant',
        content: '',
        created: new Date().toISOString(),
      },
    ]

    setMessages(newMessages)
    setIsLoading(true)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      let accumulatedText = ''
      let capturedCitations: AgentCitation[] | undefined

      const result = await nikoRhService.sendMessageStream({
        message: text,
        conversationId,
        signal: abortController.signal,
        onChunk: (_delta, full) => {
          accumulatedText = full
          setMessages((prev) => prev.map((m) => (m.id === botMsgId ? { ...m, content: full } : m)))
        },
        onCitations: (citations) => {
          capturedCitations = citations
          setMessages((prev) => prev.map((m) => (m.id === botMsgId ? { ...m, citations } : m)))
        },
      })

      // Atualiza estado final da conversa
      const updatedConvId = result.conversationId || conversationId
      if (updatedConvId && updatedConvId !== conversationId) {
        setConversationId(updatedConvId)
        onConversationChange?.(updatedConvId)
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                id: result.messageId || botMsgId,
                content: result.content || accumulatedText,
                citations: result.citations || capturedCitations,
              }
            : m,
        ),
      )

      loadConversationsList()
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        return
      }

      const errorMessage =
        err instanceof Error ? err.message : 'Falha na comunicação com o assistente.'

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                content: `Desculpe, ocorreu um erro ao consultar o NIKO RH: ${errorMessage}\n\nPor favor, tente novamente em instantes ou contate a equipe de Gente e Gestão Tesla.`,
              }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className={`flex flex-col h-full bg-white rounded-xl overflow-hidden border border-[#E0E0E0] shadow-xs ${className}`}
    >
      {/* Header do Chat */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0D47A1] to-[#1565C0] text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 p-1 shrink-0 shadow-xs">
            <img
              src={NIKO_ROBOT_AVATAR_URL}
              alt="NIKO RH"
              loading="lazy"
              className="h-full w-full object-contain drop-shadow-xs"
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-white truncate">
                NIKO RH — Assistente Virtual
              </h2>
              <Badge className="bg-white/20 text-white hover:bg-white/30 text-[10px] font-semibold border-none px-1.5 py-0">
                IA Nativa
              </Badge>
            </div>
            <p className="text-[11px] text-blue-100 truncate">
              Legislação Trabalhista • Cultura Tesla • Direitos & Obrigações
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {recentConversations.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                  className="h-8 px-2 text-white hover:bg-white/15 text-xs gap-1"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {!isCompact && <span className="hidden sm:inline">Histórico</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Ver conversas recentes</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewConversation}
                className="h-8 px-2 text-white hover:bg-white/15 text-xs gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {!isCompact && <span className="hidden sm:inline">Nova conversa</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Iniciar nova conversa limpa</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Drawer de Histórico de Conversas (expansível no topo ou lateral) */}
      {showHistoryDrawer && (
        <div className="bg-[#F8F9FA] border-b border-[#E0E0E0] p-3 text-xs shrink-0 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-[#424242] flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-[#0D47A1]" />
              Conversas Recentes com NIKO RH
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistoryDrawer(false)}
              className="h-6 px-1.5 text-[11px] text-[#757575]"
            >
              Fechar
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 max-h-24">
            {recentConversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectConversation(c.id)}
                className={`text-left px-3 py-1.5 rounded-lg border text-xs shrink-0 max-w-[200px] transition-all ${
                  c.id === conversationId
                    ? 'bg-[#0D47A1] text-white border-[#0D47A1] shadow-2xs'
                    : 'bg-white text-[#212121] border-[#E0E0E0] hover:border-[#0D47A1]'
                }`}
              >
                <p className="font-medium truncate">{c.title || 'Consulta NIKO RH'}</p>
                <p
                  className={`text-[10px] truncate ${
                    c.id === conversationId ? 'text-blue-100' : 'text-[#757575]'
                  }`}
                >
                  {c.created ? new Date(c.created).toLocaleDateString('pt-BR') : 'Recente'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Corpo com Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAFAFA]">
        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-[#757575] space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#0D47A1]" />
            <p className="text-xs">Carregando conversa com o NIKO RH...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] py-6 px-2 text-center max-w-lg mx-auto space-y-4">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0D47A1]/10 to-[#1E88E5]/20 border border-[#0D47A1]/20 p-2 shadow-md">
              <img
                src={NIKO_ROBOT_AVATAR_URL}
                alt="NIKO RH"
                loading="lazy"
                className="h-full w-full object-contain drop-shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[#212121]">
                Olá, {user?.name?.split(' ')[0] || 'Colaborador'}! Eu sou o NIKO RH.
              </h3>
              <p className="text-xs text-[#616161] leading-relaxed">
                Seu parceiro de jornada profissional na Tesla Mecatrônica. Posso tirar dúvidas sobre
                a Consolidação das Leis do Trabalho (CLT), férias, jornada, atestados, nossa Cultura
                Tesla e o uso dos módulos da plataforma Gente e Gestão.
              </p>
            </div>

            {/* Sugestões Rápidas de Pergunta */}
            <div className="w-full space-y-2 pt-2">
              <p className="text-[11px] font-semibold text-[#757575] uppercase tracking-wider text-left">
                Perguntas Frequentes
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {SUGESTOES_RAPIDAS.slice(0, isCompact ? 3 : 6).map((sugestao, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(sugestao)}
                    className="flex items-start gap-2 p-2.5 rounded-lg border border-[#E0E0E0] bg-white hover:border-[#0D47A1]/50 hover:bg-[#E8EEF7]/40 text-xs text-[#212121] transition-all group"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-[#0D47A1] shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                    <span className="leading-snug">{sugestao}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user'

            return (
              <div
                key={msg.id}
                className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-2xs text-xs font-bold overflow-hidden ${
                    isUser ? 'bg-[#212121] text-white' : 'bg-white border border-[#0D47A1]/30 p-0.5'
                  }`}
                >
                  {isUser ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <img
                      src={NIKO_ROBOT_AVATAR_URL}
                      alt="NIKO RH"
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>

                {/* Balão de Mensagem */}
                <div
                  className={`relative group max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-[#0D47A1] text-white rounded-tr-xs'
                      : 'bg-white text-[#212121] border border-[#E0E0E0] rounded-tl-xs'
                  }`}
                >
                  {/* Conteúdo da Mensagem */}
                  <div className="whitespace-pre-wrap font-sans break-words space-y-1">
                    {msg.content ? (
                      msg.content
                    ) : (
                      <div className="flex items-center gap-2 text-[#757575] py-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0D47A1]" />
                        <span className="italic text-[11px]">
                          NIKO RH está formulando a resposta...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Citações / Fontes (se houver RAG ou ferramentas) */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-[#E0E0E0] space-y-1 text-[11px] text-[#616161]">
                      <span className="font-semibold text-[#0D47A1] flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        Fontes de Referência:
                      </span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {msg.citations.map((c, i) => (
                          <li key={i} className="text-[10px] text-[#757575]">
                            {c.excerpt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Ações da mensagem (ex: Copiar) */}
                  {!isUser && msg.content && (
                    <div className="mt-2 pt-1 flex items-center justify-between text-[10px] text-[#9E9E9E]">
                      <span className="flex items-center gap-1">
                        <Scale className="h-3 w-3 text-[#0D47A1]" />
                        Gente e Gestão Tesla
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 text-[#616161]"
                        title="Copiar texto"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Caixa de Entrada de Texto */}
      <div className="p-3 bg-white border-t border-[#E0E0E0] space-y-2 shrink-0">
        <div className="relative flex items-end gap-2 bg-[#F8F9FA] border border-[#E0E0E0] focus-within:border-[#0D47A1] focus-within:ring-1 focus-within:ring-[#0D47A1] rounded-xl p-2 transition-all">
          <Textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Pergunte ao NIKO RH sobre CLT, férias, ponto, Cultura Tesla ou direitos..."
            className="min-h-[44px] max-h-[140px] resize-none border-0 bg-transparent p-1 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 text-[#212121] placeholder:text-[#9E9E9E]"
            rows={1}
          />

          <Button
            type="button"
            size="sm"
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
            className="h-9 px-3 bg-[#0D47A1] hover:bg-[#0A3A82] text-white shrink-0 rounded-lg shadow-2xs transition-all"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Aviso Obrigatório de Limitação */}
        <div className="flex items-center justify-center gap-1.5 text-[10.5px] text-[#757575] text-center px-2">
          <ShieldAlert className="h-3.5 w-3.5 text-[#0D47A1] shrink-0" />
          <span>
            O NIKO RH não substitui o RH humano e não constitui orientação jurídica formal.
          </span>
        </div>
      </div>
    </div>
  )
}
