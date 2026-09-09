import React from 'react'
import { useNavigate } from 'react-router-dom'
import { LucideIcon, ArrowLeft, Clock, Sparkles } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ModulePlaceholderProps {
  title: string
  pillar: string
  description: string
  icon: LucideIcon
}

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({
  title,
  pillar,
  description,
  icon: Icon,
}) => {
  const navigate = useNavigate()
  const { getHomeRoute } = useAuth()

  const handleBack = () => {
    navigate(getHomeRoute())
  }

  return (
    <div className="space-y-6">
      {/* Pillar & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/20 text-xs"
            >
              {pillar}
            </Badge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#212121]">{title}</h2>
          <p className="text-sm text-[#757575]">{description}</p>
        </div>

        <Button
          variant="outline"
          onClick={handleBack}
          className="border-[#E0E0E0] text-[#212121] hover:bg-[#F5F5F5] w-fit text-xs md:text-sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para a Página Inicial
        </Button>
      </div>

      {/* Main Empty State Card */}
      <Card className="border border-[#E0E0E0] bg-white shadow-sm overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="relative mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#E8EEF7] text-[#0D47A1] shadow-sm">
              <Icon className="h-10 w-10" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#0D47A1] text-white shadow">
              <Clock className="h-4 w-4" />
            </div>
          </div>

          <div className="max-w-md space-y-2">
            <h3 className="text-xl font-bold text-[#212121]">Módulo de {title}</h3>
            <p className="text-sm text-[#757575] leading-relaxed">
              Este módulo estará disponível em breve. A base operacional deste pilar está
              configurada e será liberada nas próximas atualizações da plataforma Gente e Gestão
              Tesla.
            </p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={handleBack}
              className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white px-6"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retornar ao Meu Painel
            </Button>
          </div>

          <div className="mt-10 pt-6 border-t border-[#F5F5F5] w-full max-w-sm flex items-center justify-center gap-2 text-xs text-[#757575]">
            <Sparkles className="h-3.5 w-3.5 text-[#0D47A1]" />
            <span>Estrutura base implantada e pronta para expansão modular.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
