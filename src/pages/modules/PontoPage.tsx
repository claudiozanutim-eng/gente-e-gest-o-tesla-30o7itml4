import React from 'react'
import { Clock } from 'lucide-react'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export default function PontoPage() {
  return (
    <ModulePlaceholder
      title="Controle de Ponto"
      pillar="Gestão do Tempo"
      description="Registro de jornada diária, espelho de ponto eletrônico, batidas e banco de horas."
      icon={Clock}
    />
  )
}
