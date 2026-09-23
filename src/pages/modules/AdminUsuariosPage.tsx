import React, { useState, useEffect, useRef } from 'react'
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
  Trash2,
  AlertTriangle,
  Upload,
  Pencil,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import { userService, colaboradorService, logAuditoriaService } from '@/services/api'
import { AppUser, UserPerfil, Colaborador, DEPARTAMENTOS_PADRAO } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
import { TESLA_LOGO_URL } from '@/lib/logoAsset'
import { validarEmail } from '@/lib/validationColaborador'

export default function AdminUsuariosPage() {
  const { user: currentUser, refreshUserFlags } = useAuth()
  const tenantId = currentUser?.tenant_id
  const { toast } = useToast()

  // Permissão do usuário logado: apenas 'admin_rh' e 'admin' enxergam/editam o card de permissões e editam e-mail
  const isPodeGerenciarPermissoes =
    currentUser?.perfil === 'admin' || currentUser?.perfil === 'admin_rh'
  const isPodeEditarEmail = currentUser?.perfil === 'admin' || currentUser?.perfil === 'admin_rh'
  const isAdminGeral = currentUser?.perfil === 'admin'
  const isAdminRH = currentUser?.perfil === 'admin_rh'

  const [usuarios, setUsuarios] = useState<AppUser[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
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

  // Modal Editar E-mail (acessível apenas para admin e admin_rh)
  const [modalEditarEmailOpen, setModalEditarEmailOpen] = useState(false)
  const [usuarioEditandoEmail, setUsuarioEditandoEmail] = useState<AppUser | null>(null)
  const [novoEmailEdit, setNovoEmailEdit] = useState('')
  const [erroEmailEdit, setErroEmailEdit] = useState('')
  const [salvandoEmail, setSalvandoEmail] = useState(false)

  // Modal de Confirmação de Ação (Desativar / Reativar / Excluir definitivamente)
  const [modalConfirmAcaoOpen, setModalConfirmAcaoOpen] = useState(false)
  const [tipoAcaoConfirmar, setTipoAcaoConfirmar] = useState<'desativar' | 'reativar' | 'excluir'>(
    'desativar',
  )
  const [usuarioAlvoAcao, setUsuarioAlvoAcao] = useState<AppUser | null>(null)
  const [executandoAcao, setExecutandoAcao] = useState(false)

  // Form Novo Usuário
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novoCargo, setNovoCargo] = useState('')
  const [novoDepartamento, setNovoDepartamento] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoPerfil, setNovoPerfil] = useState<UserPerfil>('colaborador')
  const [novoFotoFile, setNovoFotoFile] = useState<File | null>(null)
  const [novoFotoPreview, setNovoFotoPreview] = useState<string>('')
  const [novoFotoErro, setNovoFotoErro] = useState<string>('')
  const fileInputNovoUserRef = useRef<HTMLInputElement | null>(null)
  const [savingNovo, setSavingNovo] = useState(false)

  // Form Editar Usuário
  const [editPerfil, setEditPerfil] = useState<UserPerfil>('colaborador')
  const [editSenha, setEditSenha] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const carregarUsuarios = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const [listUsers, listColabs] = await Promise.all([
        userService.getUsersByTenant(tenantId),
        colaboradorService.getColaboradores(tenantId),
      ])
      setUsuarios(listUsers)
      setColaboradores(listColabs)

      // Se havia um usuário selecionado para permissões, atualiza a referência dele
      if (usuarioSelecionadoPermissoes) {
        const updatedTarget = listUsers.find((u) => u.id === usuarioSelecionadoPermissoes.id)
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

  // Resolução da ficha vinculada para um usuário
  const getFichaVinculada = (user: AppUser): Colaborador | null => {
    // 1. Vinculação direta por user_id
    const colabPorId = colaboradores.find((c) => c.user_id === user.id)
    if (colabPorId) return colabPorId

    // 2. Vinculação por e-mail (se o user possuir e-mail não vazio)
    const userEmail = (user.email || '').trim().toLowerCase()
    if (userEmail) {
      const colabPorEmail = colaboradores.find(
        (c) => (c.email || '').trim().toLowerCase() === userEmail,
      )
      if (colabPorEmail) return colabPorEmail
    }

    // 3. Vinculação por nome normalizado
    const userNameNorm = (user.name || '').trim().toLowerCase()
    if (userNameNorm) {
      const colabPorNome = colaboradores.find(
        (c) =>
          (c.nome || '').trim().toLowerCase() === userNameNorm ||
          (c.nome_completo || '').trim().toLowerCase() === userNameNorm,
      )
      if (colabPorNome) return colabPorNome
    }

    return null
  }

  // E-mail efetivo exibido na tabela: prioriza user.email; se vazio/nulo, busca na ficha do colaborador
  const getEmailEfetivo = (user: AppUser): string => {
    const emailUser = (user.email || '').trim()
    if (emailUser) return emailUser

    const ficha = getFichaVinculada(user)
    if (ficha?.email) {
      return ficha.email.trim()
    }

    return ''
  }

  // Abrir modal de edição de e-mail (apenas admin e admin_rh)
  const handleAbrirEditarEmail = (user: AppUser) => {
    if (!isPodeEditarEmail) {
      toast({
        title: 'Permissão insuficiente',
        description: 'Apenas Administradores (Geral ou RH) podem editar o e-mail de usuários.',
        variant: 'destructive',
      })
      return
    }

    const emailAtual = getEmailEfetivo(user)
    setUsuarioEditandoEmail(user)
    setNovoEmailEdit(emailAtual)
    setErroEmailEdit('')
    setModalEditarEmailOpen(true)
  }

  // Salvar atualização de e-mail com sincronização e auditoria
  const handleSalvarEditarEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuarioEditandoEmail || !tenantId || !currentUser?.id) return

    // Validação de segurança: isolamento por tenant
    if (usuarioEditandoEmail.tenant_id !== tenantId) {
      toast({
        title: 'Ação não permitida',
        description: 'Não é possível alterar dados de usuário pertencente a outra organização.',
        variant: 'destructive',
      })
      return
    }

    // Validação de alçada
    if (!isPodeEditarEmail) {
      toast({
        title: 'Permissão insuficiente',
        description: 'Seu perfil de acesso não possui alçada para editar e-mails.',
        variant: 'destructive',
      })
      return
    }

    const emailLimpo = novoEmailEdit.trim().toLowerCase()
    if (!emailLimpo) {
      setErroEmailEdit('Informe o endereço de e-mail.')
      return
    }

    if (!validarEmail(emailLimpo)) {
      setErroEmailEdit('Formato de e-mail inválido. Ex: nome@empresa.com.br')
      return
    }

    setErroEmailEdit('')
    setSalvandoEmail(true)

    const emailAnterior = getEmailEfetivo(usuarioEditandoEmail)
    const fichaVinculada = getFichaVinculada(usuarioEditandoEmail)

    let atualizouUser = false
    let atualizouColaborador = false
    let avisoFallback = ''

    try {
      // 1. Tentar atualizar no registro de autenticação (`users`)
      try {
        await userService.updateUserEmail(usuarioEditandoEmail.id, emailLimpo)
        atualizouUser = true
      } catch (userErr: any) {
        console.warn('Não foi possível atualizar e-mail em users (auth):', userErr)
        const errMsg = userErr?.data?.data?.email?.message || userErr?.message || ''
        if (errMsg.includes('already') || errMsg.includes('unique') || errMsg.includes('exists')) {
          throw new Error('Este endereço de e-mail já está sendo utilizado por outro usuário.')
        }
        avisoFallback =
          'O e-mail foi atualizado na ficha funcional do colaborador, mas não pôde ser alterado nas credenciais de autenticação por restrição do servidor.'
      }

      // 2. Se houver ficha vinculada, manter consistência atualizando a ficha também
      if (fichaVinculada?.id) {
        try {
          await colaboradorService.updateColaborador(fichaVinculada.id, {
            email: emailLimpo,
            // Garante vínculo se ainda não estava gravado
            user_id: usuarioEditandoEmail.id,
          })
          atualizouColaborador = true
        } catch (colabErr) {
          console.warn('Erro ao atualizar e-mail na ficha do colaborador:', colabErr)
        }
      }

      // Se não conseguiu atualizar em nenhum dos dois, dispara erro
      if (!atualizouUser && !atualizouColaborador) {
        throw new Error(
          'Não foi possível atualizar o e-mail nem no usuário nem na ficha vinculada.',
        )
      }

      // 3. Registrar Log de Auditoria detalhado
      try {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: currentUser.id,
          acao: 'edicao_email_usuario',
          entidade: 'users',
          entidade_id: usuarioEditandoEmail.id,
          dados_json: {
            descricao: `E-mail de ${usuarioEditandoEmail.name} alterado de "${emailAnterior || '(vazio)'}" para "${emailLimpo}" por ${currentUser.name || currentUser.email}`,
            usuario_afetado_id: usuarioEditandoEmail.id,
            usuario_afetado_nome: usuarioEditandoEmail.name,
            email_anterior: emailAnterior,
            email_novo: emailLimpo,
            atualizado_em_users: atualizouUser,
            atualizado_em_colaborador: atualizouColaborador,
            colaborador_id: fichaVinculada?.id || null,
            responsavel_id: currentUser.id,
            responsavel_nome: currentUser.name || currentUser.email,
            responsavel_perfil: currentUser.perfil,
            data_hora: new Date().toISOString(),
          },
        })
      } catch (logErr) {
        console.warn('Erro ao registrar log de auditoria da troca de e-mail:', logErr)
      }

      // 4. Atualizar estados locais imediatamente para refletir na UI sem recarregar tudo
      if (atualizouUser) {
        setUsuarios((prev) =>
          prev.map((u) => (u.id === usuarioEditandoEmail.id ? { ...u, email: emailLimpo } : u)),
        )
      }

      if (fichaVinculada?.id) {
        setColaboradores((prev) =>
          prev.map((c) =>
            c.id === fichaVinculada.id
              ? { ...c, email: emailLimpo, user_id: usuarioEditandoEmail.id }
              : c,
          ),
        )
      }

      setModalEditarEmailOpen(false)
      setUsuarioEditandoEmail(null)

      if (avisoFallback) {
        toast({
          title: 'E-mail atualizado na ficha',
          description: avisoFallback,
        })
      } else {
        toast({
          title: 'E-mail atualizado com sucesso!',
          description: `O e-mail de ${usuarioEditandoEmail.name || 'usuário'} foi alterado para ${emailLimpo}.`,
        })
      }
    } catch (err: any) {
      console.error('Erro ao atualizar e-mail:', err)
      toast({
        title: 'Erro ao atualizar e-mail',
        description:
          err?.message ||
          'Não foi possível salvar o novo e-mail. Verifique se o formato é válido e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoEmail(false)
    }
  }

  useEffect(() => {
    carregarUsuarios()
  }, [tenantId])

  const handleFotoNovoUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setNovoFotoErro('')
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setNovoFotoErro('A imagem deve ter no máximo 5 MB.')
      toast({
        title: 'Arquivo muito grande',
        description: 'Selecione uma imagem PNG ou JPEG com menos de 5 MB.',
        variant: 'destructive',
      })
      return
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      setNovoFotoErro('Formato inválido. Apenas PNG ou JPEG.')
      toast({
        title: 'Formato inválido',
        description: 'Envie um arquivo PNG ou JPEG.',
        variant: 'destructive',
      })
      return
    }

    if (novoFotoPreview && novoFotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(novoFotoPreview)
    }

    setNovoFotoFile(file)
    setNovoFotoPreview(URL.createObjectURL(file))
  }

  // Criar Usuário com criação automática de ficha de colaborador e upload de foto nativo
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

      // 1. Criar usuário em `users`
      const created = await userService.createUser(
        {
          tenant_id: tenantId,
          name: novoNome.trim(),
          email: novoEmail.trim().toLowerCase(),
          password: novaSenha.trim() || 'Skip@Pass',
          perfil: novoPerfil,
        },
        novoFotoFile,
      )

      // 2. Mapeamento de cargo fallback pelo perfil
      const perfilCargoMap: Record<UserPerfil, string> = {
        admin: 'Administrador Geral',
        admin_rh: 'Administrador de RH',
        rh: 'Analista de RH',
        gestor: 'Gestor',
        colaborador: 'Colaborador',
      }
      const cargoFinal = novoCargo.trim() || perfilCargoMap[novoPerfil] || 'Colaborador'
      const deptoFinal =
        novoDepartamento.trim() ||
        (novoPerfil === 'admin'
          ? 'Diretoria'
          : novoPerfil === 'admin_rh' || novoPerfil === 'rh'
            ? 'Recursos Humanos'
            : 'Geral')

      // 3. Criar automaticamente a ficha em `colaborador`
      let novoColabFicha: Colaborador | null = null
      try {
        novoColabFicha = await colaboradorService.createColaborador({
          tenant_id: tenantId,
          user_id: created.id,
          nome: created.name,
          nome_completo: created.name,
          email: created.email,
          cargo: cargoFinal,
          departamento: deptoFinal,
          status: 'ativo',
          data_admissao: new Date().toISOString(),
        })

        // 3.1 Se houve upload de foto, anexar à ficha do colaborador via uploadFotoArquivo
        if (novoFotoFile && novoColabFicha?.id) {
          try {
            await colaboradorService.uploadFotoArquivo(novoColabFicha.id, novoFotoFile)
          } catch (fotoErr) {
            console.warn('Erro ao salvar foto na ficha do colaborador:', fotoErr)
          }
        }
      } catch (colabErr) {
        console.warn('Erro ao criar ficha de colaborador automática:', colabErr)
      }

      // 4. Auditoria
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: currentUser.id,
        acao: `Criação do usuário e ficha de colaborador: ${created.name} (${created.email})`,
        entidade: 'users',
        entidade_id: created.id,
        dados_json: {
          nome: created.name,
          email: created.email,
          perfil: created.perfil,
          cargo: cargoFinal,
          departamento: deptoFinal,
          colaborador_ficha_id: novoColabFicha?.id || null,
          possui_foto: Boolean(novoFotoFile),
          admin_responsavel: currentUser.name,
          criado_em: new Date().toISOString(),
        },
      })

      setUsuarios((prev) => [created, ...prev])
      setModalNovoUsuarioOpen(false)

      // Limpar formulário
      setNovoNome('')
      setNovoEmail('')
      setNovoCargo('')
      setNovoDepartamento('')
      setNovaSenha('')
      setNovoPerfil('colaborador')
      if (novoFotoPreview && novoFotoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(novoFotoPreview)
      }
      setNovoFotoFile(null)
      setNovoFotoPreview('')
      setNovoFotoErro('')
      if (fileInputNovoUserRef.current) fileInputNovoUserRef.current.value = ''

      toast({
        title: 'Usuário e ficha criados com sucesso!',
        description: `O acesso e a ficha funcional de ${created.name} (${cargoFinal}) foram configurados no sistema.`,
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

  // Abrir modal para confirmar ação (Desativar, Reativar ou Excluir Definitivamente)
  const handleSolicitarAcao = (user: AppUser, acao: 'desativar' | 'reativar' | 'excluir') => {
    if (user.id === currentUser?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode desativar ou excluir seu próprio usuário.',
        variant: 'destructive',
      })
      return
    }

    if (user.tenant_id !== tenantId) {
      toast({
        title: 'Ação não permitida',
        description: 'Não é permitido modificar usuários de outra organização/tenant.',
        variant: 'destructive',
      })
      return
    }

    if (acao === 'excluir' && !isAdminGeral) {
      toast({
        title: 'Permissão insuficiente',
        description:
          'Apenas o Administrador Geral pode excluir usuários em definitivo. O Administrador de RH pode desativar o acesso.',
        variant: 'destructive',
      })
      return
    }

    setUsuarioAlvoAcao(user)
    setTipoAcaoConfirmar(acao)
    setModalConfirmAcaoOpen(true)
  }

  // Executar a ação confirmada no modal
  const handleExecutarAcaoConfirmada = async () => {
    if (!usuarioAlvoAcao || !tenantId || !currentUser?.id) return

    try {
      setExecutandoAcao(true)

      if (tipoAcaoConfirmar === 'excluir') {
        // Exclusão definitiva (apenas admin geral)
        await userService.deleteUser(usuarioAlvoAcao.id)

        // Registrar auditoria
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: currentUser.id,
          acao: 'exclusao_definitiva_usuario',
          entidade: 'users',
          entidade_id: usuarioAlvoAcao.id,
          dados_json: {
            descricao: `Usuário ${usuarioAlvoAcao.name || usuarioAlvoAcao.email} excluído definitivamente por ${currentUser.name || currentUser.email}`,
            usuario_excluido_id: usuarioAlvoAcao.id,
            usuario_excluido_nome: usuarioAlvoAcao.name,
            usuario_excluido_email: usuarioAlvoAcao.email,
            usuario_excluido_perfil: usuarioAlvoAcao.perfil,
            responsavel_id: currentUser.id,
            responsavel_nome: currentUser.name || currentUser.email,
          },
        })

        // Se era o usuário selecionado no card de permissões, fecha o card
        if (usuarioSelecionadoPermissoes?.id === usuarioAlvoAcao.id) {
          setUsuarioSelecionadoPermissoes(null)
        }

        setUsuarios((prev) => prev.filter((u) => u.id !== usuarioAlvoAcao.id))

        toast({
          title: 'Usuário excluído definitivamente',
          description: `O registro de ${usuarioAlvoAcao.name || usuarioAlvoAcao.email} foi removido com sucesso.`,
        })
      } else {
        // Soft delete (desativar / reativar)
        const novoAtivo = tipoAcaoConfirmar === 'reativar'
        await userService.toggleUserAtivo(usuarioAlvoAcao.id, novoAtivo)

        // Registrar auditoria com antes/depois
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: currentUser.id,
          acao: novoAtivo ? 'reativacao_usuario' : 'desativacao_usuario',
          entidade: 'users',
          entidade_id: usuarioAlvoAcao.id,
          dados_json: {
            descricao: `Usuário ${usuarioAlvoAcao.name || usuarioAlvoAcao.email} ${novoAtivo ? 'reativado' : 'desativado'} por ${currentUser.name || currentUser.email}`,
            usuario_id: usuarioAlvoAcao.id,
            nome: usuarioAlvoAcao.name,
            email: usuarioAlvoAcao.email,
            perfil: usuarioAlvoAcao.perfil,
            status_anterior: usuarioAlvoAcao.ativo !== false ? 'ativo' : 'inativo',
            status_novo: novoAtivo ? 'ativo' : 'inativo',
            responsavel_id: currentUser.id,
            responsavel_nome: currentUser.name || currentUser.email,
          },
        })

        setUsuarios((prev) =>
          prev.map((u) => (u.id === usuarioAlvoAcao.id ? { ...u, ativo: novoAtivo } : u)),
        )

        // Atualiza referência no card de permissões se estiver aberto
        if (usuarioSelecionadoPermissoes?.id === usuarioAlvoAcao.id) {
          setUsuarioSelecionadoPermissoes((prev) => (prev ? { ...prev, ativo: novoAtivo } : null))
        }

        toast({
          title: novoAtivo ? 'Usuário reativado!' : 'Usuário desativado com sucesso!',
          description: novoAtivo
            ? `O acesso de ${usuarioAlvoAcao.name || usuarioAlvoAcao.email} foi restabelecido.`
            : `O login de ${usuarioAlvoAcao.name || usuarioAlvoAcao.email} foi desativado (soft delete). O histórico cadastral permanece preservado.`,
        })
      }

      setModalConfirmAcaoOpen(false)
      setUsuarioAlvoAcao(null)
    } catch (err: any) {
      console.error('Erro ao processar ação no usuário:', err)
      const errDetail = err?.data?.message || err?.message || ''
      let userFriendlyMsg = 'Não foi possível concluir a operação no banco de dados.'
      if (
        errDetail.includes('required relation reference') ||
        errDetail.includes('part of a required relation')
      ) {
        userFriendlyMsg =
          'O usuário ainda possui vínculos obrigatórios pendentes de desassociação no sistema.'
      } else if (errDetail) {
        userFriendlyMsg = errDetail
      }

      toast({
        title: 'Erro ao processar ação',
        description: userFriendlyMsg,
        variant: 'destructive',
      })
    } finally {
      setExecutandoAcao(false)
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
      const emailEfetivo = getEmailEfetivo(u).toLowerCase()
      const matchEmail = (u.email || '').toLowerCase().includes(term) || emailEfetivo.includes(term)
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
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 rounded-full border border-[#0D47A1]/20">
                              {item.avatar && (
                                <AvatarImage
                                  src={pb.files.getURL(item, item.avatar)}
                                  className="object-cover"
                                />
                              )}
                              <AvatarFallback className="bg-[#0D47A1] text-white text-[11px] font-bold">
                                {(item.name || item.email || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-bold text-[#212121]">
                                  {item.name || 'Sem nome'}
                                </span>
                                {isSelf && (
                                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
                                    Você
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-[#616161] font-mono text-[11px]">
                          {(() => {
                            const emailExibido = getEmailEfetivo(item)
                            const isEmailDaFicha = !item.email && !!emailExibido

                            if (!emailExibido) {
                              return (
                                <div className="flex items-center gap-1.5 text-[#9E9E9E] italic font-sans text-xs">
                                  <span>Não informado</span>
                                  {isPodeEditarEmail && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleAbrirEditarEmail(item)}
                                      className="h-6 w-6 p-0 text-[#0D47A1] hover:bg-blue-50 hover:text-[#0A3A82] transition-colors"
                                      title="Cadastrar e-mail"
                                    >
                                      <Pencil className="h-3 w-3" />
                                      <span className="sr-only">Cadastrar e-mail</span>
                                    </Button>
                                  )}
                                </div>
                              )
                            }

                            return (
                              <div className="flex items-center gap-1.5 max-w-[260px] group/email">
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="truncate inline-block max-w-[200px] cursor-default font-mono text-[11px] text-[#424242]">
                                        {emailExibido}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      className="bg-[#212121] text-white text-xs px-2.5 py-1.5 max-w-xs break-all shadow-md"
                                    >
                                      <p className="font-mono text-xs">{emailExibido}</p>
                                      {isEmailDaFicha && (
                                        <p className="text-[10px] text-amber-300 mt-0.5">
                                          Vinculado via ficha funcional de colaborador
                                        </p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                {isPodeEditarEmail && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAbrirEditarEmail(item)}
                                    className="h-6 w-6 p-0 text-[#757575] hover:text-[#0D47A1] hover:bg-blue-50 transition-colors shrink-0"
                                    title="Editar e-mail"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    <span className="sr-only">Editar e-mail</span>
                                  </Button>
                                )}
                              </div>
                            )
                          })()}
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
                              <>
                                {/* Botão Desativar / Reativar (Soft-delete) - Acessível para Admin RH e Admin Geral */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleSolicitarAcao(item, isAtivo ? 'desativar' : 'reativar')
                                  }
                                  className={`h-7 px-2 text-[11px] font-semibold border ${
                                    isAtivo
                                      ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                  title={
                                    isAtivo
                                      ? 'Desativar usuário (soft delete): bloqueia o acesso sem apagar dados'
                                      : 'Reativar usuário: libera o acesso ao login novamente'
                                  }
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

                                {/* Botão Excluir Definitivamente - APENAS Admin Geral */}
                                {isAdminGeral && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSolicitarAcao(item, 'excluir')}
                                    className="h-7 px-2 text-[11px] font-semibold border border-rose-300 text-rose-700 hover:bg-rose-50"
                                    title="Excluir usuário permanentemente da base"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Excluir
                                  </Button>
                                )}
                              </>
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
            {/* Foto com preview circular */}
            <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E0E0E0] flex items-center gap-4">
              <Avatar className="h-16 w-16 rounded-full border-2 border-[#0D47A1]/20 shadow-xs ring-2 ring-blue-50">
                {novoFotoPreview && <AvatarImage src={novoFotoPreview} className="object-cover" />}
                <AvatarFallback className="bg-[#0D47A1] text-white text-base font-bold">
                  {(novoNome || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1 flex-1">
                <Label className="text-xs font-bold text-[#212121]">Foto de Perfil</Label>
                <p className="text-[10px] text-[#757575]">PNG ou JPEG até 5 MB (opcional)</p>
                {novoFotoErro && <p className="text-[10px] text-red-600">{novoFotoErro}</p>}
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    ref={fileInputNovoUserRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handleFotoNovoUserChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputNovoUserRef.current?.click()}
                    className="h-7 text-xs border-[#E0E0E0] text-[#0D47A1] hover:bg-blue-50 gap-1 px-2.5"
                  >
                    <Upload className="h-3 w-3" />
                    Escolher Imagem
                  </Button>
                  {novoFotoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (novoFotoPreview.startsWith('blob:')) {
                          URL.revokeObjectURL(novoFotoPreview)
                        }
                        setNovoFotoPreview('')
                        setNovoFotoFile(null)
                        setNovoFotoErro('')
                        if (fileInputNovoUserRef.current) fileInputNovoUserRef.current.value = ''
                      }}
                      className="h-7 text-xs text-rose-600 hover:bg-rose-50 px-2"
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cargo" className="text-xs font-semibold text-[#212121]">
                  Cargo (Ficha)
                </Label>
                <Input
                  id="cargo"
                  value={novoCargo}
                  onChange={(e) => setNovoCargo(e.target.value)}
                  placeholder="Ex: Contador Sênior"
                  className="text-xs h-9 border-[#E0E0E0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="departamento" className="text-xs font-semibold text-[#212121]">
                  Departamento
                </Label>
                <Select value={novoDepartamento} onValueChange={(val) => setNovoDepartamento(val)}>
                  <SelectTrigger
                    id="departamento"
                    className="text-xs h-9 border-[#E0E0E0] bg-white"
                  >
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E0E0E0]">
                    {DEPARTAMENTOS_PADRAO.map((dep) => (
                      <SelectItem key={dep} value={dep}>
                        {dep}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

      {/* Modal de Confirmação de Ação (Desativar / Reativar / Excluir) */}
      <Dialog open={modalConfirmAcaoOpen} onOpenChange={setModalConfirmAcaoOpen}>
        <DialogContent className="max-w-md bg-white border border-[#E0E0E0]">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                  tipoAcaoConfirmar === 'excluir'
                    ? 'bg-rose-100 text-rose-700'
                    : tipoAcaoConfirmar === 'desativar'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {tipoAcaoConfirmar === 'excluir' ? (
                  <Trash2 className="h-5 w-5" />
                ) : tipoAcaoConfirmar === 'desativar' ? (
                  <UserX className="h-5 w-5" />
                ) : (
                  <UserCheck className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#212121]">
                  {tipoAcaoConfirmar === 'excluir'
                    ? 'Excluir Usuário Definitivamente?'
                    : tipoAcaoConfirmar === 'desativar'
                      ? 'Desativar Acesso do Usuário?'
                      : 'Reativar Acesso do Usuário?'}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#757575]">
                  Confirme a operação para o usuário selecionado.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-3 text-xs text-[#424242] space-y-2">
            <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E0E0E0] space-y-1">
              <p>
                <strong>Nome:</strong> {usuarioAlvoAcao?.name || 'Sem nome'}
              </p>
              <p>
                <strong>E-mail:</strong> {usuarioAlvoAcao?.email}
              </p>
              <p>
                <strong>Perfil atual:</strong> {usuarioAlvoAcao?.perfil}
              </p>
            </div>

            {tipoAcaoConfirmar === 'excluir' ? (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  Atenção: Ação irreversível!
                </p>
                <p className="text-[11px] leading-relaxed">
                  Esta ação excluirá permanentemente o registro de acesso do usuário. As permissões
                  individuais serão removidas e qualquer ficha de colaborador vinculada terá seu
                  vínculo de usuário liberado para preservar os dados cadastrais da empresa.
                </p>
              </div>
            ) : tipoAcaoConfirmar === 'desativar' ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  Desativação com preservação de histórico (Soft Delete)
                </p>
                <p className="text-[11px] leading-relaxed">
                  O colaborador não conseguirá mais efetuar login no sistema. O cadastro permanece
                  salvo e poderá ser reativado a qualquer momento por um Administrador de RH ou
                  Admin Geral.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  Restabelecimento de Acesso
                </p>
                <p className="text-[11px] leading-relaxed">
                  O usuário voltará ao estado <strong>Ativo</strong> e poderá efetuar login
                  normalmente com as credenciais já cadastradas.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-[#F0F0F0] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalConfirmAcaoOpen(false)
                setUsuarioAlvoAcao(null)
              }}
              disabled={executandoAcao}
              className="border-[#E0E0E0] text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleExecutarAcaoConfirmada}
              disabled={executandoAcao}
              className={`text-white text-xs font-semibold h-8 gap-1.5 ${
                tipoAcaoConfirmar === 'excluir'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : tipoAcaoConfirmar === 'desativar'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {executandoAcao ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  Processando...
                </>
              ) : tipoAcaoConfirmar === 'excluir' ? (
                'Sim, Excluir Definitivamente'
              ) : tipoAcaoConfirmar === 'desativar' ? (
                'Sim, Desativar Usuário'
              ) : (
                'Sim, Reativar Usuário'
              )}
            </Button>
          </DialogFooter>
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

      {/* Modal Editar E-mail (Admin e Admin RH) */}
      <Dialog
        open={modalEditarEmailOpen}
        onOpenChange={(open) => {
          if (!salvandoEmail) {
            setModalEditarEmailOpen(open)
            if (!open) {
              setUsuarioEditandoEmail(null)
              setErroEmailEdit('')
            }
          }
        }}
      >
        <DialogContent className="max-w-sm bg-white border border-[#E0E0E0]">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#212121]">
                  Editar E-mail
                </DialogTitle>
                <DialogDescription className="text-xs text-[#757575]">
                  {usuarioEditandoEmail?.name || 'Colaborador'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSalvarEditarEmail} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="input-novo-email" className="text-xs font-semibold text-[#212121]">
                Endereço de E-mail *
              </Label>
              <Input
                id="input-novo-email"
                type="email"
                value={novoEmailEdit}
                onChange={(e) => {
                  setNovoEmailEdit(e.target.value)
                  if (erroEmailEdit) setErroEmailEdit('')
                }}
                placeholder="colaborador@tesla.com.br"
                className={`text-xs h-9 ${erroEmailEdit ? 'border-red-500 focus-visible:ring-red-400' : 'border-[#E0E0E0]'}`}
                autoFocus
                disabled={salvandoEmail}
                required
              />
              {erroEmailEdit && (
                <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {erroEmailEdit}
                </p>
              )}
              <p className="text-[10px] text-[#757575]">
                O e-mail será sincronizado com as credenciais de login e a ficha funcional vinculada
                neste tenant.
              </p>
            </div>

            <DialogFooter className="pt-3 border-t border-[#F0F0F0] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvandoEmail}
                onClick={() => {
                  setModalEditarEmailOpen(false)
                  setUsuarioEditandoEmail(null)
                  setErroEmailEdit('')
                }}
                className="border-[#E0E0E0] text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoEmail}
                className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-8 gap-1.5"
              >
                {salvandoEmail ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
