import React from 'react'
import { CalendarDays } from 'lucide-react'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export default function EscalasPage() {
  return (
    <ModulePlaceholder
      title="Escalas de Trabalho"
      pillar="Gestão do Tempo"
      description="Planejamento de turnos, folgas, escala 5x2, 6x1 e 12x36 para as equipes da organização."
      icon={CalendarDays}
    />
  )
}
