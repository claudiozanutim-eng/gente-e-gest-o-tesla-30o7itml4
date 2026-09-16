import React, { useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  Shield,
  Edit2,
  Lock,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldAlert,
  Loader2,
  Mail,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { userService, logAuditoriaService } from '@/services/api'
import { AppUser, UserPerfil } from '@/types'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { CardPermissoesAcesso } from '@/components/admin/CardPermissoesAcesso'

export default function AdminUsuariosPage() {
  const { user: currentUser, refreshUserFlags } = useAuth()
  const tenantId = currentUser?.tenant_id
  const { toast } = useToast()

  // Permissão do usuário logado: apenas 'admin_rh' e 'admin' enxergam/editam o card de permissões
  const isPodeGerenciarPermissoes =
    currentUser?.perfil === 'admin' || currentUser?.perfil === 'admin_rh'

  const [usuarios, setUsuarios] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Usuário selecionado para o Card de Permissões de Acesso
  const [usuarioSelecionadoPermissoes, setUsuarioSelecionadoPermissoes] = useState<AppUser | null>(
    null,
  )

  // Modais
  const [modalNovoUsuarioOpen, setModalNovoUsuarioOpen] = useState(false)
  const [modalEditarOpen, setModalEditarOpen] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<AppUser | null>(null)

  // Form Novo Usuário
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoPerfil, setNovoPerfil] = useState<UserPerfil>('colaborador')
  const [savingNovo, setSavingNovo] = useState(false)

  // Form Editar Usuário
  const [editPerfil, setEditPerfil] = useState<UserPerfil>('colaborador')
  const [editSenha, setEditSenha] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const carregarUsuarios = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const list = await userService.getUsersByTenant(tenantId)
      setUsuarios(list)

      // Se havia um usuário selecionado para permissões, atualiza a referência dele
      if (usuarioSelecionadoPermissoes) {
        const updatedTarget = list.find((u) => u.id === usuarioSelecionadoPermissoes.id)
        if (updatedTarget) setUsuarioSelecionadoPermissoes(updatedTarget)
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os usuários.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarUsuarios()
  }, [tenantId])

  // Criar Usuário
  const handleCriarUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim() || !novoEmail.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome e o e-mail do usuário.',
        variant: 'destructive',
      })
      return
    }

    if (!tenantId || !currentUser?.id) return

    try {
      setSavingNovo(true)
      const created = await userService.createUser({
        tenant_id: tenantId,
        name: novoNome.trim(),
        email: novoEmail.trim().toLowerCase(),
        password: novaSenha.trim() || 'Skip@Pass',
        perfil: novoPerfil,
      })

      // Auditoria
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: currentUser.id,
        acao: 'criacao_usuario',
        entidade: 'users',
        entidade_id: created.id,
        dados_json: {
          nome: created.name,
          email: created.email,
          perfil: created.perfil,
          admin_responsavel: currentUser.name,
        },
      })

      setUsuarios((prev) => [created, ...prev])
      setModalNovoUsuarioOpen(false)

      setNovoNome('')
      setNovoEmail('')
      setNovaSenha('')
      setNovoPerfil('colaborador')

      toast({
        title: 'Usuário criado com sucesso!',
        description: `O acesso para ${created.name} (${created.perfil}) foi configurado no sistema.`,
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao criar usuário',
        description:
          err?.data?.data?.email?.message || 'Verifique se o e-mail já não está cadastrado.',
        variant: 'destructive',
      })
    } finally {
      setSavingNovo(false)
    }
  }

  // Abrir Modal de Edição
  const handleAbrirEditar = (user: AppUser) => {
    setUsuarioEditando(user)
    setEditPerfil(user.perfil)
    setEditSenha('')
    setModalEditarOpen(true)
  }

  // Salvar Edição (Perfil e/ou Redefinição de Senha)
  const handleSalvarEditar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuarioEditando || !tenantId || !currentUser?.id) return

    try {
      setSavingEdit(true)

      // 1. Atualiza Perfil se mudou
      if (editPerfil !== usuarioEditando.perfil) {
        await userService.updateUserPerfil(usuarioEditando.id, editPerfil)
      }

      // 2. Redefine senha se preenchida
      if (editSenha.trim()) {
        await userService.resetUserPassword(usuarioEditando.id, editSenha.trim())
      }

      // Auditoria
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: currentUser.id,
        acao: 'edicao_usuario',
        entidade: 'users',
        entidade_id: usuarioEditando.id,
        dados_json: {
          usuario_afetado: usuarioEditando.name,
          perfil_anterior: usuarioEditando.perfil,
          perfil_novo: editPerfil,
          senha_redefinida: !!editSenha.trim(),
        },
      })

      setUsuarios((prev) =>
        prev.map((u) => (u.id === usuarioEditando.id ? { ...u, perfil: editPerfil } : u)),
      )

      setModalEditarOpen(false)
      toast({
        title: 'Usuário atualizado com sucesso!',
        description: editSenha.trim()
          ? 'O perfil e a nova senha de acesso foram atualizados.'
          : 'O perfil de acesso foi atualizado.',
      })
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err)
      toast({
        title: 'Erro ao salvar alterações',
        description: 'Não foi possível atualizar os dados do usuário.',
        variant: 'destructive',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  // Soft-delete: Alternar Ativo/Desativado
  const handleToggleAtivo = async (user: AppUser) => {
    const isAtivo = user.ativo !== false
    const novoAtivo = !isAtivo

    if (user.id === currentUser?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode desativar o seu próprio usuário de administrador.',
        variant: 'destructive',
      })
      return
    }

    try {
      await userService.toggleUserAtivo(user.id, novoAtivo)

      // Auditoria
      if (tenantId && currentUser?.id) {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: currentUser.id,
          acao: novoAtivo ? 'reativacao_usuario' : 'desativacao_usuario',
          entidade: 'users',
          entidade_id: user.id,
          dados_json: {
            nome: user.name,
            email: user.email,
            status: novoAtivo ? 'ativo' : 'desativado',
          },
        })
      }

      setUsuarios((prev) => prev.map((u) => (u.id === user.id ? { ...u, ativo: novoAtivo } : u)))

      toast({
        title: novoAtivo ? 'Usuário reativado' : 'Usuário desativado (soft delete)',
        description: novoAtivo
          ? `O acesso de ${user.name} foi restabelecido.`
          : `O usuário ${user.name} foi inativado e não poderá mais efetuar login. O histórico permanece preservado.`,
      })
    } catch {
      toast({
        title: 'Erro ao alterar status',
        description: 'Não foi possível modificar o estado do usuário.',
        variant: 'destructive',
      })
    }
  }

  // Filtragem
  const usuariosFiltrados = usuarios.filter((u) => {
    const isAtivo = u.ativo !== false
    if (filtroStatus === 'ativo' && !isAtivo) return false
    if (filtroStatus === 'desativado' && isAtivo) return false
    if (filtroPerfil !== 'todos' && u.perfil !== filtroPerfil) return false

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const matchName = (u.name || '').toLowerCase().includes(term)
      const matchEmail = (u.email || '').toLowerCase().includes(term)
      return matchName || matchEmail
    }
    return true
  })

  const getPerfilBadge = (perfil: UserPerfil) => {
    switch (perfil) {
      case 'admin':
        return (
          <Badge className="bg-[#FFEBEE] text-[#C62828] border-[#C62828]/30 text-[10px] font-bold">
            Administrador Geral
          </Badge>
        )
      case 'admin_rh':
        return (
          <Badge className="bg-[#FFF3E0] text-[#E65100] border-[#E65100]/30 text-[10px] font-bold">
            Administrador de RH
          </Badge>
        )
      case 'rh':
        return (
          <Badge className="bg-[#E0F2F1] text-[#00695C] border-[#00695C]/30 text-[10px] font-bold">
            RH (Operacional)
          </Badge>
        )
      case 'gestor':
        return (
          <Badge className="bg-[#F3E5F5] text-[#6A1B9A] border-[#6A1B9A]/30 text-[10px] font-bold">
            Gestor
          </Badge>
        )
      default:
        return (
          <Badge className="bg-[#E8EEF7] text-[#1565C0] border-[#1565C0]/30 text-[10px] font-bold">
            Colaborador
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
              Usuários e Permissões
            </h1>
            <Badge
              variant="outline"
              className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-xs font-semibold"
            >
              Segurança & Acessos
            </Badge>
          </div>
          <p className="text-sm text-[#757575] mt-1">
            Controle os perfis de acesso (Colaborador, Gestor, RH e Admin), redefina credenciais e
            faça o gerenciamento seguro dos membros da sua organização.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarUsuarios}
            disabled={loading}
            className="border-[#E0E0E0] text-[#212121] text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={() => setModalNovoUsuarioOpen(true)}
            className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-9 gap-1.5 shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* NOVO CARD: Permissões de Acesso (Flags de Liberação)
          Visível APENAS para 'admin_rh' e 'admin' quando um usuário for selecionado */}
      {isPodeGerenciarPermissoes && usuarioSelecionadoPermissoes && currentUser && (
        <CardPermissoesAcesso
          usuario={usuarioSelecionadoPermissoes}
          currentUser={currentUser}
          onFechar={() => setUsuarioSelecionadoPermissoes(null)}
          onPermissoesSalvas={() => {
            // Se o usuário alterado for o próprio usuário logado, atualiza as flags no AuthContext
            if (usuarioSelecionadoPermissoes.id === currentUser.id) {
              refreshUserFlags()
            }
          }}
        />
      )}

      {/* Banner de Instrução para Selecionar Usuário para Permissões */}
      {isPodeGerenciarPermissoes && !usuarioSelecionadoPermissoes && (
        <div className="rounded-xl border border-[#0D47A1]/20 bg-[#E8EEF7]/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#0D47A1]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#0D47A1] text-white flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-[#0D47A1] text-sm">
                Alçadas e Flags de Permissão Individual
              </p>
              <p className="text-[#424242] mt-0.5">
                Clique no botão <strong>"Permissões"</strong> de qualquer usuário na lista abaixo
                para inspecionar ou customizar as flags de liberação do menu lateral e alçadas de
                acesso.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      <Card className="border border-[#E0E0E0] bg-white p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#757575]" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou e-mail corporativo..."
              className="pl-9 h-9 text-xs border-[#E0E0E0]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
              <SelectTrigger className="h-9 w-40 text-xs border-[#E0E0E0] bg-white">
                <SelectValue placeholder="Perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os perfis</SelectItem>
                <SelectItem value="admin">Administrador Geral</SelectItem>
                <SelectItem value="admin_rh">Administrador de RH</SelectItem>
                <SelectItem value="rh">RH (Operacional)</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="colaborador">Colaborador</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 w-36 text-xs border-[#E0E0E0] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Apenas Ativos</SelectItem>
                <SelectItem value="desativado">Desativados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabela de Usuários */}
      <Card className="border border-[#E0E0E0] bg-white shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-[#F0F0F0]">
          <CardTitle className="text-sm font-bold text-[#212121] flex items-center gap-2">
            <Users className="h-4 w-4 text-[#0D47A1]" />
            Membros Cadastrados ({usuariosFiltrados.length})
          </CardTitle>
          <CardDescription className="text-xs text-[#757575]">
            Controle de credenciais, cargos no sistema e desativação sem exclusão física
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-slate-100" />
              ))}
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-10 w-10 text-[#9E9E9E] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-[#212121]">Nenhum usuário encontrado</p>
              <p className="text-xs text-[#757575] mt-1">
                Tente ajustar os filtros ou adicione um novo usuário.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto divide-y divide-[#F0F0F0]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E0E0E0] text-[#757575] uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">E-mail</th>
                    <th className="py-3 px-4">Perfil de Acesso</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5]">
                  {usuariosFiltrados.map((item) => {
                    const isAtivo = item.ativo !== false
                    const isSelf = item.id === currentUser?.id

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-[#F9FAFB] transition-colors ${
                          !isAtivo ? 'opacity-60 bg-[#FAFAFA]' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-[#212121]">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-[#0D47A1] text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {(item.name || item.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">{item.name || 'Sem nome'}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
                                Você
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-[#616161] font-mono text-[11px]">
                          {item.email}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {getPerfilBadge(item.perfil)}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {isAtivo ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-semibold"
                            >
                              ● Ativo
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] font-semibold"
                            >
                              Desativado
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botão de Flags de Permissão: Visível para admin_rh e admin */}
                            {isPodeGerenciarPermissoes && (
                              <Button
                                variant={
                                  usuarioSelecionadoPermissoes?.id === item.id
                                    ? 'default'
                                    : 'outline'
                                }
                                size="sm"
                                onClick={() => {
                                  if (usuarioSelecionadoPermissoes?.id === item.id) {
                                    setUsuarioSelecionadoPermissoes(null)
                                  } else {
                                    setUsuarioSelecionadoPermissoes(item)
                                  }
                                }}
                                className={`h-7 px-2.5 text-[11px] font-semibold transition-all ${
                                  usuarioSelecionadoPermissoes?.id === item.id
                                    ? 'bg-[#0D47A1] text-white hover:bg-[#0A3A82]'
                                    : 'border-[#0D47A1]/40 text-[#0D47A1] hover:bg-[#E8EEF7]'
                                }`}
                                title="Configurar flags de liberação e exceções de acesso para este usuário"
                              >
                                <Shield className="h-3 w-3 mr-1" />
                                {usuarioSelecionadoPermissoes?.id === item.id
                                  ? 'Ocultar Flags'
                                  : 'Permissões'}
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAbrirEditar(item)}
                              className="h-7 px-2 text-[11px] text-[#0D47A1] hover:bg-[#E8EEF7]"
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Editar
                            </Button>

                            {!isSelf && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleAtivo(item)}
                                className={`h-7 px-2 text-[11px] font-semibold border ${
                                  isAtivo
                                    ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                {isAtivo ? (
                                  <>
                                    <UserX className="h-3 w-3 mr-1" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    Reativar
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar Novo Usuário */}
      <Dialog open={modalNovoUsuarioOpen} onOpenChange={setModalNovoUsuarioOpen}>
        <DialogContent className="max-w-md bg-white border border-[#E0E0E0]">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#212121]">
                  Cadastrar Novo Usuário
                </DialogTitle>
                <DialogDescription className="text-xs text-[#757575]">
                  Defina os dados, a senha inicial e o nível de acesso do colaborador.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCriarUsuario} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-xs font-semibold text-[#212121]">
                Nome Completo *
              </Label>
              <Input
                id="nome"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Ana Paula Martins"
                className="text-xs h-9 border-[#E0E0E0]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-[#212121]">
                E-mail Corporativo *
              </Label>
              <Input
                id="email"
                type="email"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                placeholder="ana.martins@empresa.com.br"
                className="text-xs h-9 border-[#E0E0E0]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha" className="text-xs font-semibold text-[#212121]">
                Senha Inicial
              </Label>
              <Input
                id="senha"
                type="text"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Padrão: Skip@Pass (mínimo 8 caracteres)"
                className="text-xs h-9 border-[#E0E0E0]"
              />
              <p className="text-[10px] text-[#757575]">
                Se deixar em branco, a senha padrão será <strong>Skip@Pass</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="perfil" className="text-xs font-semibold text-[#212121]">
                Perfil de Permissão *
              </Label>
              <Select value={novoPerfil} onValueChange={(val) => setNovoPerfil(val as UserPerfil)}>
                <SelectTrigger id="perfil" className="text-xs h-9 border-[#E0E0E0] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="rh">RH (Operacional)</SelectItem>
                  <SelectItem value="admin_rh">Administrador de RH</SelectItem>
                  <SelectItem value="admin">Administrador Geral (Acesso Total)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3 border-t border-[#F0F0F0] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNovoUsuarioOpen(false)}
                className="border-[#E0E0E0] text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingNovo}
                className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-8"
              >
                {savingNovo ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Criando...
                  </>
                ) : (
                  'Salvar Usuário'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Perfil / Redefinir Senha */}
      <Dialog open={modalEditarOpen} onOpenChange={setModalEditarOpen}>
        <DialogContent className="max-w-md bg-white border border-[#E0E0E0]">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center">
                <Edit2 className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#212121]">
                  Editar Usuário
                </DialogTitle>
                <DialogDescription className="text-xs text-[#757575]">
                  {usuarioEditando?.name} ({usuarioEditando?.email})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSalvarEditar} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-perfil" className="text-xs font-semibold text-[#212121]">
                Perfil de Acesso
              </Label>
              <Select value={editPerfil} onValueChange={(val) => setEditPerfil(val as UserPerfil)}>
                <SelectTrigger id="edit-perfil" className="text-xs h-9 border-[#E0E0E0] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="rh">RH (Operacional)</SelectItem>
                  <SelectItem value="admin_rh">Administrador de RH</SelectItem>
                  <SelectItem value="admin">Administrador Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#F0F0F0]">
              <Label
                htmlFor="edit-senha"
                className="text-xs font-semibold text-[#212121] flex items-center gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5 text-[#0D47A1]" />
                Redefinir Senha (opcional)
              </Label>
              <Input
                id="edit-senha"
                type="password"
                value={editSenha}
                onChange={(e) => setEditSenha(e.target.value)}
                placeholder="Digite a nova senha (mínimo 8 caracteres)"
                className="text-xs h-9 border-[#E0E0E0]"
              />
              <p className="text-[10px] text-[#757575]">
                Deixe vazio se não quiser alterar a senha atual do colaborador.
              </p>
            </div>

            <DialogFooter className="pt-3 border-t border-[#F0F0F0] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalEditarOpen(false)}
                className="border-[#E0E0E0] text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEdit}
                className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-8"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
