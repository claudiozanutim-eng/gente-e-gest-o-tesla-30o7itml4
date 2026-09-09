import React, { useEffect, useState } from 'react'
import {
  User,
  Briefcase,
  Building,
  Calendar,
  CheckCircle,
  Shield,
  Mail,
  CreditCard,
  Camera,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { colaboradorService } from '@/services/api'
import { Colaborador, PROFILE_LABELS, PROFILE_BADGE_COLORS } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

export default function PortalColaborador() {
  const { user, colaborador, refreshProfile } = useAuth()
  const [gestor, setGestor] = useState<Colaborador | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    async function loadGestorInfo() {
      if (!user?.tenant_id) return
      try {
        setLoading(true)
        // Find gestor in same tenant and department or marketing
        const dept = colaborador?.departamento || 'Marketing'
        const cols = await colaboradorService.getColaboradoresByDepartment(user.tenant_id, dept)
        // Look for manager/gerente or colleague
        const manager =
          cols.find(
            (c) =>
              c.cargo.toLowerCase().includes('gerente') ||
              c.cargo.toLowerCase().includes('gestor') ||
              c.cargo.toLowerCase().includes('diretor'),
          ) || cols[0]
        setGestor(manager || null)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadGestorInfo()
  }, [user?.tenant_id, colaborador?.departamento])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Não informada'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const handleUpdatePhoto = async () => {
    if (!colaborador) return
    try {
      // Pick next demo avatar
      const newFoto = `https://img.usecurling.com/ppl/medium?gender=male&seed=${Math.floor(Math.random() * 800) + 200}`
      await colaboradorService.updateFotoUrl(colaborador.id, newFoto)
      await refreshProfile()
      toast({
        title: 'Foto atualizada',
        description: 'Sua foto de perfil foi alterada com sucesso.',
      })
    } catch {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível alterar a foto.',
        variant: 'destructive',
      })
    }
  }

  const fullName = colaborador?.nome || user?.name || 'Colaborador'
  const perfil = user?.perfil || 'colaborador'
  const badgeStyle = PROFILE_BADGE_COLORS[perfil]

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl border border-[#0D47A1]/20 bg-gradient-to-r from-[#0D47A1] to-[#1565C0] p-6 md:p-8 text-white shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Shield className="h-3.5 w-3.5" />
              <span>Portal do Colaborador</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Bem-vindo(a), {fullName}!
            </h1>
            <p className="text-sm md:text-base text-white/90 max-w-2xl">
              Aqui você tem acesso rápido às informações do seu contrato, departamento e dados
              profissionais na Tesla RH.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="h-16 w-16 border-2 border-white/40 shadow-md">
              {colaborador?.foto_url && <AvatarImage src={colaborador.foto_url} alt={fullName} />}
              <AvatarFallback className="bg-white text-[#0D47A1] text-lg font-bold">
                {fullName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="md:hidden">
              <p className="font-semibold">{fullName}</p>
              <p className="text-xs text-white/80">{colaborador?.cargo || 'Colaborador'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Meus Dados */}
        <Card className="border border-[#E0E0E0] bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-[#F5F5F5]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                <User className="h-4 w-4 text-[#0D47A1]" />
                Meus Dados
              </CardTitle>
              <Badge variant="outline" className={`${badgeStyle.bg} ${badgeStyle.text} text-xs`}>
                {PROFILE_LABELS[perfil]}
              </Badge>
            </div>
            <CardDescription className="text-xs text-[#757575]">
              Informações do perfil profissional
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 border border-[#E0E0E0]">
                {colaborador?.foto_url && <AvatarImage src={colaborador.foto_url} alt={fullName} />}
                <AvatarFallback className="bg-[#E8EEF7] text-[#0D47A1] font-semibold">
                  {fullName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-[#212121] truncate">{fullName}</p>
                <p className="text-xs text-[#757575] flex items-center gap-1 mt-0.5 truncate">
                  <Mail className="h-3 w-3 text-[#757575]" />
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#F5F5F5] text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-[#757575]">Cargo atual:</span>
                <span className="font-semibold text-[#212121]">
                  {colaborador?.cargo || 'Analista'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[#757575] flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> CPF:
                </span>
                <span className="font-mono text-[#212121]">{colaborador?.cpf || '---'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[#757575] flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Admissão:
                </span>
                <span className="font-medium text-[#212121]">
                  {formatDate(colaborador?.data_admissao)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[#757575]">Status no RH:</span>
                <span className="inline-flex items-center gap-1 text-[#2E7D32] font-semibold">
                  <CheckCircle className="h-3 w-3" />{' '}
                  {colaborador?.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdatePhoto}
              className="w-full text-xs font-medium border-[#E0E0E0] text-[#0D47A1] hover:bg-[#E8EEF7]"
            >
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              Trocar Foto de Perfil
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Meu Departamento */}
        <Card className="border border-[#E0E0E0] bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-[#F5F5F5]">
            <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
              <Building className="h-4 w-4 text-[#0D47A1]" />
              Meu Departamento
            </CardTitle>
            <CardDescription className="text-xs text-[#757575]">
              Lotação e estrutura na empresa
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="rounded-lg bg-[#F5F5F5] p-3 text-center">
              <span className="text-xs uppercase tracking-wider text-[#757575] font-semibold">
                Setor alocado
              </span>
              <p className="text-lg font-bold text-[#0D47A1] mt-0.5">
                {colaborador?.departamento || 'Marketing'}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
                <span className="text-[#757575]">Unidade:</span>
                <span className="font-medium text-[#212121]">Sede Principal (SP)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
                <span className="text-[#757575]">Modelo de Trabalho:</span>
                <span className="font-medium text-[#212121]">Híbrido (3x2)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
                <span className="text-[#757575]">Jornada Semanal:</span>
                <span className="font-medium text-[#212121]">44 horas</span>
              </div>
            </div>

            <div className="rounded-lg border border-[#E8EEF7] bg-[#E8EEF7]/40 p-3">
              <p className="text-xs text-[#0D47A1] leading-relaxed">
                Para solicitar mudanças cadastrais ou de departamento, entre em contato direto com a
                equipe de Recursos Humanos.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Meu Gestor */}
        <Card className="border border-[#E0E0E0] bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-[#F5F5F5]">
            <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#0D47A1]" />
              Meu Gestor
            </CardTitle>
            <CardDescription className="text-xs text-[#757575]">
              Liderança direta e aprovações
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full bg-slate-100" />
                <Skeleton className="h-4 w-3/4 bg-slate-100" />
                <Skeleton className="h-4 w-1/2 bg-slate-100" />
              </div>
            ) : gestor ? (
              <>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border border-[#E0E0E0]">
                    {gestor.foto_url && <AvatarImage src={gestor.foto_url} alt={gestor.nome} />}
                    <AvatarFallback className="bg-[#F3E5F5] text-[#6A1B9A] font-semibold">
                      {gestor.nome.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-[#212121] truncate">{gestor.nome}</p>
                    <p className="text-xs text-[#6A1B9A] font-medium truncate">{gestor.cargo}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#F5F5F5] text-xs">
                  <div className="flex justify-between py-1">
                    <span className="text-[#757575]">Departamento:</span>
                    <span className="font-medium text-[#212121]">{gestor.departamento}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#757575]">Status:</span>
                    <Badge
                      variant="outline"
                      className="bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/20 text-[11px]"
                    >
                      Ativo
                    </Badge>
                  </div>
                </div>

                <div className="rounded-lg bg-[#FAFAFA] p-3 border border-[#E0E0E0] text-xs text-[#757575]">
                  Solicitações de abono e ajustes de ponto devem ser alinhadas com sua liderança
                  direta.
                </div>
              </>
            ) : (
              <p className="text-xs text-[#757575]">Gestor direto em definição pelo RH.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
