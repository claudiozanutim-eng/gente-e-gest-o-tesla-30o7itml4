import React, { useEffect, useState } from 'react'
import {
  Users,
  Building,
  ShieldCheck,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { colaboradorService } from '@/services/api'
import { Colaborador } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardEquipe() {
  const { user, colaborador } = useAuth()
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)

  // Department of the gestor or fallback to Marketing
  const gestorDept = colaborador?.departamento || 'Marketing'

  useEffect(() => {
    async function loadTeam() {
      if (!user?.tenant_id) return
      try {
        setLoading(true)
        // Colaboradores filtered by tenant_id and departamento
        const team = await colaboradorService.getColaboradoresByDepartment(
          user.tenant_id,
          gestorDept,
        )
        setColaboradores(team)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadTeam()
  }, [user?.tenant_id, gestorDept])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Não informada'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('pt-BR')
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-[#212121]">
              Equipe do Departamento: <span className="text-[#0D47A1]">{gestorDept}</span>
            </h2>
            <Badge variant="outline" className="bg-[#F3E5F5] text-[#6A1B9A] border-[#6A1B9A]/30">
              Gestão
            </Badge>
          </div>
          <p className="text-sm text-[#757575]">
            Membros ativos e colaboradores sob sua área de liderança direta na Tesla RH.
          </p>
        </div>

        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-[#E0E0E0] pt-4 md:pt-0 md:pl-6">
          <div className="text-center">
            <span className="text-2xl font-bold text-[#0D47A1]">{colaboradores.length}</span>
            <p className="text-xs font-medium text-[#757575]">Colaboradores</p>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-[#2E7D32]">
              {colaboradores.filter((c) => c.status === 'ativo').length}
            </span>
            <p className="text-xs font-medium text-[#757575]">Ativos</p>
          </div>
        </div>
      </div>

      {/* Team Member Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-[#E0E0E0] p-4 space-y-4">
              <Skeleton className="h-12 w-12 rounded-full bg-slate-200" />
              <Skeleton className="h-4 w-3/4 bg-slate-200" />
              <Skeleton className="h-4 w-1/2 bg-slate-100" />
            </Card>
          ))}
        </div>
      ) : colaboradores.length === 0 ? (
        <Card className="border border-[#E0E0E0] bg-white p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-[#757575]/50" />
          <h3 className="mt-4 text-base font-semibold text-[#212121]">
            Nenhum colaborador encontrado
          </h3>
          <p className="mt-1 text-sm text-[#757575]">
            Não há colaboradores vinculados ao seu departamento no momento.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {colaboradores.map((member) => {
            const isSelf = member.user_id === user?.id

            return (
              <Card
                key={member.id}
                className={`border bg-white shadow-sm hover:shadow-md transition-all ${
                  isSelf ? 'border-[#6A1B9A]/40 ring-1 ring-[#6A1B9A]/20' : 'border-[#E0E0E0]'
                }`}
              >
                <CardHeader className="pb-3 border-b border-[#F5F5F5]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Avatar className="h-12 w-12 border border-[#E0E0E0]">
                        {member.foto_url && <AvatarImage src={member.foto_url} alt={member.nome} />}
                        <AvatarFallback className="bg-[#E8EEF7] text-[#0D47A1] font-semibold text-sm">
                          {member.nome.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <CardTitle className="text-sm font-bold text-[#212121] truncate">
                            {member.nome}
                          </CardTitle>
                          {isSelf && (
                            <span className="text-[10px] font-semibold bg-[#F3E5F5] text-[#6A1B9A] px-1.5 py-0.5 rounded">
                              Você
                            </span>
                          )}
                        </div>
                        <CardDescription className="text-xs text-[#0D47A1] font-medium truncate mt-0.5">
                          {member.cargo || 'Cargo não definido'}
                        </CardDescription>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[11px] shrink-0 font-medium ${
                        member.status === 'ativo'
                          ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/20'
                          : 'bg-[#FFEBEE] text-[#C62828] border-[#C62828]/20'
                      }`}
                    >
                      {member.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-[#757575]">
                    <span className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-[#757575]" />
                      Setor:
                    </span>
                    <span className="font-medium text-[#212121]">{member.departamento}</span>
                  </div>

                  <div className="flex items-center justify-between text-[#757575]">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#757575]" />
                      Admissão:
                    </span>
                    <span className="font-medium text-[#212121]">
                      {formatDate(member.data_admissao)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[#757575]">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#757575]" />
                      CPF:
                    </span>
                    <span className="font-mono text-[#212121]">{member.cpf}</span>
                  </div>

                  <div className="pt-2 border-t border-[#F5F5F5] flex items-center justify-between text-[11px]">
                    <span className="text-[#757575]">Situação de escala:</span>
                    <span className="text-[#2E7D32] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Em dia
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
