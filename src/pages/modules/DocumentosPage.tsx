import React from 'react'
import { FileText } from 'lucide-react'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export default function DocumentosPage() {
  return (
    <ModulePlaceholder
      title="Meus Documentos"
      pillar="Portal do Colaborador"
      description="Holerites, informes de rendimentos, contratos e comprovantes assinados."
      icon={FileText}
    />
  )
}
