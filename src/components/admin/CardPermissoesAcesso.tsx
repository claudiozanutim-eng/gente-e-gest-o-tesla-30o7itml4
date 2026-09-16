import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Check,
  X,
  RotateCcw,
  Info,
  Save,
  Loader2,
  Sliders,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { AppUser, PermissoesFlags, FlagPermissaoEstado, PermissaoMenuKey } from '@/types'
import {
  ITENS_PERMISSAO_CATALOGO,
  ItemPermissaoConfig,
  permissaoUsuarioService,
} from '@/services/permissaoUsuarioService'

interface CardPermissoesAcessoProps {
  usuario: AppUser
  currentUser: AppUser
  onPermissoesSalvas?: () => void
  onFechar?: () => void
}

export const CardPermissoesAcesso: React.FC<CardPermissoesAcessoProps> = ({
  usuario,
  currentUser,
  onPermissoesSalvas,
  onFechar,
}) => {
  const { toast } = useToast()
  const tenantId = currentUser?.tenant_id

  const isCurrentUserAdminGeral = currentUser.perfil === 'admin'
  const isTargetAdminGeral = usuario.perfil === 'admin'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flags, setFlags] = useState<PermissoesFlags>({})
  const [flagsOriginais, setFlagsOriginais] = useState<PermissoesFlags>({})
  const [filtroGrupo, setFiltroGrupo] = useState<string>('todos')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')

  useEffect(() => {
    let isMounted = true

    const carregarPermissoes = async () => {
      try {
        setLoading(true)
        const record = await permissaoUsuarioService.getPermissaoPorUsuario(usuario.id)
        if (isMounted) {
          const loadedFlags = record?.flags_json || {}
          setFlags(loadedFlags)
          setFlagsOriginais(loadedFlags)
        }
      } catch (err) {
        console.error('Erro ao carregar permissões do usuário:', err)
        toast({
          title: 'Aviso',
          description: 'Não foi possível carregar as flags personalizadas.',
          variant: 'destructive',
        })
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    carregarPermissoes()
    return () => {
      isMounted = false
    }
  }, [usuario.id])

  const handleMudarEstado = (key: PermissaoMenuKey, novoEstado: FlagPermissaoEstado) => {
    setFlags((prev) => {
      const updated = { ...prev }
      if (novoEstado === 'padrao') {
        delete updated[key]
      } else {
        updated[key] = novoEstado
      }
      return updated
    })
  }

  const handleResetarTudoPadrao = () => {
    setFlags({})
  }

  const hasMudancas = JSON.stringify(flags) !== JSON.stringify(flagsOriginais)

  const handleSalvar = async () => {
    if (!tenantId || !currentUser.id) return

    try {
      setSaving(true)
      await permissaoUsuarioService.salvarFlagsPermissao({
        tenantId,
        userId: usuario.id,
        targetUserName: usuario.name || usuario.email,
        novasFlags: flags,
        responsavelId: currentUser.id,
        responsavelNome: currentUser.name || currentUser.email,
      })

      setFlagsOriginais(flags)
      toast({
        title: 'Permissões atualizadas com sucesso!',
        description: `As alçadas e flags de liberação de ${usuario.name || usuario.email} foram gravadas.`,
      })

      onPermissoesSalvas?.()
    } catch (err: any) {
      console.error('Erro ao salvar flags:', err)
      toast({
        title: 'Erro ao salvar permissões',
        description: err?.message || 'Ocorreu uma falha ao persistir as permissões.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Grupos do catálogo organizados pelos 3 pilares + Administração
  const grupos: { id: string; label: string }[] = [
    { id: 'todos', label: 'Todos os Módulos' },
    { id: 'talentos', label: 'Gestão de Talentos' },
    { id: 'pessoas', label: 'Gestão de Pessoas' },
    { id: 'tempo', label: 'Gestão do Tempo' },
    { id: 'administracao', label: 'Administração' },
  ]

  // Contadores
  const totalItens = ITENS_PERMISSAO_CATALOGO.length
  const totalLiberados = ITENS_PERMISSAO_CATALOGO.filter(
    (i) => (flags[i.key] || 'padrao') === 'liberado',
  ).length
  const totalBloqueados = ITENS_PERMISSAO_CATALOGO.filter(
    (i) => (flags[i.key] || 'padrao') === 'bloqueado',
  ).length
  const totalPadrao = totalItens - totalLiberados - totalBloqueados

  const itensFiltrados = ITENS_PERMISSAO_CATALOGO.filter((item) => {
    if (filtroGrupo !== 'todos' && item.grupo !== filtroGrupo) return false
    const estado = flags[item.key] || 'padrao'
    if (filtroEstado !== 'todos' && estado !== filtroEstado) return false
    return true
  })

  return (
    <Card className="border-2 border-[#0D47A1]/30 bg-white shadow-md overflow-hidden animate-in fade-in-50 duration-200">
      {/* Header do Card */}
      <CardHeader className="bg-gradient-to-r from-[#0D47A1]/10 via-[#0D47A1]/5 to-transparent border-b border-[#E0E0E0] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#0D47A1] text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-[#212121]">
                  Flags de Liberação & Alçadas de Acesso
                </CardTitle>
                <Badge className="bg-[#0D47A1] text-white text-[10px] font-semibold">
                  {usuario.name || usuario.email}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-white text-[#424242] border-[#E0E0E0] text-[10px] font-medium"
                >
                  Perfil base: <strong>{usuario.perfil}</strong>
                </Badge>
              </div>
              <CardDescription className="text-xs text-[#616161] mt-1">
                Defina exceções individuais por usuário: conceda acesso a itens fora do perfil ou
                bloqueie módulos específicos mantendo o perfil base como referência.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {onFechar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onFechar}
                className="h-8 text-xs text-[#757575] hover:text-[#212121]"
              >
                Fechar
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSalvar}
              disabled={saving || loading || !hasMudancas}
              className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-8 gap-1.5 shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Salvar Permissões
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Resumo visual dos estados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-2 border-t border-[#0D47A1]/10">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/70 border border-[#E0E0E0]">
            <div className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            <div className="text-[11px]">
              <span className="font-bold text-[#212121]">{totalPadrao}</span>
              <span className="text-[#757575] ml-1">Padrão Perfil</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/70 border border-emerald-200">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            <div className="text-[11px]">
              <span className="font-bold text-emerald-800">{totalLiberados}</span>
              <span className="text-emerald-700 ml-1">Liberados (Extra)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50/70 border border-rose-200">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-600" />
            <div className="text-[11px]">
              <span className="font-bold text-rose-800">{totalBloqueados}</span>
              <span className="text-rose-700 ml-1">Bloqueados</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-white/70 border border-[#E0E0E0]">
            <span className="text-[11px] text-[#616161] font-medium">Resetar</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetarTudoPadrao}
              disabled={loading || Object.keys(flags).length === 0}
              className="h-6 px-1.5 text-[10px] text-[#C62828] hover:bg-rose-50 hover:text-[#B71C1C]"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Tudo Padrão
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Conteúdo com Filtros e Lista de Flags */}
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Barra de Filtro de Grupo */}
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#F0F0F0] pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {grupos.map((g) => (
              <button
                key={g.id}
                onClick={() => setFiltroGrupo(g.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                  filtroGrupo === g.id
                    ? 'bg-[#0D47A1] text-white shadow-2xs'
                    : 'bg-[#F5F5F5] text-[#616161] hover:bg-[#E8EEF7] hover:text-[#0D47A1]'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#757575]">
            <span className="text-[11px]">Estado:</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="h-7 text-xs rounded border border-[#E0E0E0] bg-white px-2 text-[#212121]"
            >
              <option value="todos">Todos</option>
              <option value="padrao">Padrão</option>
              <option value="liberado">Liberado</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
          </div>
        </div>

        {/* Tabela / Grid de Flags */}
        {loading ? (
          <div className="p-8 text-center text-xs text-[#757575] flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#0D47A1]" />
            Carregando alçadas de permissão...
          </div>
        ) : (
          <div className="space-y-2">
            {itensFiltrados.map((item) => {
              const estadoAtual: FlagPermissaoEstado = flags[item.key] || 'padrao'
              const temAcessoPadrao = item.perfisPadrao.includes(usuario.perfil)

              // Regra de Trava:
              // Se o item for restrito a admin geral e o usuário logado não for admin geral,
              // ele fica bloqueado com cadeado.
              const bloqueadoParaAdminRH = item.apenasAdminGeral && !isCurrentUserAdminGeral

              // Status efetivo final
              const temAcessoEfetivo =
                estadoAtual === 'liberado'
                  ? true
                  : estadoAtual === 'bloqueado'
                    ? false
                    : temAcessoPadrao

              return (
                <div
                  key={item.key}
                  className={`p-3 rounded-lg border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    estadoAtual === 'liberado'
                      ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs'
                      : estadoAtual === 'bloqueado'
                        ? 'bg-rose-50/50 border-rose-300 shadow-2xs'
                        : 'bg-white border-[#E0E0E0] hover:border-[#BDBDBD]'
                  }`}
                >
                  {/* Informações do item */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#212121] truncate">
                        {item.label}
                      </span>

                      {/* Badge do Padrão do perfil */}
                      <Badge
                        variant="outline"
                        className={`text-[9.5px] px-1.5 py-0 font-medium ${
                          temAcessoPadrao
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}
                        title="Permissão nativa do cargo/perfil base"
                      >
                        Padrão: {temAcessoPadrao ? 'Permitido' : 'Sem acesso'}
                      </Badge>

                      {/* Status Efetivo */}
                      <Badge
                        className={`text-[9.5px] px-1.5 py-0 font-bold ${
                          temAcessoEfetivo ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}
                      >
                        {temAcessoEfetivo ? 'Acesso Ativo' : 'Acesso Negado'}
                      </Badge>

                      {item.apenasAdminGeral && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-semibold cursor-help">
                              <Lock className="h-3 w-3" />
                              Apenas Admin Geral
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-xs">
                            Esta alçada é de governança sensível e só pode ser alterada pelo
                            Administrador Geral.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    <p className="text-[11px] text-[#616161] leading-relaxed">{item.descricao}</p>
                  </div>

                  {/* Seletor de 3 Estados (Segmented Control) */}
                  <div className="shrink-0 flex items-center justify-end">
                    {bloqueadoParaAdminRH ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 border border-gray-300 text-gray-500 text-xs font-medium cursor-not-allowed">
                            <Lock className="h-3.5 w-3.5 text-gray-500" />
                            <span>Bloqueado para edição</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs max-w-xs">
                          Você precisa do perfil de Administrador Geral para conceder ou revogar
                          esta permissão.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <div className="inline-flex rounded-lg border border-[#E0E0E0] p-0.5 bg-[#F5F5F5]">
                        {/* 1. Padrão */}
                        <button
                          type="button"
                          onClick={() => handleMudarEstado(item.key, 'padrao')}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 ${
                            estadoAtual === 'padrao'
                              ? 'bg-white text-[#212121] shadow-xs'
                              : 'text-[#757575] hover:text-[#212121]'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              temAcessoPadrao ? 'bg-blue-500' : 'bg-gray-400'
                            }`}
                          />
                          Padrão
                        </button>

                        {/* 2. Liberado */}
                        <button
                          type="button"
                          onClick={() => handleMudarEstado(item.key, 'liberado')}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 ${
                            estadoAtual === 'liberado'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-[#757575] hover:text-emerald-700'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                          Liberado
                        </button>

                        {/* 3. Bloqueado */}
                        <button
                          type="button"
                          onClick={() => handleMudarEstado(item.key, 'bloqueado')}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 ${
                            estadoAtual === 'bloqueado'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-[#757575] hover:text-rose-700'
                          }`}
                        >
                          <X className="h-3 w-3" />
                          Bloqueado
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Informação sobre trilha de auditoria */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[#E8EEF7]/50 border border-[#0D47A1]/20 text-xs text-[#0D47A1]">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Trilha de Auditoria e Conformidade:</strong> Qualquer mudança nas flags de
            liberação é registrada na coleção <code>log_auditoria</code>, identificando o
            responsável pela concessão, a data/hora e o estado anterior/novo das permissões.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
