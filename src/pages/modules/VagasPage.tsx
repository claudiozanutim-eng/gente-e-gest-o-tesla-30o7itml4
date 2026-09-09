import React from 'react'
import { Briefcase } from 'lucide-react'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export default function VagasPage() {
  return (
    <ModulePlaceholder
      title="Vagas"
      pillar="Gestão de Talentos"
      description="Gerenciamento de posições abertas, requisições de pessoal e publicações externas."
      icon={Briefcase}
    />
  )
}
