import React, { useState, useEffect } from 'react'
import {
  Building2,
  Save,
  RefreshCw,
  CheckCircle2,
  Shield,
  FileText,
  Phone,
  MapPin,
  Landmark,
  BadgePercent,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { tenantService, logAuditoriaService } from '@/services/api'
import { Tenant, TenantRegimeTributario } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { TESLA_LOGO_URL } from '@/lib/logoAsset'

export default function AdminConfiguracoesPage() {
  const { user } = useAuth()
  const tenantId = user?.tenant_id
  const { toast } = useToast()

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Campos do formulário
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [endereco, setEndereco] = useState('')
  const [telefone, setTelefone] = useState('')
  const [regimeTributario, setRegimeTributario] = useState<TenantRegimeTributario>('Lucro Real')

  const carregarTenant = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const data = await tenantService.getTenant(tenantId)
      setTenant(data)
      setRazaoSocial(data.razao_social || '')
      setCnpj(data.cnpj || '')
      setEndereco(data.endereco || '')
      setTelefone(data.telefone || '')
      setRegimeTributario(data.regime_tributario || 'Lucro Real')
    } catch (err) {
      console.error('Erro ao buscar dados do tenant:', err)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados cadastrais da empresa.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarTenant()
  }, [tenantId])

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !user?.id) return

    if (!razaoSocial.trim() || !cnpj.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Razão social e CNPJ são campos mandatórios.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      const updated = await tenantService.updateTenant(tenantId, {
        razao_social: razaoSocial.trim(),
        cnpj: cnpj.trim(),
        endereco: endereco.trim(),
        telefone: telefone.trim(),
        regime_tributario: regimeTributario,
      })

      setTenant(updated)

      // Registrar auditoria
      await logAuditoriaService.registrarLog({
        tenant_id: tenantId,
        user_id: user.id,
        acao: 'atualizacao_configuracoes_empresa',
        entidade: 'tenant',
        entidade_id: tenantId,
        dados_json: {
          razao_social: razaoSocial,
          cnpj,
          endereco,
          telefone,
          regime_tributario: regimeTributario,
          usuario_admin: user.name,
        },
      })

      toast({
        title: 'Configurações salvas!',
        description: 'Os dados cadastrais e fiscais da empresa foram atualizados com sucesso.',
      })
    } catch (err) {
      console.error('Erro ao atualizar configurações:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-12 w-12 rounded-full border-2 border-[#0D47A1]/20 shadow-xs p-0.5 bg-white shrink-0 ring-2 ring-[#0D47A1]/10 flex items-center justify-center">
            <img
              src={TESLA_LOGO_URL}
              alt="Logo Tesla Mecatrônica"
              className="h-full w-full rounded-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Configurações da Empresa
              </h1>
              <Badge
                variant="outline"
                className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-xs font-semibold"
              >
                Administração Geral
              </Badge>
            </div>
            <p className="text-sm text-[#757575] mt-1">
              Gerencie os dados cadastrais, fiscais e de contato da sua organização no Gente e
              Gestão Tesla.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={carregarTenant}
          disabled={loading || saving}
          className="border-[#E0E0E0] text-[#212121] text-xs h-9"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Recarregar
        </Button>
      </div>

      {/* Formulário Principal */}
      <form onSubmit={handleSalvar} className="space-y-6">
        <Card className="border border-[#E0E0E0] bg-white shadow-xs">
          <CardHeader className="p-5 border-b border-[#F0F0F0]">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-[#212121]">
                  Dados Cadastrais da Organização
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Informações jurídicas vinculadas à folha, emissão de holerites e comunicados
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            {/* Linha 1: Razão Social e CNPJ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="razao" className="text-xs font-semibold text-[#212121]">
                  Razão Social *
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-[#757575]" />
                  <Input
                    id="razao"
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                    placeholder="Ex: Tesla RH Soluções Corporativas Ltda"
                    className="pl-9 text-xs h-9 border-[#E0E0E0]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cnpj" className="text-xs font-semibold text-[#212121]">
                  CNPJ *
                </Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 h-4 w-4 text-[#757575]" />
                  <Input
                    id="cnpj"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="pl-9 text-xs h-9 border-[#E0E0E0] font-mono"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Linha 2: Endereço Completo */}
            <div className="space-y-1.5">
              <Label htmlFor="endereco" className="text-xs font-semibold text-[#212121]">
                Endereço Corporativo (Sede)
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-[#757575]" />
                <Input
                  id="endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Ex: Av. Paulista, 1578, 14º Andar - Bela Vista, São Paulo - SP, CEP 01310-200"
                  className="pl-9 text-xs h-9 border-[#E0E0E0]"
                />
              </div>
            </div>

            {/* Linha 3: Telefone e Regime Tributário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-xs font-semibold text-[#212121]">
                  Telefone Corporativo / Central
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-[#757575]" />
                  <Input
                    id="telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 3254-8900"
                    className="pl-9 text-xs h-9 border-[#E0E0E0]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="regime" className="text-xs font-semibold text-[#212121]">
                  Regime Tributário
                </Label>
                <Select
                  value={regimeTributario}
                  onValueChange={(val) => setRegimeTributario(val as TenantRegimeTributario)}
                >
                  <SelectTrigger id="regime" className="border-[#E0E0E0] text-xs h-9 bg-white">
                    <SelectValue placeholder="Selecione o regime..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                    <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                    <SelectItem value="MEI">MEI (Microempreendedor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status e Plano do Tenant (somente leitura informativa) */}
            <div className="pt-4 border-t border-[#F0F0F0] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E0E0E0]">
                <span className="text-[#757575] block text-[11px]">Plano Contratado</span>
                <span className="font-bold text-[#0D47A1] text-sm capitalize">
                  {tenant?.plano || 'Enterprise'}
                </span>
              </div>

              <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E0E0E0]">
                <span className="text-[#757575] block text-[11px]">Status da Assinatura</span>
                <span className="font-bold text-[#2E7D32] text-sm capitalize">
                  ● {tenant?.status || 'Ativo'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Barra de Ação Inferior */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="submit"
            disabled={saving || loading}
            className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-10 px-6 gap-2 shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
