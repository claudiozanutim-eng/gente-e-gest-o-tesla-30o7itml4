import React from 'react'
import { FileCheck } from 'lucide-react'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export default function AtestadosPage() {
  return (
    <ModulePlaceholder
      title="Atestados"
      pillar="Portal do Colaborador"
      description="Envio de atestados médicos, declarações de comparecimento e acompanhamento de homologação pelo RH."
      icon={FileCheck}
    />
  )
}
