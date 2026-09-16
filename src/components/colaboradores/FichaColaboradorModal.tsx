import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  User,
  Briefcase,
  CalendarOff,
  FileCheck,
  DollarSign,
  Building2,
  History,
  Award,
  Receipt,
  GraduationCap,
  Mail,
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  CreditCard,
  Users,
  PhoneCall,
  X,
  ExternalLink,
  Shield,
  Clock3,
  CheckCircle2,
  XCircle,
  FileText,
  AlertCircle,
  Info,
} from 'lucide-react'
import {
  Colaborador,
  Dependente,
  ContatoEmergencia,
  SolicitacaoAlteracao,
  LogAuditoria,
} from '@/types'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import {
  dependenteService,
  contatoEmergenciaService,
  solicitacaoService,
  logAuditoriaService,
  historicoFuncaoService,
} from '@/services/api'
import { HistoricoFuncao } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TabPlaceholder } from './TabPlaceholder'
import { DemonstrativoFinanceiroView } from '@/components/folha/DemonstrativoFinanceiroView'
import { ModalEditarPerfilColaborador } from './ModalEditarPerfilColaborador'
import { usePermission } from '@/hooks/usePermission'
import { Edit3 } from 'lucide-react'

export interface FichaColaboradorModalProps {
  colaborador: Colaborador | null
  open: boolean
  onClose: () => void
  onColaboradorUpdated?: (colaboradorAtualizado: Colaborador) => void
}

function formatarDataBR(dataStr?: string): string {
  if (!dataStr) return 'Não informado'
  try {
    const d = new Date(dataStr)
    if (isNaN(d.getTime())) return dataStr
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return dataStr
  }
}

function formatarDataHoraBR(dataStr?: string): string {
  if (!dataStr) return 'Não informado'
  try {
    const d = new Date(dataStr)
    if (isNaN(d.getTime())) return dataStr
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dataStr
  }
}

function calcularTempoEmpresa(dataInicioStr?: string, dataFimStr?: string): string {
  if (!dataInicioStr) return 'Não informado'
  try {
    const inicio = new Date(dataInicioStr)
    const fim = dataFimStr ? new Date(dataFimStr) : new Date()
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return 'Não informado'

    let anos = fim.getFullYear() - inicio.getFullYear()
    let meses = fim.getMonth() - inicio.getMonth()

    if (fim.getDate() < inicio.getDate()) {
      meses -= 1
    }
    if (meses < 0) {
      anos -= 1
      meses += 12
    }
    if (anos < 0) return 'Menos de 1 mês'
    if (anos === 0 && meses === 0) {
      const diffDias = Math.max(
        0,
        Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)),
      )
      return diffDias <= 1 ? 'Menos de 1 mês' : `${diffDias} dias`
    }

    const partes: string[] = []
    if (anos > 0) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`)
    if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mês' : 'meses'}`)
    return partes.join(' e ')
  } catch {
    return 'Não informado'
  }
}

