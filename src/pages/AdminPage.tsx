import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Users,
  UserPlus,
  Check,
  Loader2,
  ShieldAlert,
  Mail,
  Calendar,
  Save,
  Building,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { tenantService, userService } from '@/services/api'
import {
  Tenant,
  AppUser,
  UserPerfil,
  TenantPlano,
  TenantStatus,
  PROFILE_LABELS,
  PROFILE_BADGE_COLORS,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { TESLA_LOGO_URL } from '@/lib/logoAsset'

interface AdminPageProps {
  initialTab?: 'tenant' | 'usuarios'
}

export default function AdminPage({ initialTab = 'tenant' }: AdminPageProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'tenant' | 'usuarios'>(initialTab)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [usersList, setUsersList] = useState<AppUser[]>([])
  const [loadingTenant, setLoadingTenant] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)

  // Tenant edit state
  const [selectedPlano, setSelectedPlano] = useState<TenantPlano>('pro')
  const [selectedStatus, setSelectedStatus] = useState<TenantStatus>('ativo')
  const [savingTenant, setSavingTenant] = useState(false)

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [invitePerfil, setInvitePerfil] = useState<UserPerfil>('colaborador')
  const [inviting, setInviting] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    async function fetchTenantData() {
      if (!user?.tenant_id) return
      try {
        setLoadingTenant(true)
        const t = await tenantService.getTenant(user.tenant_id)
        setTenant(t)
        setSelectedPlano(t.plano)
        setSelectedStatus(t.status)
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingTenant(false)
      }
    }

    async function fetchUsersData() {
      if (!user?.tenant_id) return
      try {
        setLoadingUsers(true)
        const list = await userService.getTenantUsers(user.tenant_id)
        setUsersList(list)
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingUsers(false)
      }
    }

    fetchTenantData()
    fetchUsersData()
  }, [user?.tenant_id])

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant) return
    try {
      setSavingTenant(true)
      const updated = await tenantService.updateTenant(tenant.id, {
        plano: selectedPlano,
        status: selectedStatus,
      })
      setTenant(updated)
      toast({
        title: 'Tenant atualizado',
        description: 'Plano e status da organização foram salvos com sucesso.',
      })
    } catch {
      toast({
        title: 'Erro ao atualizar tenant',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      })
    } finally {
      setSavingTenant(false)
    }
  }

  const handleRoleChange = async (targetUserId: string, newPerfil: UserPerfil) => {
    try {
      await userService.updateUserPerfil(targetUserId, newPerfil)
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, perfil: newPerfil } : u)),
      )
      toast({
        title: 'Perfil atualizado',
        description: `O perfil do usuário foi alterado para ${PROFILE_LABELS[newPerfil]}.`,
      })
    } catch {
      toast({
        title: 'Erro ao alterar perfil',
        description: 'Não foi possível atualizar o perfil deste usuário.',
        variant: 'destructive',
      })
    }
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast({
        title: 'E-mail inválido',
        description: 'Informe um endereço de e-mail corporativo válido.',
        variant: 'destructive',
      })
      return
    }

    try {
      setInviting(true)
      const res = await userService.inviteUser(inviteEmail, invitePerfil, inviteName)
      if (res.success) {
        toast({
          title: 'Convite enviado!',
          description: `Usuário ${inviteEmail} convidado com perfil ${PROFILE_LABELS[invitePerfil]}.`,
        })
        setInviteOpen(false)
        setInviteEmail('')
        setInviteName('')
        setInvitePerfil('colaborador')
        // Refresh users list
        if (user?.tenant_id) {
          const list = await userService.getTenantUsers(user.tenant_id)
          setUsersList(list)
        }
      } else {
        toast({
          title: 'Falha no convite',
          description: res.message || 'Não foi possível convidar o usuário.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      toast({
        title: 'Erro ao convidar',
        description: (err as Error)?.message || 'Ocorreu um erro ao enviar o convite.',
        variant: 'destructive',
      })
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-12 w-12 rounded-full border-2 border-[#0D47A1]/20 shadow-xs p-0.5 bg-white shrink-0 ring-2 ring-[#0D47A1]/10 flex items-center justify-center">
            <img
              src={TESLA_LOGO_URL}
              alt="Logo Tesla Mecatrônica"
              className="h-full w-full rounded-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#212121]">
              Administração do Tenant
            </h2>
            <p className="text-sm text-[#757575]">
              Gerenciamento de dados corporativos, assinatura e controle de permissões de usuários.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="bg-[#FFEBEE] text-[#C62828] border-[#C62828]/30 px-3 py-1 text-xs font-semibold w-fit self-start md:self-auto"
        >
          Painel Administrativo
        </Badge>
      </div>

      {/* Quick Navigation Cards para as Novas Telas do Menu Admin */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => navigate('/admin/configuracoes')}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E0E0E0] bg-white hover:border-[#0D47A1] hover:bg-[#F8F9FA] transition-all text-left shadow-2xs"
        >
          <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center shrink-0">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#212121]">Configurações da Empresa</h4>
            <p className="text-[11px] text-[#757575]">Razão social, CNPJ, regime tributário</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin/usuarios')}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E0E0E0] bg-white hover:border-[#0D47A1] hover:bg-[#F8F9FA] transition-all text-left shadow-2xs"
        >
          <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#212121]">Usuários e Permissões</h4>
            <p className="text-[11px] text-[#757575]">Novo usuário, perfis, senhas e inativação</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin/logs')}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E0E0E0] bg-white hover:border-[#0D47A1] hover:bg-[#F8F9FA] transition-all text-left shadow-2xs"
        >
          <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#212121]">Logs de Auditoria</h4>
            <p className="text-[11px] text-[#757575]">Trilha de segurança e conformidade</p>
          </div>
        </button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'tenant' | 'usuarios')}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-[#E0E0E0]/50 p-1">
          <TabsTrigger
            value="tenant"
            className="data-[state=active]:bg-white data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-sm font-semibold text-xs md:text-sm"
          >
            <Building2 className="mr-2 h-4 w-4" />
            Planos & SaaS
          </TabsTrigger>
          <TabsTrigger
            value="usuarios"
            className="data-[state=active]:bg-white data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-sm font-semibold text-xs md:text-sm"
          >
            <Users className="mr-2 h-4 w-4" />
            Visão Rápida Usuários ({usersList.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tenant Information & Edit */}
        <TabsContent value="tenant" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Read-only Tenant Card */}
            <Card className="border border-[#E0E0E0] bg-white shadow-sm">
              <CardHeader className="border-b border-[#F5F5F5] pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full border border-[#0D47A1]/20 shadow-2xs p-0.5 bg-white shrink-0 ring-1 ring-[#0D47A1]/10 flex items-center justify-center">
                    <img
                      src={TESLA_LOGO_URL}
                      alt="Logo Tesla Mecatrônica"
                      className="h-full w-full rounded-full object-cover"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                      Informações da Organização
                    </CardTitle>
                    <CardDescription className="text-xs text-[#757575]">
                      Identificação fiscal e cadastro do tenant ativo
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 text-sm">
                {loadingTenant ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full bg-slate-100" />
                    <Skeleton className="h-10 w-full bg-slate-100" />
                    <Skeleton className="h-10 w-full bg-slate-100" />
                  </div>
                ) : tenant ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs text-[#757575]">Razão Social</Label>
                      <div className="rounded-md border border-[#E0E0E0] bg-[#FAFAFA] p-2.5 font-semibold text-[#212121]">
                        {tenant.razao_social}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-[#757575]">CNPJ (Identificador Único)</Label>
                      <div className="rounded-md border border-[#E0E0E0] bg-[#FAFAFA] p-2.5 font-mono text-[#212121]">
                        {tenant.cnpj}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-[#757575]">Identificador Tenant (ID)</Label>
                        <div className="rounded-md border border-[#E0E0E0] bg-[#FAFAFA] p-2.5 font-mono text-xs text-[#757575] truncate">
                          {tenant.id}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-[#757575]">Data de Criação</Label>
                        <div className="rounded-md border border-[#E0E0E0] bg-[#FAFAFA] p-2.5 text-xs text-[#212121] flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[#757575]" />
                          {new Date(tenant.created).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[#C62828]">Erro ao carregar dados do tenant.</p>
                )}
              </CardContent>
            </Card>

            {/* Editable Settings Card */}
            <Card className="border border-[#E0E0E0] bg-white shadow-sm">
              <CardHeader className="border-b border-[#F5F5F5] pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full border border-[#0D47A1]/20 shadow-2xs p-0.5 bg-white shrink-0 ring-1 ring-[#0D47A1]/10 flex items-center justify-center">
                    <img
                      src={TESLA_LOGO_URL}
                      alt="Logo Tesla Mecatrônica"
                      className="h-full w-full rounded-full object-cover"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                      Configurar Plano & Status
                    </CardTitle>
                    <CardDescription className="text-xs text-[#757575]">
                      Atualize os parâmetros contratuais da assinatura deste tenant
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSaveTenant} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="plano" className="text-sm font-medium text-[#212121]">
                      Plano de Assinatura
                    </Label>
                    <Select
                      value={selectedPlano}
                      onValueChange={(val) => setSelectedPlano(val as TenantPlano)}
                    >
                      <SelectTrigger id="plano" className="border-[#E0E0E0]">
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basico">Básico (Até 25 colaboradores)</SelectItem>
                        <SelectItem value="pro">Pro (Até 100 colaboradores)</SelectItem>
                        <SelectItem value="enterprise">Enterprise (Ilimitado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium text-[#212121]">
                      Status Operacional
                    </Label>
                    <Select
                      value={selectedStatus}
                      onValueChange={(val) => setSelectedStatus(val as TenantStatus)}
                    >
                      <SelectTrigger id="status" className="border-[#E0E0E0]">
                        <SelectValue placeholder="Selecione um status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo (Acesso liberado)</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="suspenso">Suspenso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg border border-[#E8EEF7] bg-[#E8EEF7]/40 p-3 text-xs text-[#0D47A1] leading-relaxed">
                    Alterações no status ou plano impactam imediatamente todos os usuários
                    vinculados a este tenant.
                  </div>

                  <Button
                    type="submit"
                    disabled={savingTenant}
                    className="w-full bg-[#0D47A1] hover:bg-[#0A3A82] text-white font-medium"
                  >
                    {savingTenant ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Alterações do Tenant'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Users Management */}
        <TabsContent value="usuarios" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#212121]">Usuários do Tenant</h3>
              <p className="text-xs text-[#757575]">
                Gerencie permissões e convide novos membros para o sistema.
              </p>
            </div>

            {/* Invite User Modal */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs md:text-sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Convidar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px]">
                <form onSubmit={handleInviteUser}>
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-[#212121]">
                      Convidar Novo Usuário
                    </DialogTitle>
                    <DialogDescription className="text-xs text-[#757575]">
                      O novo usuário será vinculado imediatamente a este tenant com o perfil
                      escolhido.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-name" className="text-xs font-semibold text-[#212121]">
                        Nome Completo
                      </Label>
                      <Input
                        id="invite-name"
                        placeholder="Ex: Ana Clara Martins"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        className="border-[#E0E0E0]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="invite-email"
                        className="text-xs font-semibold text-[#212121]"
                      >
                        E-mail Corporativo *
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-[#757575]" />
                        <Input
                          id="invite-email"
                          type="email"
                          placeholder="ana.martins@empresa.com.br"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="pl-9 border-[#E0E0E0]"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="invite-perfil"
                        className="text-xs font-semibold text-[#212121]"
                      >
                        Perfil de Acesso *
                      </Label>
                      <Select
                        value={invitePerfil}
                        onValueChange={(val) => setInvitePerfil(val as UserPerfil)}
                      >
                        <SelectTrigger id="invite-perfil" className="border-[#E0E0E0]">
                          <SelectValue placeholder="Selecione o perfil" />
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
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setInviteOpen(false)}
                      className="border-[#E0E0E0]"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={inviting}
                      className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white"
                    >
                      {inviting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar Convite'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Users Table */}
          <Card className="border border-[#E0E0E0] bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#FAFAFA]">
                  <TableRow className="border-b border-[#E0E0E0]">
                    <TableHead className="font-semibold text-xs text-[#212121]">Usuário</TableHead>
                    <TableHead className="font-semibold text-xs text-[#212121]">
                      E-mail Corporativo
                    </TableHead>
                    <TableHead className="font-semibold text-xs text-[#212121]">
                      Perfil Atual
                    </TableHead>
                    <TableHead className="font-semibold text-xs text-[#212121]">
                      Alterar Perfil
                    </TableHead>
                    <TableHead className="font-semibold text-xs text-[#212121] text-right">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingUsers ? (
                    [1, 2, 3, 4].map((i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-32 bg-slate-100" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-44 bg-slate-100" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20 bg-slate-100" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-28 bg-slate-100" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16 bg-slate-100 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : usersList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-sm text-[#757575]">
                        Nenhum usuário cadastrado neste tenant.
                      </TableCell>
                    </TableRow>
                  ) : (
                    usersList.map((u) => {
                      const isCurrentUser = u.id === user?.id
                      const badge =
                        PROFILE_BADGE_COLORS[u.perfil] || PROFILE_BADGE_COLORS.colaborador

                      return (
                        <TableRow
                          key={u.id}
                          className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]"
                        >
                          <TableCell className="font-medium text-xs md:text-sm text-[#212121]">
                            <div className="flex items-center gap-2">
                              <span>{u.name || 'Sem nome'}</span>
                              {isCurrentUser && (
                                <span className="text-[10px] font-semibold bg-[#E8EEF7] text-[#0D47A1] px-1.5 py-0.5 rounded">
                                  Você
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-xs text-[#757575] font-mono">
                            {u.email}
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`${badge.bg} ${badge.text} ${badge.border} text-[11px] capitalize`}
                            >
                              {PROFILE_LABELS[u.perfil]}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Select
                              value={u.perfil}
                              onValueChange={(val) => handleRoleChange(u.id, val as UserPerfil)}
                              disabled={isCurrentUser}
                            >
                              <SelectTrigger className="h-8 w-36 text-xs border-[#E0E0E0] bg-white">
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
                          </TableCell>

                          <TableCell className="text-right">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E7D32]">
                              <Check className="h-3.5 w-3.5" /> Ativo
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
