import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Gift,
  Shield,
  CreditCard,
  Building,
  FileDown,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Phone,
  Sparkles,
  ArrowRight,
  Settings,
  RefreshCw,
  Heart,
  Briefcase,
  AlertCircle,
  FileCheck,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { beneficioService } from '@/services/api'
import {
  ColaboradorBeneficio,
  BeneficioTipo,
  BENEFICIOS_CONFIG,
  PROFILE_LABELS,
  PROFILE_BADGE_COLORS,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export default function BeneficiosPage() {
  const navigate = useNavigate()
  const { user, colaborador } = useAuth()
  const { toast } = useToast()

  const [beneficios, setBeneficios] = useState<ColaboradorBeneficio[]>([])
  const [loading, setLoading] = useState(true)
  const [expandPlanoSaude, setExpandPlanoSaude] = useState(false)
  const [modalDetalhes, setModalDetalhes] = useState<ColaboradorBeneficio | null>(null)

  const perfil = user?.perfil || 'colaborador'
  const isRHouAdmin = perfil === 'rh' || perfil === 'admin'
  const badgeStyle = PROFILE_BADGE_COLORS[perfil]

  // Carregar benefícios do colaborador logado
  const carregarBeneficios = async () => {
    if (!user?.tenant_id) return
    try {
      setLoading(true)
      const colabId = colaborador?.id
      if (!colabId) {
        setBeneficios([])
        return
      }
      const records = await beneficioService.getBeneficiosColaborador(user.tenant_id, colabId)
      setBeneficios(records)
    } catch (err) {
      console.error('Erro ao carregar benefícios do colaborador:', err)
      toast({
        title: 'Erro ao carregar benefícios',
        description: 'Não foi possível carregar a relação de benefícios vinculados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarBeneficios()
  }, [user?.tenant_id, colaborador?.id])

  // Formatação de moeda BRL
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  // Obter o tipo do benefício (de expand ou do item)
  const getTipo = (item: ColaboradorBeneficio): BeneficioTipo => {
    return (item.expand?.beneficio_id?.tipo || 'vt') as BeneficioTipo
  }

  // Agrupamento por tipo para renderização rápida
  const getBeneficioPorTipo = (tipo: BeneficioTipo) => {
    return beneficios.find((b) => getTipo(b) === tipo)
  }

  const planoSaudeItem = getBeneficioPorTipo('plano_saude')

  // Total de benefícios vinculados
  const totalBeneficios = beneficios.length
  const valorTotalMensal = beneficios.reduce((acc, curr) => acc + (curr.valor || 0), 0)

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header do Painel */}
      <div className="relative overflow-hidden rounded-2xl border border-[#0D47A1]/20 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1E88E5] p-6 md:p-8 text-white shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Gift className="h-3.5 w-3.5 text-blue-200" />
              <span>Painel de Benefícios Corporativos • Tesla RH</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Meus Benefícios</h1>
            <p className="text-sm md:text-base text-white/90 max-w-2xl leading-relaxed">
              Consulte seu pacote de benefícios ativos, coberturas de saúde e odontologia, saldos de
              auxílio alimentação, refeição, transporte e apólice de seguro de vida.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur-md p-3 border border-white/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">
                  {colaborador?.nome || user?.name || 'Colaborador'}
                </span>
                <Badge
                  variant="outline"
                  className={`${badgeStyle.bg} ${badgeStyle.text} text-[10px] px-2 py-0 border-0 font-bold`}
                >
                  {PROFILE_LABELS[perfil]}
                </Badge>
              </div>
              <p className="text-white/80 text-[11px] mt-0.5">
                {totalBeneficios} {totalBeneficios === 1 ? 'benefício ativo' : 'benefícios ativos'}
              </p>
            </div>

            {/* Acesso rápido à gestão se for RH ou Admin */}
            {isRHouAdmin && (
              <Button
                onClick={() => navigate('/beneficios/gestao')}
                className="bg-white text-[#0D47A1] hover:bg-white/90 font-semibold shadow-xs text-xs gap-1.5 h-10 px-4"
              >
                <Settings className="h-4 w-4" />
                Gestão RH
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Barra Informativa com Resumo e Indicadores (somente leitura) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#E0E0E0] bg-white p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center font-bold">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
                Benefícios Ativos
              </p>
              <h3 className="text-xl font-extrabold text-[#212121]">{totalBeneficios} de 6</h3>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            Regime CLT
          </Badge>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center font-bold">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
                Investimento Mensal RH
              </p>
              <h3 className="text-xl font-extrabold text-[#212121]">
                {formatCurrency(valorTotalMensal)}
              </h3>
            </div>
          </div>
          <span className="text-[11px] text-[#757575]">Subsidiado</span>
        </div>

        <div className="rounded-xl border border-[#E0E0E0] bg-white p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#FFEBEE] text-[#C62828] flex items-center justify-center font-bold">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#757575]">
                Status do Pacote
              </p>
              <h3 className="text-xl font-extrabold text-emerald-700">100% Homologado</h3>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[11px] bg-blue-50 text-[#0D47A1] border-blue-200"
          >
            Modo Consulta
          </Badge>
        </div>
      </div>

      {/* 3. Cards Individuais dos Benefícios do Colaborador */}
      <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#212121] flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-[#0D47A1]" />
              Benefícios Vinculados à sua Matrícula
            </h2>
            <p className="text-xs text-[#757575]">
              Modo somente leitura. Dados fornecidos e mantidos pelo setor de Recursos Humanos.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarBeneficios}
            disabled={loading}
            className="text-xs border-[#E0E0E0] text-[#757575] hover:text-[#212121] h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border border-[#E0E0E0] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-10 w-10 rounded-lg bg-slate-100" />
                  <Skeleton className="h-5 w-24 rounded bg-slate-100" />
                </div>
                <Skeleton className="h-6 w-3/4 bg-slate-100" />
                <Skeleton className="h-14 w-full bg-slate-100" />
              </Card>
            ))}
          </div>
        ) : beneficios.length === 0 ? (
          /* Estado Vazio Amigável */
          <div className="rounded-2xl border border-dashed border-[#E0E0E0] bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8EEF7] text-[#0D47A1] mb-4">
              <Gift className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-[#212121]">
              Nenhum benefício vinculado no momento
            </h3>
            <p className="text-sm text-[#757575] mt-1.5 max-w-md mx-auto leading-relaxed">
              Você ainda não possui benefícios ativos cadastrados no sistema. Caso tenha sido
              admitido recentemente ou tenha dúvidas sobre seu pacote contratual, procure o time de
              Gente & Gestão.
            </p>
            {isRHouAdmin && (
              <Button
                onClick={() => navigate('/beneficios/gestao')}
                className="mt-6 bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold"
              >
                Ir para o Painel de Gestão de Benefícios
              </Button>
            )}
          </div>
        ) : (
          /* Grid de Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {beneficios.map((item) => {
              const tipo = getTipo(item)
              const config = BENEFICIOS_CONFIG[tipo] || BENEFICIOS_CONFIG.vt
              const det = item.detalhes_json || {}
              const isPlanoSaude = tipo === 'plano_saude'

              return (
                <Card
                  key={item.id}
                  className={`group relative flex flex-col justify-between overflow-hidden border bg-white shadow-xs transition-all duration-200 hover:shadow-md ${
                    isPlanoSaude
                      ? 'border-[#0D47A1]/40 ring-1 ring-[#0D47A1]/20'
                      : 'border-[#E0E0E0] hover:border-[#0D47A1]/30'
                  }`}
                  style={{
                    borderTop: `4px solid ${config.cor}`,
                  }}
                >
                  <CardHeader className="p-5 pb-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-11 w-11 rounded-xl flex items-center justify-center text-2xl shadow-xs"
                          style={{ backgroundColor: `${config.cor}15` }}
                        >
                          <span role="img" aria-label={config.nome}>
                            {config.emoji}
                          </span>
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-[#212121] leading-tight">
                            {config.nome}
                          </CardTitle>
                          <span className="text-[11px] font-medium text-[#757575]">
                            {config.categoria}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`${config.badgeBg} ${config.badgeText} text-[10px] font-bold border-0 px-2 py-0.5`}
                      >
                        Ativo
                      </Badge>
                    </div>

                    <CardDescription className="text-xs text-[#616161] line-clamp-2 leading-relaxed">
                      {item.expand?.beneficio_id?.descricao || config.descricaoPadrao}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    {/* CONTEÚDO ESPECÍFICO POR TIPO CONFORME ESPECIFICAÇÃO */}

                    {/* 1. Vale Transporte (vt): exibir valor mensal */}
                    {tipo === 'vt' && (
                      <div className="space-y-3 rounded-lg bg-[#F8FAFC] p-3.5 border border-slate-100">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-semibold text-[#757575]">
                            Valor Mensal:
                          </span>
                          <span className="text-base font-extrabold text-[#0288D1]">
                            {formatCurrency(item.valor)}
                          </span>
                        </div>
                        {det.tipo_transporte && (
                          <div className="text-xs text-[#424242] flex items-center justify-between border-t border-slate-200/60 pt-2">
                            <span className="text-[#757575]">Modal:</span>
                            <span className="font-medium text-right truncate max-w-[170px]">
                              {det.tipo_transporte}
                            </span>
                          </div>
                        )}
                        {det.numero_cartao && (
                          <div className="text-xs text-[#424242] flex items-center justify-between">
                            <span className="text-[#757575]">Cartão:</span>
                            <span className="font-mono text-[11px] bg-slate-200/60 px-1.5 py-0.5 rounded">
                              {det.numero_cartao}
                            </span>
                          </div>
                        )}
                        {det.linha_habitual && (
                          <div className="text-[11px] text-[#757575] border-t border-slate-200/60 pt-2">
                            Itinerário:{' '}
                            <strong className="text-[#424242]">{det.linha_habitual}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Vale Refeição (vr): exibir valor diário/mensal */}
                    {tipo === 'vr' && (
                      <div className="space-y-3 rounded-lg bg-[#F8FAFC] p-3.5 border border-slate-100">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-semibold text-[#757575]">
                            Valor Mensal:
                          </span>
                          <span className="text-base font-extrabold text-[#E65100]">
                            {formatCurrency(item.valor)}
                          </span>
                        </div>
                        {det.valor_diario !== undefined && (
                          <div className="text-xs text-[#424242] flex items-center justify-between border-t border-slate-200/60 pt-2">
                            <span className="text-[#757575]">Valor Diário:</span>
                            <span className="font-bold text-[#E65100]">
                              {formatCurrency(det.valor_diario as number)} / dia
                            </span>
                          </div>
                        )}
                        {det.bandeira && (
                          <div className="text-xs text-[#424242] flex items-center justify-between">
                            <span className="text-[#757575]">Operadora:</span>
                            <span className="font-medium">{det.bandeira}</span>
                          </div>
                        )}
                        {det.cartao_final && (
                          <div className="text-xs text-[#424242] flex items-center justify-between">
                            <span className="text-[#757575]">Final do Cartão:</span>
                            <span className="font-mono text-[11px]">•••• {det.cartao_final}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. Vale Alimentação (va): exibir valor mensal */}
                    {tipo === 'va' && (
                      <div className="space-y-3 rounded-lg bg-[#F8FAFC] p-3.5 border border-slate-100">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-semibold text-[#757575]">
                            Valor Mensal:
                          </span>
                          <span className="text-base font-extrabold text-[#2E7D32]">
                            {formatCurrency(item.valor)}
                          </span>
                        </div>
                        {det.bandeira && (
                          <div className="text-xs text-[#424242] flex items-center justify-between border-t border-slate-200/60 pt-2">
                            <span className="text-[#757575]">Bandeira:</span>
                            <span className="font-medium">{det.bandeira}</span>
                          </div>
                        )}
                        {det.cobertura && (
                          <div className="text-[11px] text-[#757575] border-t border-slate-200/60 pt-2">
                            Uso: <strong className="text-[#424242]">{det.cobertura}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. Plano de Saúde (plano_saude): exibir operadora, plano e número da carteirinha + expansão */}
                    {tipo === 'plano_saude' && (
                      <div className="space-y-3 rounded-lg bg-red-50/50 p-3.5 border border-red-100/70">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#757575]">Operadora:</span>
                          <span className="font-bold text-[#C62828] text-right truncate max-w-[170px]">
                            {det.operadora || 'Bradesco Saúde'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs border-t border-red-200/40 pt-2">
                          <span className="text-[#757575]">Plano:</span>
                          <span className="font-medium text-[#212121] text-right truncate max-w-[180px]">
                            {det.plano || 'Top Nacional Plus'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs border-t border-red-200/40 pt-2">
                          <span className="text-[#757575]">Carteirinha:</span>
                          <span className="font-mono font-bold text-[11px] bg-white px-2 py-0.5 rounded border border-red-200 text-[#C62828]">
                            {det.carteirinha || '892.401.829.102.001-4'}
                          </span>
                        </div>

                        {/* Botão de expansão/detalhes no próprio card */}
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandPlanoSaude(!expandPlanoSaude)}
                            className="w-full text-xs font-bold text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50/80 h-8 justify-between px-2"
                          >
                            <span>
                              {expandPlanoSaude
                                ? 'Ocultar detalhes do plano'
                                : 'Ver detalhes completos & rede'}
                            </span>
                            {expandPlanoSaude ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        {/* Área Expandida inline do Plano de Saúde */}
                        {expandPlanoSaude && (
                          <div className="mt-2 space-y-2.5 pt-3 border-t border-red-200/60 text-xs animate-in fade-in-50 duration-200">
                            {det.acomodacao && (
                              <div className="flex justify-between text-[#424242]">
                                <span className="text-[#757575]">Acomodação:</span>
                                <span className="font-semibold">{det.acomodacao}</span>
                              </div>
                            )}
                            {det.abrangencia && (
                              <div className="flex justify-between text-[#424242]">
                                <span className="text-[#757575]">Abrangência:</span>
                                <span className="font-semibold">{det.abrangencia}</span>
                              </div>
                            )}
                            {det.carencia_restante && (
                              <div className="flex justify-between text-[#424242]">
                                <span className="text-[#757575]">Carências:</span>
                                <span className="font-semibold text-emerald-700">
                                  {det.carencia_restante}
                                </span>
                              </div>
                            )}
                            {det.contato_emergencia && (
                              <div className="flex justify-between items-center text-[#424242]">
                                <span className="text-[#757575] flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-red-500" /> Central 24h:
                                </span>
                                <span className="font-bold text-[#C62828]">
                                  {det.contato_emergencia}
                                </span>
                              </div>
                            )}
                            {det.rede_credenciada && (
                              <div className="space-y-1 bg-white p-2.5 rounded border border-red-100">
                                <span className="text-[11px] font-bold text-[#757575] uppercase tracking-wider block">
                                  Hospitais & Rede Credenciada:
                                </span>
                                <p className="text-[11px] text-[#424242] leading-relaxed">
                                  {det.rede_credenciada}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 5. Seguro de Vida (seguro_vida): exibir valor da cobertura e link para download do documento de beneficiário */}
                    {tipo === 'seguro_vida' && (
                      <div className="space-y-3 rounded-lg bg-blue-50/60 p-3.5 border border-blue-100">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-semibold text-[#757575]">Cobertura:</span>
                          <span className="text-base font-extrabold text-[#0D47A1]">
                            {det.valor_cobertura
                              ? formatCurrency(det.valor_cobertura as number)
                              : det.cobertura_morte || 'R$ 250.000,00'}
                          </span>
                        </div>
                        {det.seguradora && (
                          <div className="text-xs text-[#424242] flex items-center justify-between border-t border-blue-200/50 pt-2">
                            <span className="text-[#757575]">Seguradora:</span>
                            <span className="font-medium">{det.seguradora}</span>
                          </div>
                        )}
                        {det.apolice && (
                          <div className="text-xs text-[#424242] flex items-center justify-between">
                            <span className="text-[#757575]">Apólice nº:</span>
                            <span className="font-mono text-[11px]">{det.apolice}</span>
                          </div>
                        )}

                        {/* Link para download do documento de beneficiário */}
                        <div className="pt-2 border-t border-blue-200/50">
                          {det.documento_beneficiario_url ? (
                            <a
                              href={det.documento_beneficiario_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#0D47A1] hover:bg-[#0A3A82] text-white py-1.5 px-3 text-xs font-semibold shadow-xs transition-colors"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                              <span>Baixar Termo de Beneficiários</span>
                            </a>
                          ) : (
                            <div className="text-[11px] text-[#757575] flex items-center gap-1.5 bg-white p-2 rounded border border-blue-100">
                              <Info className="h-3.5 w-3.5 text-[#0D47A1]" />
                              <span>Termo físico arquivado no prontuário do colaborador.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 6. Plano Odontológico (plano_odonto): exibir operadora e número da carteirinha */}
                    {tipo === 'plano_odonto' && (
                      <div className="space-y-3 rounded-lg bg-teal-50/50 p-3.5 border border-teal-100">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#757575]">Operadora:</span>
                          <span className="font-bold text-[#00695C] text-right truncate max-w-[170px]">
                            {det.operadora || 'OdontoPrev'}
                          </span>
                        </div>
                        {det.plano && (
                          <div className="flex items-center justify-between text-xs border-t border-teal-200/40 pt-2">
                            <span className="text-[#757575]">Plano:</span>
                            <span className="font-medium text-[#212121]">{det.plano}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs border-t border-teal-200/40 pt-2">
                          <span className="text-[#757575]">Carteirinha:</span>
                          <span className="font-mono font-bold text-[11px] bg-white px-2 py-0.5 rounded border border-teal-200 text-[#00695C]">
                            {det.carteirinha || 'OP-491.029.381-00'}
                          </span>
                        </div>
                        {det.rede_credenciada && (
                          <div className="text-[11px] text-[#757575] border-t border-teal-200/40 pt-2">
                            Rede: <strong className="text-[#424242]">{det.rede_credenciada}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rodapé do Card com ação de visualizar modal completo */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-[#9E9E9E]">Benefício homologado</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModalDetalhes(item)}
                        className="text-xs font-semibold text-[#0D47A1] hover:text-[#0A3A82] hover:bg-[#E8EEF7] h-7 px-2 gap-1"
                      >
                        <Info className="h-3 w-3" />
                        Mais detalhes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. Caixa de Informações Importantes / Legislação */}
      <div className="rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#212121]">
          <Info className="h-4 w-4 text-[#0D47A1]" />
          <span>Informações e Diretrizes de Benefícios Corporativos</span>
        </div>
        <p className="text-xs text-[#616161] leading-relaxed">
          Os benefícios corporativos são concedidos conforme a Convenção Coletiva de Trabalho e as
          políticas internas da empresa. Caso deseje incluir dependentes legais no plano de saúde ou
          atualizar seus beneficiários no seguro de vida, entre em contato com a equipe de Recursos
          Humanos ou registre uma solicitação pelo seu painel de perfil.
        </p>
      </div>

      {/* Modal Dialog de Detalhes Completos do Benefício Selecionado */}
      <Dialog open={!!modalDetalhes} onOpenChange={(open) => !open && setModalDetalhes(null)}>
        {modalDetalhes && (
          <DialogContent className="max-w-lg p-0 overflow-hidden bg-white border border-[#E0E0E0]">
            {/* Faixa decorativa superior */}
            <div
              className="h-2 w-full"
              style={{
                backgroundColor: BENEFICIOS_CONFIG[getTipo(modalDetalhes)]?.cor || '#0D47A1',
              }}
            />

            <div className="p-6 space-y-4">
              <DialogHeader className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {BENEFICIOS_CONFIG[getTipo(modalDetalhes)]?.emoji}
                  </span>
                  <div>
                    <DialogTitle className="text-lg font-bold text-[#212121]">
                      {BENEFICIOS_CONFIG[getTipo(modalDetalhes)]?.nome}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-[#757575]">
                      {BENEFICIOS_CONFIG[getTipo(modalDetalhes)]?.categoria} • Informações
                      Cadastrais
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Tabela de campos do detalhes_json */}
              <div className="space-y-2 border-y border-[#F0F0F0] py-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-[#757575]">Valor Cadastrado:</span>
                  <span className="font-extrabold text-[#212121]">
                    {formatCurrency(modalDetalhes.valor)}
                  </span>
                </div>

                {Object.entries(modalDetalhes.detalhes_json || {}).map(([key, val]) => {
                  if (key === 'documento_beneficiario_url') return null
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

                  return (
                    <div
                      key={key}
                      className="flex justify-between py-1 border-b border-slate-50 gap-4"
                    >
                      <span className="text-[#757575] shrink-0">{label}:</span>
                      <span className="font-medium text-[#212121] text-right break-words">
                        {Array.isArray(val) ? val.join(', ') : String(val)}
                      </span>
                    </div>
                  )
                })}

                {modalDetalhes.detalhes_json?.documento_beneficiario_url && (
                  <div className="pt-2">
                    <a
                      href={modalDetalhes.detalhes_json.documento_beneficiario_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#0D47A1] text-white py-2 text-xs font-semibold hover:bg-[#0A3A82] transition-colors"
                    >
                      <FileDown className="h-4 w-4" />
                      Baixar Documento de Beneficiários
                    </a>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalDetalhes(null)}
                  className="text-xs border-[#E0E0E0] text-[#212121] h-8"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
