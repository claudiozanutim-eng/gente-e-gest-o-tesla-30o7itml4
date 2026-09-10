import React, { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  Check,
  CheckCheck,
  Calendar,
  Clock,
  FileText,
  UserCheck,
  Award,
  Megaphone,
  Info,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Notificacao, NotificacaoTipo } from '@/types'
import { notificacaoService } from '@/services/notificacaoService'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'

function formatarTempoRelativoNotif(dataIso: string): string {
  if (!dataIso) return ''
  const agora = new Date()
  const d = new Date(dataIso)
  const diffSeg = Math.floor((agora.getTime() - d.getTime()) / 1000)

  if (diffSeg < 60) return 'agora'
  const diffMin = Math.floor(diffSeg / 60)
  if (diffMin < 60) return `há ${diffMin} min`
  const diffHoras = Math.floor(diffMin / 60)
  if (diffHoras < 24) return `há ${diffHoras}h`
  const diffDias = Math.floor(diffHoras / 24)
  if (diffDias === 1) return 'ontem'
  if (diffDias < 7) return `há ${diffDias} dias`
  return d.toLocaleDateString('pt-BR')
}

function getIconeNotificacao(tipo: NotificacaoTipo) {
  switch (tipo) {
    case 'ferias':
      return <Calendar className="h-4 w-4 text-emerald-600" />
    case 'compensacao':
      return <Clock className="h-4 w-4 text-blue-600" />
    case 'atestado':
      return <FileText className="h-4 w-4 text-amber-600" />
    case 'holerite':
      return <FileText className="h-4 w-4 text-indigo-600" />
    case 'comunicado':
      return <Megaphone className="h-4 w-4 text-purple-600" />
    case 'cadastro':
      return <UserCheck className="h-4 w-4 text-sky-600" />
    case 'avaliacao':
      return <Award className="h-4 w-4 text-amber-500" />
    default:
      return <Info className="h-4 w-4 text-slate-500" />
  }
}

export const NotificacoesDropdown: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [naoLidasCount, setNaoLidasCount] = useState<number>(0)
  const [menuAberto, setMenuAberto] = useState(false)

  const carregarNotificacoes = useCallback(async () => {
    if (!user?.id) return
    const lista = await notificacaoService.getNotificacoesUsuario(user.id, 20)
    setNotificacoes(lista)
    setNaoLidasCount(lista.filter((n) => !n.lida).length)
  }, [user?.id])

  useEffect(() => {
    carregarNotificacoes()

    if (!user?.id) return

    // Assinar mudanças via Realtime do PocketBase com tratamento seguro de ciclo de vida
    let unsubscribeFn: (() => Promise<void> | void) | undefined
    let cancelada = false

    pb.collection('notificacao')
      .subscribe('*', (e) => {
        if (e.record && (e.record.destinatario_id === user.id || !e.record.destinatario_id)) {
          carregarNotificacoes()
        }
      })
      .then((unsub) => {
        if (cancelada) {
          try {
            const res = unsub()
            if (res && typeof res.catch === 'function') {
              res.catch(() => {})
            }
          } catch {
            // Ignora erro ao desinscrever se desmontado
          }
        } else {
          unsubscribeFn = unsub
        }
      })
      .catch((err) => {
        // Log discreto — serviço se auto-recupera via fallback
        if (import.meta.env.DEV) {
          console.debug('Realtime para notificações temporariamente indisponível:', err)
        }
      })

    return () => {
      cancelada = true
      if (unsubscribeFn) {
        try {
          const res = unsubscribeFn()
          if (res && typeof res.catch === 'function') {
            res.catch(() => {})
          }
        } catch {
          // Ignora silenciosamente erros no cleanup
        }
      } else {
        pb.collection('notificacao')
          .unsubscribe('*')
          .catch(() => {})
      }
    }
  }, [user?.id, carregarNotificacoes])

  const handleClicarNotificacao = async (notif: Notificacao) => {
    // 1. Marca como lida
    if (!notif.lida) {
      await notificacaoService.marcarComoLida(notif.id)
      setNotificacoes((prev) =>
        prev.map((item) => (item.id === notif.id ? { ...item, lida: true } : item)),
      )
      setNaoLidasCount((prev) => Math.max(0, prev - 1))
    }

    // 2. Fecha dropdown e redireciona para o link da notificação
    setMenuAberto(false)
    if (notif.link) {
      navigate(notif.link)
    }
  }

  const handleMarcarTodasLidas = async () => {
    if (!user?.id) return
    await notificacaoService.marcarTodasComoLidas(user.id)
    setNotificacoes((prev) => prev.map((item) => ({ ...item, lida: true })))
    setNaoLidasCount(0)
  }

  return (
    <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg h-9 w-9"
          title="Notificações"
          aria-label="Abrir notificações"
        >
          <Bell className="h-4.5 w-4.5" />
          {naoLidasCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-in fade-in">
              {naoLidasCount > 9 ? '9+' : naoLidasCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-0 bg-white shadow-lg border border-slate-200"
      >
        <div className="flex items-center justify-between p-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-slate-800">Notificações</span>
            {naoLidasCount > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] bg-blue-100 text-[#0D47A1] font-bold py-0 h-4"
              >
                {naoLidasCount} nova{naoLidasCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {naoLidasCount > 0 && (
            <button
              onClick={handleMarcarTodasLidas}
              className="text-[11px] text-[#0D47A1] hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar lidas
            </button>
          )}
        </div>

        <ScrollArea className="max-h-80 overflow-y-auto">
          {notificacoes.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <Bell className="h-7 w-7 text-slate-300 mx-auto mb-2" />
              <p>Nenhuma notificação no momento</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notificacoes.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleClicarNotificacao(notif)}
                  className={`p-3 text-xs flex items-start gap-3 cursor-pointer transition-colors ${
                    notif.lida
                      ? 'bg-white hover:bg-slate-50 text-slate-600'
                      : 'bg-blue-50/60 hover:bg-blue-50 font-medium text-slate-900'
                  }`}
                >
                  <div className="p-1.5 rounded-full bg-white shadow-2xs border border-slate-200 shrink-0 mt-0.5">
                    {getIconeNotificacao(notif.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-xs text-slate-900 truncate">
                        {notif.titulo}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                        {formatarTempoRelativoNotif(notif.created)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {notif.mensagem}
                    </p>
                  </div>
                  {!notif.lida && (
                    <span className="h-2 w-2 rounded-full bg-[#0D47A1] shrink-0 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
