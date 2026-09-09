import React from 'react'
import { UserCheck } from 'lucide-react'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export default function CandidatosPage() {
  return (
    <ModulePlaceholder
      title="Candidatos"
      pillar="Gestão de Talentos"
      description="Banco de talentos, triagem de currículos e acompanhamento de etapas de seleção."
      icon={UserCheck}
    />
  )
}
