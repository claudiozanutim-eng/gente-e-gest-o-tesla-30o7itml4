import React from 'react'
import { Palmtree } from 'lucide-react'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export default function FeriasPage() {
  return (
    <ModulePlaceholder
      title="Minhas Férias"
      pillar="Portal do Colaborador"
      description="Saldo de períodos aquisitivos, programação de descanso e solicitação de abono pecuniário."
      icon={Palmtree}
    />
  )
}