function getIniciais(nome?: string): string {
  if (!nome) return 'CO'
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return 'CO'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export const FichaColaboradorModal: React.FC<FichaColaboradorModalProps> = ({
  colaborador,
  open,
  onClose,
  onColaboradorUpdated,
}) => {
  const { user } = useAuth()
  const { podeEditarPerfilColaborador } = usePermission()
  const [colaboradorLocal, setColaboradorLocal] = useState<Colaborador | null>(colaborador)
  const [activeTab, setActiveTab] = useState<string>('perfil')
  const [loadingDados, setLoadingDados] = useState<boolean>(true)
  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [contatosEmergencia, setContatosEmergencia] = useState<ContatoEmergencia[]>([])
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAlteracao[]>([])
  const [historicoAuditoria, setHistoricoAuditoria] = useState<LogAuditoria[]>([])
  const [historicoFuncoes, setHistoricoFuncoes] = useState<HistoricoFuncao[]>([])
  const [modalEdicaoOpen, setModalEdicaoOpen] = useState<boolean>(false)

  // Sincronizar estado local quando prop mudar
  useEffect(() => {
    setColaboradorLocal(colaborador)
  }, [colaborador])

  // Evitar duplicar registro de auditoria na mesma abertura
  const loggedRef = useRef<string | null>(null)

  useEffect(() => {
    const alvo = colaboradorLocal || colaborador
    if (!open || !alvo) {
      loggedRef.current = null
      setActiveTab('perfil')
      return
    }

    // 1. Gravar registro em log_auditoria
    const auditKey = `${alvo.id}_${user?.id}`
    if (loggedRef.current !== auditKey && user?.tenant_id && user?.id) {
      loggedRef.current = auditKey
      logAuditoriaService
        .registrarLog({
          tenant_id: user.tenant_id,
          user_id: user.id,
          acao: 'visualizacao_ficha',
          entidade: 'colaborador',
          entidade_id: alvo.id,
          dados_json: {
            colaborador_nome: alvo.nome,
            colaborador_cpf: alvo.cpf,
            colaborador_cargo: alvo.cargo,
            colaborador_departamento: alvo.departamento,
            usuario_nome: user.name,
            usuario_email: user.email,
            usuario_perfil: user.perfil,
            data_acesso: new Date().toISOString(),
          },
        })
        .catch((err) => {
          console.warn('Erro ao salvar log de auditoria da ficha:', err)
        })
    }

    // 2. Carregar dados relacionados do colaborador
    async function carregarFicha() {
      if (!alvo?.id) return
      try {
        setLoadingDados(true)
        const [depList, contatosList, solicList, logsList, funcList] = await Promise.all([
          dependenteService.getDependentesByColaborador(alvo.id).catch(() => []),
          contatoEmergenciaService.getContatosByColaborador(alvo.id).catch(() => []),
          solicitacaoService.getSolicitacoesByColaborador(alvo.id).catch(() => []),
          logAuditoriaService.getLogsPorEntidade('colaborador', alvo.id).catch(() => []),
          historicoFuncaoService.getHistoricoPorColaborador(alvo.id, false).catch(() => []),
        ])

        setDependentes(depList)
        setContatosEmergencia(contatosList)
        setSolicitacoes(solicList)
        setHistoricoAuditoria(logsList)
        setHistoricoFuncoes(funcList)
      } catch (err) {
        console.error('Erro ao carregar dados da ficha:', err)
      } finally {
        setLoadingDados(false)
      }
    }

    carregarFicha()
  }, [open, colaborador, user?.id, user?.tenant_id, user?.name, user?.email, user?.perfil])

  const dadosExibicao = colaboradorLocal || colaborador
  const nomeExibicao = dadosExibicao?.nome_completo || dadosExibicao?.nome || 'Colaborador'
  const iniciais = getIniciais(nomeExibicao)
  const tempoEmpresa = useMemo(
    () => calcularTempoEmpresa(dadosExibicao?.data_admissao),
    [dadosExibicao?.data_admissao],
  )

  // Função vigente atual: busca no histórico a que não tem data_fim (ou a mais recente)
  const funcaoVigente = useMemo(() => {
    if (historicoFuncoes.length === 0) return null
    // Procura primeiro registro aberto
    const aberta = historicoFuncoes.find((h) => !h.data_fim)
    if (aberta) return aberta
    // Ou pega a última ordenada por data_inicio
    return [...historicoFuncoes].sort(
      (a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime(),
    )[0]
  }, [historicoFuncoes])

  // Data de início da função atual (ou data de admissão se não houver histórico)
  const dataInicioFuncaoAtual = funcaoVigente?.data_inicio || dadosExibicao?.data_admissao
  const tempoNoCargoAtual = useMemo(
    () => calcularTempoEmpresa(dataInicioFuncaoAtual),
    [dataInicioFuncaoAtual],
  )

  const handleSalvoEdicao = (colaboradorAtualizado: Colaborador) => {
    setColaboradorLocal(colaboradorAtualizado)
    if (onColaboradorUpdated) {
      onColaboradorUpdated(colaboradorAtualizado)
    }
    // Recarregar dependentes, contatos e histórico
    if (colaboradorAtualizado) {
      Promise.all([
        dependenteService.getDependentesByColaborador(colaboradorAtualizado.id).catch(() => []),
        contatoEmergenciaService.getContatosByColaborador(colaboradorAtualizado.id).catch(() => []),
        solicitacaoService.getSolicitacoesByColaborador(colaboradorAtualizado.id).catch(() => []),
        logAuditoriaService
          .getLogsPorEntidade('colaborador', colaboradorAtualizado.id)
          .catch(() => []),
        historicoFuncaoService
          .getHistoricoPorColaborador(colaboradorAtualizado.id, false)
          .catch(() => []),
      ]).then(([depList, contatosList, solicList, logsList, funcList]) => {
        setDependentes(depList)
        setContatosEmergencia(contatosList)
        setSolicitacoes(solicList)
        setHistoricoAuditoria(logsList)
        setHistoricoFuncoes(funcList)
      })
    }
  }

  // Não renderizar se o modal estiver fechado
  if (!open) return null

  // Usar dadosExibicao como fonte segura para exibição
  const colab = dadosExibicao

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] p-0 flex flex-col bg-[#F5F5F5] border border-[#E0E0E0] shadow-2xl overflow-hidden">
        {!colab ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-[#212121]">
              Ficha não encontrada ou desvinculada
            </p>
            <p className="text-xs text-[#757575]">
              Não foi possível localizar os dados deste colaborador.
            </p>
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs mt-2">
              Fechar
            </Button>
          </div>
        ) : (
          <>
            {/* Header Superior da Ficha */}
            <div className="relative bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1E88E5] text-white px-6 py-5 shrink-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-full border-2 border-white/50 shadow-md ring-2 ring-white/20 bg-[#1E88E5]">
                    {Boolean(colab?.foto || colab?.foto_url) && (
                      <AvatarImage
                        src={colab?.foto ? pb.files.getURL(colab, colab.foto) : colab?.foto_url}
                        alt={nomeExibicao}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="text-xl font-bold bg-[#0D47A1] text-white">
                      {iniciais}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight text-white leading-tight">
                        {nomeExibicao}
                      </h2>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          colab?.status === 'ativo'
                            ? 'bg-emerald-500/20 text-emerald-100 border-emerald-300/40'
                            : 'bg-rose-500/20 text-rose-100 border-rose-300/40'
                        }`}
                      >
                        {colab?.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-white/15 text-white border-white/25 text-[10px] font-semibold"
                      >
                        Ficha RH
                      </Badge>
                    </div>

                    <p className="text-xs text-white/90 font-medium">
                      {colab?.cargo || 'Cargo não informado'} • {colab?.departamento || 'Setor'}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-white/80">
                      <span className="font-mono">CPF: {colab?.cpf || 'Não informado'}</span>
                      <span>•</span>
                      <span>Admissão: {formatarDataBR(colab?.data_admissao)}</span>
                      <span>•</span>
                      <span>Tempo na Empresa: {tempoEmpresa}</span>
                      {tempoNoCargoAtual !== tempoEmpresa && (
                        <>
                          <span>•</span>
                          <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white">
                            No Cargo Atual: {tempoNoCargoAtual}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações e Selo de auditoria ativo */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                  {podeEditarPerfilColaborador && (
                    <Button
                      type="button"
                      onClick={() => setModalEdicaoOpen(true)}
                      className="bg-white hover:bg-white/90 text-[#0D47A1] font-bold text-xs h-9 px-4 gap-2 shadow-sm border border-white/40"
                    >
                      <Edit3 className="h-4 w-4 text-[#0D47A1]" />
                      Editar Perfil
                    </Button>
                  )}

                  <div className="hidden lg:flex flex-col items-end gap-1 bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-white/20 text-[11px] text-white/90">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-200">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Auditoria Ativa</span>
                    </div>
                    <span className="text-[10px] text-white/70">
                      Acesso registrado em log_auditoria
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Abas de Navegação (10 abas) */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col min-h-0 bg-[#F5F5F5]"
            >
              <div className="bg-white border-b border-[#E0E0E0] px-4 pt-2 shrink-0 overflow-x-auto scrollbar-thin">
                <TabsList className="bg-transparent h-10 p-0 flex gap-1 justify-start min-w-max">
                  <TabsTrigger
                    value="perfil"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
                  >
                    <User className="h-3.5 w-3.5" />
                    1. Perfil
                  </TabsTrigger>
                  <TabsTrigger
                    value="funcoes"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    2. Funções
                  </TabsTrigger>
                  <TabsTrigger
                    value="ausencias"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
                  >
                    <CalendarOff className="h-3.5 w-3.5" />
                    3. Ausências
                  </TabsTrigger>
                  <TabsTrigger
                    value="contratos"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    4. Contratos
                  </TabsTrigger>
                  <TabsTrigger
                    value="salarios"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    5. Salários
                  </TabsTrigger>
                  <TabsTrigger
                    value="organizacoes"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    6. Organizações
                  </TabsTrigger>
                  <TabsTrigger
                    value="historico"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
                  >
                    <History className="h-3.5 w-3.5" />
                    7. Histórico
                    {solicitacoes.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 bg-[#E8EEF7] text-[#0D47A1] rounded-full text-[10px] font-bold">
                        {solicitacoes.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="avaliacoes"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
                  >
                    <Award className="h-3.5 w-3.5" />
                    8. Avaliações
                  </TabsTrigger>
                  <TabsTrigger
                    value="demonstrativo"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    9. Demonstrativo
                  </TabsTrigger>
                  <TabsTrigger
                    value="treinamentos"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    10. Treinamentos
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Conteúdo das Abas com scroll independente */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* ABA 1: PERFIL */}
                <TabsContent value="perfil" className="m-0 space-y-6">
                  {/* Informações Pessoais */}
                  <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                    <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-[#0D47A1]" />
                        <CardTitle className="text-sm font-bold text-[#212121]">
                          Dados Pessoais e Civis
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs text-[#757575]">
                        Documentação civil, contato e endereço cadastrados na empresa
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            Nome Completo
                          </span>
                          <span className="text-[#212121] font-medium text-sm">
                            {colab?.nome_completo || colab?.nome || 'Não informado'}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            CPF
                          </span>
                          <span className="font-mono text-[#212121] font-medium text-sm">
                            {colab?.cpf || 'Não informado'}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            RG
                          </span>
                          <span className="text-[#212121] font-medium">
                            {colab?.rg || 'Não informado'}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            Data de Nascimento
                          </span>
                          <span className="text-[#212121] font-medium">
                            {formatarDataBR(colab?.data_nascimento)}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            Estado Civil
                          </span>
                          <span className="text-[#212121] font-medium">
                            {colab?.estado_civil || 'Não informado'}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            Telefone / Celular
                          </span>
                          <span className="text-[#212121] font-medium">
                            {colab?.telefone || 'Não informado'}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            E-mail
                          </span>
                          <span className="text-[#212121] font-medium">
                            {colab?.email || 'Não informado'}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            Chave PIX
                          </span>
                          <span className="text-[#212121] font-medium">
                            {colab?.pix || 'Não informado'}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            Raça / Cor
                          </span>
                          <span className="text-[#212121] font-medium">
                            {colab?.raca_cor || 'Não informado'}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            Sexo
                          </span>
                          <span className="text-[#212121] font-medium">
                            {colab?.sexo || 'Não informado'}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            Deficiência (PCD)
                          </span>
                          <span className="text-[#212121] font-medium">
                            {colab?.deficiencia || 'Nenhuma'}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            CNH / Título / Reservista
                          </span>
                          <span className="text-[#212121] font-medium">
                            {colab?.cnh || colab?.titulo_eleitor
                              ? `${colab?.cnh || '—'} / ${colab?.titulo_eleitor || '—'}`
                              : 'Não informado'}
                          </span>
                        </div>

                        <div className="sm:col-span-2">
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            Filiação (Pai e Mãe)
                          </span>
                          <span className="text-[#212121] font-medium">
                            Mãe: {colab?.nome_mae || 'Não informado'} • Pai:{' '}
                            {colab?.nome_pai || 'Não informado'}
                          </span>
                        </div>

                        <div className="sm:col-span-2 lg:col-span-3 border-t border-[#F5F5F5] pt-3">
                          <span className="font-semibold text-[#757575] block uppercase text-[10px]">
                            Endereço Residencial Completo
                          </span>
                          <span className="text-[#212121] font-medium">
                            {colab?.endereco || 'Não informado'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dados Bancários */}
                  <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                    <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-[#00897B]" />
                        <CardTitle className="text-sm font-bold text-[#212121]">
                          Dados Bancários Cadastrados
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="p-4 rounded-lg bg-[#FAFAFA] border border-[#E0E0E0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="text-[#757575] font-semibold uppercase text-[10px] block">
                            Conta Salário / Depósito
                          </span>
                          <p className="text-sm font-bold text-[#212121] font-mono mt-0.5">
                            {colab?.dados_bancarios || 'Nenhum dado bancário registrado'}
                          </p>
                          <p className="text-[#757575] text-[11px] mt-1">
                            PIX: <strong>{colab?.pix || 'Não informado'}</strong>
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px]"
                        >
                          Validada para Folha
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dependentes e Contatos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Dependentes */}
                    <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                      <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-[#8E24AA]" />
                            <CardTitle className="text-sm font-bold text-[#212121]">
                              Dependentes ({dependentes.length})
                            </CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-2.5">
                        {loadingDados ? (
                          <Skeleton className="h-16 w-full bg-slate-100" />
                        ) : dependentes.length === 0 ? (
                          <p className="text-xs text-[#757575] text-center py-4">
                            Nenhum dependente cadastrado.
                          </p>
                        ) : (
                          dependentes.map((dep) => (
                            <div
                              key={dep.id}
                              className="p-2.5 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-semibold text-[#212121]">{dep.nome}</p>
                                <p className="text-[#757575] text-[11px]">
                                  {dep.parentesco}
                                  {dep.data_nascimento &&
                                    ` • Nasc: ${formatarDataBR(dep.data_nascimento)}`}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]"
                              >
                                Plano Ativo
                              </Badge>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {/* Contatos de Emergência */}
                    <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                      <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PhoneCall className="h-4 w-4 text-[#E53935]" />
                            <CardTitle className="text-sm font-bold text-[#212121]">
                              Contatos de Emergência ({contatosEmergencia.length})
                            </CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-2.5">
                        {loadingDados ? (
                          <Skeleton className="h-16 w-full bg-slate-100" />
                        ) : contatosEmergencia.length === 0 ? (
                          <p className="text-xs text-[#757575] text-center py-4">
                            Nenhum contato de emergência cadastrado.
                          </p>
                        ) : (
                          contatosEmergencia.map((contato) => (
                            <div
                              key={contato.id}
                              className="p-2.5 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-semibold text-[#212121]">{contato.nome}</p>
                                <p className="text-[#757575] text-[11px] font-mono">
                                  {contato.parentesco} • {contato.telefone}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-[#0D47A1] border-blue-200 text-[10px]"
                              >
                                Prioritário
                              </Badge>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* ABA 2: FUNÇÕES */}
                <TabsContent value="funcoes" className="m-0 space-y-6">
                  <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                    <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-[#0D47A1]" />
                        <CardTitle className="text-sm font-bold text-[#212121]">
                          Cargo Atual e Atribuições
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs text-[#757575]">
                        Detalhes do enquadramento funcional e tempo no cargo
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#FAFAFA] border border-[#E0E0E0] text-xs">
                        <div>
                          <span className="text-[#757575] font-semibold uppercase text-[10px] block">
                            Cargo Vigente
                          </span>
                          <p className="text-sm font-bold text-[#0D47A1] mt-0.5">
                            {colab?.cargo || 'Não informado'}
                          </p>
                        </div>

                        <div>
                          <span className="text-[#757575] font-semibold uppercase text-[10px] block">
                            Departamento / Lotação
                          </span>
                          <p className="text-sm font-bold text-[#212121] mt-0.5">
                            {colab?.departamento || 'Não informado'}
                          </p>
                        </div>

                        <div>
                          <span className="text-[#757575] font-semibold uppercase text-[10px] block">
                            Tempo no Cargo Atual
                          </span>
                          <p className="text-sm font-bold text-[#212121] mt-0.5">
                            {tempoNoCargoAtual}
                          </p>
                          {funcaoVigente?.data_inicio && (
                            <span className="text-[10px] text-[#757575] block mt-0.5">
                              Início da função: {formatarDataBR(funcaoVigente.data_inicio)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Linha do tempo de funções na empresa */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[#212121] uppercase tracking-wide">
                            Histórico de Funções na Empresa
                          </h4>
                          {historicoFuncoes.length > 0 && (
                            <span className="text-[11px] text-[#757575]">
                              {historicoFuncoes.length}{' '}
                              {historicoFuncoes.length === 1
                                ? 'função registrada'
                                : 'funções registradas'}
                            </span>
                          )}
                        </div>

                        {/* Se houver histórico persistido, renderizar todas as etapas em ordem cronológica reversa (mais recente no topo) */}
                        {historicoFuncoes.length > 0 ? (
                          <div className="relative border-l-2 border-[#0D47A1] ml-3 pl-4 space-y-5 text-xs">
                            {[...historicoFuncoes]
                              .sort(
                                (a, b) =>
                                  new Date(b.data_inicio).getTime() -
                                  new Date(a.data_inicio).getTime(),
                              )
                              .map((item, idx) => {
                                const isVigente = !item.data_fim
                                const tempoNestaEtapa = calcularTempoEmpresa(
                                  item.data_inicio,
                                  item.data_fim || undefined,
                                )

                                return (
                                  <div key={item.id || idx} className="relative group">
                                    <span
                                      className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
                                        isVigente ? 'bg-[#0D47A1]' : 'bg-slate-400'
                                      }`}
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-bold text-[#212121] text-xs">
                                        {item.cargo}
                                      </p>
                                      {isVigente ? (
                                        <Badge
                                          variant="outline"
                                          className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] shrink-0"
                                        >
                                          Posição Atual
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="bg-slate-50 text-slate-700 border-slate-200 text-[10px] shrink-0"
                                        >
                                          {item.origem === 'promocao'
                                            ? 'Promoção'
                                            : item.origem === 'transferencia'
                                              ? 'Transferência'
                                              : 'Etapa Concluída'}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="mt-0.5 space-y-0.5 text-[#616161]">
                                      <p className="text-[11px]">
                                        <strong className="text-[#424242]">Departamento:</strong>{' '}
                                        {item.departamento ||
                                          colab?.departamento ||
                                          'Não informado'}
                                        {' • '}
                                        {isVigente ? (
                                          <span>Desde {formatarDataBR(item.data_inicio)}</span>
                                        ) : (
                                          <span>
                                            {formatarDataBR(item.data_inicio)} até{' '}
                                            {formatarDataBR(item.data_fim)}
                                          </span>
                                        )}
                                      </p>

                                      <p className="text-[10px] text-[#757575]">
                                        Tempo nesta função: <strong>{tempoNestaEtapa}</strong>
                                        {item.motivo && ` • Motivo: ${item.motivo}`}
                                      </p>
                                    </div>
                                  </div>
                                )
                              })}

                            {/* Nó fixo da Admissão e Integração na base */}
                            <div className="relative opacity-80 pt-1">
                              <span className="absolute -left-[23px] top-2 h-3 w-3 rounded-full bg-slate-300 ring-4 ring-white" />
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-[#212121]">
                                  Admissão e Integração
                                </p>
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-[#0D47A1] border-blue-200 text-[10px]"
                                >
                                  Ingresso
                                </Badge>
                              </div>
                              <p className="text-[#757575] text-[11px] mt-0.5">
                                Contratação inicial registrada em{' '}
                                {formatarDataBR(colab?.data_admissao)} • Tempo total na empresa:{' '}
                                <strong>{tempoEmpresa}</strong>
                              </p>
                            </div>
                          </div>
                        ) : (
                          /* Fallback padrão quando o colaborador ainda não tem histórico persistido */
                          <div className="relative border-l-2 border-[#0D47A1] ml-3 pl-4 space-y-4 text-xs">
                            <div className="relative">
                              <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-[#0D47A1] ring-4 ring-white" />
                              <div className="flex items-center justify-between">
                                <p className="font-bold text-[#212121]">
                                  {colab?.cargo || 'Cargo atual'}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]"
                                >
                                  Posição Atual
                                </Badge>
                              </div>
                              <p className="text-[#757575] text-[11px]">
                                Departamento: {colab?.departamento || 'Setor'} • Desde{' '}
                                {formatarDataBR(colab?.data_admissao)}
                              </p>
                              <p className="text-[10px] text-[#757575] mt-0.5">
                                Tempo na função: <strong>{tempoEmpresa}</strong>
                              </p>
                            </div>

                            <div className="relative opacity-70">
                              <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-slate-300 ring-4 ring-white" />
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-[#212121]">
                                  Admissão e Integração
                                </p>
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-[#0D47A1] border-blue-200 text-[10px]"
                                >
                                  Ingresso
                                </Badge>
                              </div>
                              <p className="text-[#757575] text-[11px] mt-0.5">
                                Contratação inicial registrada em{' '}
                                {formatarDataBR(colab?.data_admissao)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ABA 3: AUSÊNCIAS (Placeholder) */}
                <TabsContent value="ausencias" className="m-0">
                  <TabPlaceholder
                    title="Gestão de Ausências e Afastamentos"
                    description="Controle de férias programadas, atestados médicos, licenças maternidade/paternidade e faltas justificadas do colaborador."
                    icon={CalendarOff}
                  />
                </TabsContent>

                {/* ABA 4: CONTRATOS (Placeholder) */}
                <TabsContent value="contratos" className="m-0">
                  <TabPlaceholder
                    title="Contratos e Termos Aditivos"
                    description="Gestão de contratos de trabalho (CLT, PJ, Estágio), termos de confidencialidade, anexos e assinaturas eletrônicas."
                    icon={FileCheck}
                  />
                </TabsContent>

                {/* ABA 5: SALÁRIOS (Placeholder) */}
                <TabsContent value="salarios" className="m-0">
                  <TabPlaceholder
                    title="Composição Salarial e Remuneração"
                    description="Histórico de reajustes, dissídio, promoções, adicionais de insalubridade/periculosidade e plano de cargos & salários."
                    icon={DollarSign}
                  />
                </TabsContent>

                {/* ABA 6: ORGANIZAÇÕES */}
                <TabsContent value="organizacoes" className="m-0 space-y-6">
                  <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                    <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-[#0D47A1]" />
                        <CardTitle className="text-sm font-bold text-[#212121]">
                          Estrutura Organizacional e Local de Trabalho
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs text-[#757575]">
                        Lotação física, filial e regime de trabalho
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] space-y-1">
                          <span className="text-[#757575] font-semibold uppercase text-[10px] block">
                            Departamento Principal
                          </span>
                          <p className="text-base font-bold text-[#212121]">
                            {colab?.departamento || 'Não atribuído'}
                          </p>
                          <p className="text-[#757575] text-[11px]">
                            Centro de Custo Corporativo • Unidade Principal
                          </p>
                        </div>

                        <div className="p-4 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] space-y-1">
                          <span className="text-[#757575] font-semibold uppercase text-[10px] block">
                            Local de Trabalho
                          </span>
                          <p className="text-base font-bold text-[#212121]">
                            {colab?.local_trabalho || 'Escritório Central'}
                          </p>
                          <p className="text-[#757575] text-[11px]">
                            Regime de Jornada: {colab?.jornada || '44h semanais'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3.5 flex items-start gap-3">
                        <Info className="h-4 w-4 text-[#0D47A1] shrink-0 mt-0.5" />
                        <p className="text-[11px] text-[#0D47A1] leading-relaxed">
                          Mudanças de departamento ou filial refletem diretamente na estrutura
                          organizacional do tenant e nos relatórios de folha.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ABA 7: HISTÓRICO (solicitacao_alteracao e auditoria) */}
                <TabsContent value="historico" className="m-0 space-y-6">
                  {/* Solicitações de alteração do colaborador */}
                  <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                    <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-[#0D47A1]" />
                          <CardTitle className="text-sm font-bold text-[#212121]">
                            Registro de Alterações Solicitadas
                          </CardTitle>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/20 text-xs"
                        >
                          {solicitacoes.length} solicitações
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-[#757575]">
                        Dados lidos diretamente da tabela <code>solicitacao_alteracao</code> deste
                        colaborador
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {loadingDados ? (
                        <Skeleton className="h-24 w-full bg-slate-100" />
                      ) : solicitacoes.length === 0 ? (
                        <div className="text-center py-8 text-xs text-[#757575]">
                          Nenhuma solicitação de alteração registrada para este colaborador.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-[#E0E0E0] text-[#757575] font-semibold uppercase text-[10px]">
                                <th className="pb-2.5 pl-2">Data Solicitação</th>
                                <th className="pb-2.5">Campo</th>
                                <th className="pb-2.5">Valor Anterior</th>
                                <th className="pb-2.5">Novo Valor</th>
                                <th className="pb-2.5 text-center">Status</th>
                                <th className="pb-2.5">Data Resposta</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F5F5F5]">
                              {solicitacoes.map((item) => (
                                <tr key={item.id} className="hover:bg-[#FAFAFA] transition-colors">
                                  <td className="py-2.5 pl-2 font-medium text-[#212121] whitespace-nowrap">
                                    {formatarDataBR(item.data_solicitacao || item.created)}
                                  </td>
                                  <td className="py-2.5 font-bold text-[#0D47A1] whitespace-nowrap">
                                    {item.campo}
                                  </td>
                                  <td className="py-2.5 text-[#757575] max-w-[180px] truncate">
                                    {item.valor_antigo || '—'}
                                  </td>
                                  <td className="py-2.5 font-medium text-[#212121] max-w-[200px] truncate">
                                    {item.valor_novo}
                                  </td>
                                  <td className="py-2.5 text-center whitespace-nowrap">
                                    {item.status === 'pendente' && (
                                      <Badge
                                        variant="outline"
                                        className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]"
                                      >
                                        <Clock3 className="h-3 w-3 mr-1" />
                                        Pendente RH
                                      </Badge>
                                    )}
                                    {item.status === 'aprovada' && (
                                      <Badge
                                        variant="outline"
                                        className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]"
                                      >
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Aprovada
                                      </Badge>
                                    )}
                                    {item.status === 'rejeitada' && (
                                      <Badge
                                        variant="outline"
                                        className="bg-rose-50 text-rose-700 border-rose-300 text-[10px]"
                                      >
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Rejeitada
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="py-2.5 text-[#757575] text-[11px] whitespace-nowrap">
                                    {item.data_resposta ? formatarDataBR(item.data_resposta) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Registro de Auditoria de Acessos a esta Ficha */}
                  <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                    <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          <CardTitle className="text-sm font-bold text-[#212121]">
                            Logs de Auditoria de Acesso (log_auditoria)
                          </CardTitle>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs"
                        >
                          {historicoAuditoria.length} visualizações
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-[#757575]">
                        Histórico de acessos registrados quando usuários RH ou administradores abrem
                        esta ficha
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {historicoAuditoria.length === 0 ? (
                        <p className="text-xs text-[#757575] text-center py-4">
                          Nenhum registro de auditoria anterior localizado.
                        </p>
                      ) : (
                        <div className="space-y-2 text-xs">
                          {historicoAuditoria.slice(0, 8).map((log) => {
                            const json = (log.dados_json || {}) as Record<string, unknown>
                            const userNome =
                              (json.usuario_nome as string) ||
                              log.expand?.user_id?.name ||
                              'Usuário RH'
                            const userPerfil = (json.usuario_perfil as string) || 'rh'

                            return (
                              <div
                                key={log.id}
                                className="p-2.5 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2">
                                  <Shield className="h-3.5 w-3.5 text-[#0D47A1]" />
                                  <div>
                                    <p className="font-semibold text-[#212121]">
                                      {userNome}{' '}
                                      <span className="text-[#757575] font-normal">
                                        ({userPerfil})
                                      </span>
                                    </p>
                                    <p className="text-[#757575] text-[10px]">
                                      Ação: <code>{log.acao}</code>
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[#757575] text-[11px] font-mono">
                                  {formatarDataHoraBR(log.data_hora || log.created)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ABA 8: AVALIAÇÕES (Integração com o Módulo de Avaliação) */}
                <TabsContent value="avaliacoes" className="m-0 space-y-4">
                  <Card className="border border-[#E0E0E0] bg-white shadow-xs p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8EEF7] text-[#0D47A1] mb-3">
                      <Award className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-bold text-[#212121]">
                      Módulo de Avaliação de Desempenho
                    </h3>
                    <p className="text-xs text-[#757575] max-w-md mx-auto mt-1 mb-4">
                      Consulte os ciclos avaliativos, feedbacks de gestores, notas por competência e
                      deltas de performance no módulo completo de Avaliação.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        onClick={() => {
                          onClose()
                          window.location.href = '/avaliacoes'
                        }}
                        className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-9 px-4 gap-2"
                      >
                        <Award className="h-4 w-4" />
                        Abrir Minhas Avaliações
                      </Button>
                      {(user?.perfil === 'rh' || user?.perfil === 'admin') && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            onClose()
                            window.location.href = '/avaliacoes/admin'
                          }}
                          className="border-[#E0E0E0] text-[#0D47A1] text-xs font-semibold h-9 px-4 gap-2"
                        >
                          Painel Admin do Ciclo
                        </Button>
                      )}
                    </div>
                  </Card>
                </TabsContent>

                {/* ABA 9: DEMONSTRATIVO (Implementado com Seletor Mês/Ano e Cards de Resumo) */}
                <TabsContent value="demonstrativo" className="m-0 space-y-4">
                  <DemonstrativoFinanceiroView
                    tenantId={colab.tenant_id}
                    colaboradorId={colab.id}
                    colaborador={colab}
                    canManage={false}
                  />
                </TabsContent>

                {/* ABA 10: TREINAMENTOS (Placeholder) */}
                <TabsContent value="treinamentos" className="m-0">
                  <TabPlaceholder
                    title="Trilhas de Aprendizagem e Treinamentos"
                    description="Certificações obrigatórias de segurança (NRs), cursos internos, desenvolvimento de liderança e histórico de capacitação técnica."
                    icon={GraduationCap}
                  />
                </TabsContent>
              </div>
            </Tabs>

            {/* Modal de Edição Completa do Perfil (Prompt 18) */}
            {modalEdicaoOpen && dadosExibicao && (
              <ModalEditarPerfilColaborador
                colaborador={dadosExibicao}
                open={modalEdicaoOpen}
                onClose={() => setModalEdicaoOpen(false)}
                onSaved={handleSalvoEdicao}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
