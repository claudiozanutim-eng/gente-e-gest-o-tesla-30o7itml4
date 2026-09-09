import React from 'react'
import { Network } from 'lucide-react'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export default function EstruturaPage() {
  return (
    <ModulePlaceholder
      title="Estrutura Organizacional"
      pillar="Gestão de Pessoas"
      description="Organograma corporativo, centros de custo, hierarquias e posições da empresa."
      icon={Network}
    />
  )
}
