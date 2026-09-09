import React from 'react'
import { User } from 'lucide-react'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

export default function MeuPerfilPage() {
  return (
    <ModulePlaceholder
      title="Meu Perfil"
      pillar="Portal do Colaborador"
      description="Gerencie seus dados cadastrais, endereço, contatos de emergência e histórico profissional."
      icon={User}
    />
  )
}
