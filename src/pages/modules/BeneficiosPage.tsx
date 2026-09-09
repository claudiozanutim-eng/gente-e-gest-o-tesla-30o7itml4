import React from 'react'
import { Gift } from 'lucide-react'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export default function BeneficiosPage() {
  return (
    <ModulePlaceholder
      title="Benefícios"
      pillar="Portal do Colaborador"
      description="Consulta a planos de saúde, odontológico, vale alimentação, transporte e seguros corporativos."
      icon={Gift}
    />
  )
}
