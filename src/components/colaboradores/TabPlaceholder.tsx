import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LucideIcon, Sparkles } from 'lucide-react'

interface TabPlaceholderProps {
  title: string
  description: string
  icon: LucideIcon
  badgeText?: string
}

export const TabPlaceholder: React.FC<TabPlaceholderProps> = ({
  title,
  description,
  icon: Icon,
  badgeText = 'Funcionalidade disponível em versão futura',
}) => {
  return (
    <Card className="border border-dashed border-[#CFD8DC] bg-[#FAFAFA] shadow-none">
      <CardContent className="flex flex-col items-center justify-center text-center py-12 px-6 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center shadow-xs">
          <Icon className="h-7 w-7" />
        </div>

        <div className="space-y-1.5 max-w-md">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-base font-bold text-[#212121]">{title}</h3>
            <Badge
              variant="outline"
              className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/20 text-[10px] font-semibold"
            >
              Em breve
            </Badge>
          </div>
          <p className="text-xs text-[#757575] leading-relaxed">{description}</p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-[#546E7A] border border-slate-200">
          <Sparkles className="h-3.5 w-3.5 text-[#0D47A1]" />
          <span>{badgeText}</span>
        </div>
      </CardContent>
    </Card>
  )
}
