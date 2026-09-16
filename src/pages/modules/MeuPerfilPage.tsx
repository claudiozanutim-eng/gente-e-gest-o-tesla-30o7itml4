import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  User,
  Briefcase,
  CreditCard,
  Users,
  PhoneCall,
  Calendar,
  Clock,
  MapPin,
  Mail,
  Phone,
  Shield,
  FileText,
  Edit3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Building,
  HeartHandshake,
  Send,
  Loader2,
  Sparkles,
  Info,
  Clock3,
  XCircle,
  Camera,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  colaboradorService,
  dependenteService,
  contatoEmergenciaService,
  solicitacaoService,
  logAuditoriaService,
} from '@/services/api'
import {
  Colaborador,
  Dependente,
  ContatoEmergencia,
  SolicitacaoAlteracao,
  PROFILE_LABELS,
  PROFILE_BADGE_COLORS,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { TESLA_LOGO_URL } from '@/lib/logoAsset'

// Helper para calcular tempo de empresa em anos e meses
function calcularTempoEmpresa(dataAdmissaoStr?: string): string {
  if (!dataAdmissaoStr) return 'Não informado'
  try {
    const inicio = new Date(dataAdmissaoStr)
    const agora = new Date()

    if (isNaN(inicio.getTime())) return 'Não informado'

    let anos = agora.getFullYear() - inicio.getFullYear()
    let meses = agora.getMonth() - inicio.getMonth()

    if (agora.getDate() < inicio.getDate()) {
      meses -= 1
    }

    if (meses < 0) {
      anos -= 1
      meses += 12
    }

    if (anos < 0) return 'Recém-admitido'

    if (anos === 0 && meses === 0) {
      const diffDias = Math.floor((agora.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
      return diffDias <= 1 ? 'Menos de 1 mês (admissão recente)' : `${diffDias} dias`
    }

    const partes: string[] = []
    if (anos > 0) {
      partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`)
    }
    if (meses > 0) {
      partes.push(`${meses} ${meses === 1 ? 'mês' : 'meses'}`)
    }

    return partes.join(' e ')
  } catch {
    return 'Não informado'
  }
}

// Helper para formatar data em pt-BR
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

// Helper para extrair iniciais do nome
function getIniciais(nome?: string): string {
  if (!nome) return 'CO'
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return 'CO'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export default function MeuPerfilPage() {
  const { user, colaborador: authColaborador, refreshProfile } = useAuth()
  const { toast } = useToast()

  const [colaborador, setColaborador] = useState<Colaborador | null>(authColaborador)
  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [contatosEmergencia, setContatosEmergencia] = useState<ContatoEmergencia[]>([])
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAlteracao[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [uploadingFoto, setUploadingFoto] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado do Modal de Solicitação de Alteração
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [editFieldKey, setEditFieldKey] = useState<string>('')
  const [editFieldLabel, setEditFieldLabel] = useState<string>('')
  const [editOldValue, setEditOldValue] = useState<string>('')
  const [editNewValue, setEditNewValue] = useState<string>('')
  const [editObservation, setEditObservation] = useState<string>('')

  // Para dados bancários, campos estruturados para facilitar edição
  const [bancoNome, setBancoNome] = useState<string>('')
  const [bancoAgencia, setBancoAgencia] = useState<string>('')
  const [bancoConta, setBancoConta] = useState<string>('')
  const [bancoTipo, setBancoTipo] = useState<string>('Conta Corrente')

  const perfil = user?.perfil || 'colaborador'
  const badgeStyle = PROFILE_BADGE_COLORS[perfil]

  // Manipular upload e atualização da foto de perfil
  const handleFotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Limpar o valor do input para permitir selecionar o mesmo arquivo novamente se necessário
    if (e.target) {
      e.target.value = ''
    }
    if (!file) return

    // Limite de 5 MB
    const maxSizeBytes = 5 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      toast({
        title: 'Arquivo muito grande',
        description: 'Selecione uma imagem PNG ou JPEG com no máximo 5 MB.',
        variant: 'destructive',
      })
      return
    }

    // Formatos válidos: PNG, JPEG
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Formato inválido',
        description: 'Envie um arquivo de imagem nos formatos PNG ou JPEG.',
        variant: 'destructive',
      })
      return
    }

    if (!colaborador?.id) {
      toast({
        title: 'Colaborador não identificado',
        description: 'Não foi possível identificar seu cadastro de colaborador.',
        variant: 'destructive',
      })
      return
    }

    try {
      setUploadingFoto(true)

      // Fazer upload do arquivo de imagem diretamente para a coleção colaborador
      const updated = await colaboradorService.uploadFotoArquivo(colaborador.id, file)

      // Atualizar estado local imediatamente para preview em tempo real com a nova URL
      const novaFotoUrl =
        updated.foto_url ||
        (updated.foto ? `/api/files/colaborador/${updated.id}/${updated.foto}` : '')
      setColaborador((prev) => (prev ? { ...prev, ...updated, foto_url: novaFotoUrl } : updated))

      // Atualizar contexto global de autenticação (refletir em Header, Dropdowns, etc.)
      await refreshProfile().catch((err) => {
        console.warn('Falha ao atualizar contexto de autenticação:', err)
      })

      // Auditoria da ação
      if (user?.tenant_id && user?.id) {
        await logAuditoriaService
          .registrarLog({
            tenant_id: user.tenant_id,
            user_id: user.id,
            acao: `Foto de perfil atualizada por ${user.name || colaborador.nome}`,
            entidade: 'colaborador',
            entidade_id: colaborador.id,
            dados_json: {
              tipo_acao: 'atualizacao_foto_perfil',
              origem: 'meu_perfil',
              nome_arquivo: file.name,
              tamanho_bytes: file.size,
              tipo_mime: file.type,
              foto_arquivo: updated.foto,
              foto_url: novaFotoUrl,
            },
          })
          .catch((e) => console.warn('Erro ao registrar log de auditoria da foto:', e))
      }

      toast({
        title: 'Foto atualizada com sucesso',
        description: 'Sua foto de perfil foi alterada com sucesso.',
      })
    } catch (uploadErr) {
      console.error('Erro ao salvar foto de perfil:', uploadErr)
      toast({
        title: 'Erro ao salvar foto',
        description: 'Ocorreu um erro ao salvar sua nova foto de perfil. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setUploadingFoto(false)
    }
  }

  // Carregar dados completos do colaborador
  const carregarDados = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      // Buscar colaborador atual pelo ID do usuário autenticado
      let colabRecord = await colaboradorService.getColaboradorByUserId(user.id)

      // Fallback: se não achar por user_id, buscar pelo authColaborador se existir
      if (!colabRecord && authColaborador?.id) {
        colabRecord = await colaboradorService.getColaboradorById(authColaborador.id)
      }

      if (colabRecord) {
        setColaborador(colabRecord)

        // Buscar dependentes, contatos e solicitações em paralelo
        const [depList, contatosList, solicList] = await Promise.all([
          dependenteService.getDependentesByColaborador(colabRecord.id).catch(() => []),
          contatoEmergenciaService.getContatosByColaborador(colabRecord.id).catch(() => []),
          solicitacaoService.getSolicitacoesByColaborador(colabRecord.id).catch(() => []),
        ])

        setDependentes(depList)
        setContatosEmergencia(contatosList)
        setSolicitacoes(solicList)
      }
    } catch (err) {
      console.error('Erro ao carregar dados do perfil:', err)
      toast({
        title: 'Erro ao carregar perfil',
        description: 'Não foi possível carregar as informações do seu perfil.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user, authColaborador?.id, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Abre modal para campo simples ou dados bancários
  const handleOpenEditModal = (
    campoKey: 'telefone' | 'endereco' | 'estado_civil' | 'pix' | 'dados_bancarios',
    label: string,
    valorAtual?: string,
  ) => {
    setEditFieldKey(campoKey)
    setEditFieldLabel(label)
    setEditOldValue(valorAtual || '')
    setEditObservation('')

    if (campoKey === 'dados_bancarios') {
      // Tentar pré-preencher a partir da string caso contenha padrão "Banco X | Agência: Y | Conta: Z"
      const raw = valorAtual || ''
      setEditNewValue(raw)
      const bancoMatch = raw.match(/^(.*?)\s*\|/i)
      const agenciaMatch = raw.match(/Agência:\s*([^|]+)/i)
      const contaMatch = raw.match(/Conta[^:]*:\s*([^|]+)/i)

      setBancoNome(bancoMatch ? bancoMatch[1].trim() : '')
      setBancoAgencia(agenciaMatch ? agenciaMatch[1].trim() : '')
      setBancoConta(contaMatch ? contaMatch[1].trim() : '')
      setBancoTipo(raw.toLowerCase().includes('poupança') ? 'Conta Poupança' : 'Conta Corrente')
    } else {
      setEditNewValue(valorAtual || '')
    }

    setModalOpen(true)
  }

  // Enviar solicitação ao RH
  const handleSubmitSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!colaborador || !user?.tenant_id) {
      toast({
        title: 'Erro ao enviar',
        description: 'Registro de colaborador não localizado.',
        variant: 'destructive',
      })
      return
    }

    let finalNewValue = editNewValue.trim()

    if (editFieldKey === 'dados_bancarios') {
      if (!bancoNome.trim() || !bancoAgencia.trim() || !bancoConta.trim()) {
        toast({
          title: 'Dados incompletos',
          description: 'Por favor, informe Banco, Agência e Conta.',
          variant: 'destructive',
        })
        return
      }
      finalNewValue = `${bancoNome.trim()} | Agência: ${bancoAgencia.trim()} | ${bancoTipo}: ${bancoConta.trim()}`
    }

    if (!finalNewValue) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o novo valor desejado para a solicitação.',
        variant: 'destructive',
      })
      return
    }

    if (finalNewValue === editOldValue.trim()) {
      toast({
        title: 'Valor idêntico',
        description: 'O novo valor deve ser diferente do valor cadastrado atualmente.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        colaborador_id: colaborador.id,
        tenant_id: user.tenant_id,
        campo: editFieldLabel,
        valor_antigo: editOldValue || 'Não informado',
        valor_novo: editObservation
          ? `${finalNewValue} (Obs: ${editObservation.trim()})`
          : finalNewValue,
      }

      const novaSolicitacao = await solicitacaoService.createSolicitacao(payload)

      // Atualiza lista local de solicitações
      setSolicitacoes((prev) => [novaSolicitacao, ...prev])

      toast({
        title: 'Solicitação enviada ao RH',
        description: `Seu pedido de alteração de "${editFieldLabel}" foi registrado e está com status pendente de aprovação.`,
      })

      setModalOpen(false)
    } catch (err) {
      console.error('Erro ao enviar solicitação:', err)
      toast({
        title: 'Falha ao registrar solicitação',
        description: 'Ocorreu um erro ao enviar sua solicitação para o RH. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Verifica se há solicitação pendente para um determinado campo
  const getSolicitacaoPendente = (campoLabel: string) => {
    return solicitacoes.find(
      (s) => s.campo.toLowerCase() === campoLabel.toLowerCase() && s.status === 'pendente',
    )
  }

  const tempoEmpresa = useMemo(() => {
    return calcularTempoEmpresa(colaborador?.data_admissao)
  }, [colaborador?.data_admissao])

  const nomeExibicao =
    colaborador?.nome_completo || colaborador?.nome || user?.name || 'Colaborador'
  const iniciais = getIniciais(nomeExibicao)

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header do Perfil com Avatar circular, Iniciais se sem foto, Cargo, Matrícula e Badges */}
      <div className="relative overflow-hidden rounded-2xl border border-[#0D47A1]/20 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1E88E5] p-6 md:p-8 text-white shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Logo institucional circular da Tesla com borda sutil */}
          <div className="hidden lg:flex flex-col items-center justify-center shrink-0 mr-1 self-center">
            <div className="h-20 w-20 rounded-full border-2 border-white/40 shadow-md p-1 bg-white ring-4 ring-white/20 flex items-center justify-center">
              <img
                src={TESLA_LOGO_URL}
                alt="Logo Tesla Mecatrônica"
                className="h-full w-full rounded-full object-cover"
              />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-white/80 mt-1.5">
              Tesla HR
            </span>
          </div>

          {/* Avatar circular com botão de alteração de foto */}
          <div className="relative group">
            {/* Input de arquivo invisível */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleFotoFileSelect}
              disabled={uploadingFoto}
              aria-label="Upload de foto de perfil"
            />

            <Avatar className="h-28 w-28 md:h-32 md:w-32 rounded-full border-4 border-white/30 shadow-lg ring-4 ring-white/10 bg-[#1E88E5]">
              {colaborador?.foto_url && (
                <AvatarImage
                  src={colaborador.foto_url}
                  alt={nomeExibicao}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="text-3xl font-extrabold bg-[#0D47A1] text-white">
                {iniciais}
              </AvatarFallback>
            </Avatar>

            {/* Overlay sutil durante upload */}
            {uploadingFoto && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-[2px] z-20">
                <Loader2 className="h-6 w-6 animate-spin text-white mb-1" />
                <span className="text-[10px] font-semibold">Salvando...</span>
              </div>
            )}

            {/* Botão de alterar foto com tooltip */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFoto}
                  className="absolute bottom-0 right-0 h-9 w-9 md:h-10 md:w-10 rounded-full bg-white text-[#0D47A1] hover:bg-blue-50 active:scale-95 shadow-md border-2 border-[#0D47A1] flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-[#0D47A1] focus:ring-offset-2 z-10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Alterar foto de perfil"
                >
                  <Camera className="h-4 w-4 md:h-5 md:w-5 text-[#0D47A1]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs bg-slate-900 text-white font-medium">
                Alterar foto
              </TooltipContent>
            </Tooltip>

            {/* Indicador de status (ativo/inativo) posicionado na parte superior direita */}
            <span
              className={`absolute top-1 right-1 h-4 w-4 rounded-full border-2 border-white shadow-xs ${
                colaborador?.status === 'inativo' ? 'bg-rose-500' : 'bg-emerald-400'
              }`}
              title={colaborador?.status === 'inativo' ? 'Inativo' : 'Ativo'}
            />
          </div>

          {/* Dados do Cabeçalho */}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-blue-200" />
                Meu Perfil Cadastral
              </span>
              <Badge
                variant="outline"
                className={`${badgeStyle.bg} ${badgeStyle.text} text-[11px] font-bold px-2.5 py-0.5 border-0`}
              >
                {PROFILE_LABELS[perfil]}
              </Badge>
              <Badge
                variant="outline"
                className="bg-emerald-500/20 text-emerald-100 border-emerald-300/40 text-[11px] font-semibold"
              >
                {colaborador?.status === 'inativo' ? 'Cadastro Inativo' : 'Colaborador Ativo'}
              </Badge>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              {nomeExibicao}
            </h1>

            <p className="text-base text-white/90 font-medium">
              {colaborador?.cargo || 'Cargo não informado'}
              {colaborador?.departamento && (
                <span className="text-white/75 font-normal">
                  {' '}
                  • Departamento de {colaborador.departamento}
                </span>
              )}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs text-white/80">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-blue-200" />
                <span>{colaborador?.email || user?.email || 'Sem e-mail cadastrado'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-blue-200" />
                <span>{colaborador?.local_trabalho || 'Escritório Central'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-200" />
                <span>Admissão: {formatarDataBR(colaborador?.data_admissao)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Solicitação Pendente existente (se houver) */}
      {solicitacoes.some((s) => s.status === 'pendente') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 shadow-xs flex items-start gap-3">
          <Clock3 className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-900">
              Você possui solicitações de alteração cadastral em análise pelo RH:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {solicitacoes
                .filter((s) => s.status === 'pendente')
                .map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className="bg-white border-amber-300 text-amber-900 font-medium text-[11px]"
                  >
                    {s.campo}: {s.valor_novo}
                  </Badge>
                ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border border-[#E0E0E0] p-6 space-y-4">
              <Skeleton className="h-6 w-1/3 bg-slate-100" />
              <Skeleton className="h-10 w-full bg-slate-100" />
              <Skeleton className="h-10 w-full bg-slate-100" />
              <Skeleton className="h-10 w-full bg-slate-100" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 2. Seção Dados Pessoais */}
          <Card className="border border-[#E0E0E0] shadow-xs bg-white">
            <CardHeader className="border-b border-[#F0F0F0] pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 text-[#0D47A1] flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-[#212121]">
                      Dados Pessoais
                    </CardTitle>
                    <CardDescription className="text-xs text-[#757575]">
                      Informações civis, identificação e contatos do colaborador
                    </CardDescription>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-[#757575] bg-[#F5F5F5] px-2.5 py-1 rounded-md">
                      <Info className="h-3.5 w-3.5 text-[#0D47A1]" />
                      <span>Campos com</span>
                      <Edit3 className="h-3 w-3 text-[#0D47A1]" />
                      <span>são editáveis via RH</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs max-w-xs">
                    Campos como CPF, RG e Nome são mantidos pelo RH para integridade do eSocial.
                    Telefone, Endereço, Estado Civil e PIX podem ser solicitados para alteração.
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-5 gap-x-6">
                {/* Nome Completo (Read-only) */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Nome Completo
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.nome_completo || colaborador?.nome || '—'}
                  </p>
                </div>

                {/* CPF (Read-only) */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    CPF
                  </span>
                  <p className="text-sm font-medium text-[#212121] font-mono">
                    {colaborador?.cpf || '—'}
                  </p>
                </div>

                {/* RG (Read-only) */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    RG
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.rg || 'Não informado'}
                  </p>
                </div>

                {/* Data de Nascimento (Read-only) */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Data de Nascimento
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    {formatarDataBR(colaborador?.data_nascimento)}
                  </p>
                </div>

                {/* Estado Civil (Editável) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      Estado Civil
                    </span>
                    {getSolicitacaoPendente('Estado Civil') ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] py-0"
                      >
                        Pendente RH
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleOpenEditModal(
                            'estado_civil',
                            'Estado Civil',
                            colaborador?.estado_civil,
                          )
                        }
                        className="h-6 px-2 text-[11px] text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50 font-semibold gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Solicitar Alteração
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.estado_civil || 'Não informado'}
                  </p>
                </div>

                {/* Telefone (Editável) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      Telefone / Celular
                    </span>
                    {getSolicitacaoPendente('Telefone') ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] py-0"
                      >
                        Pendente RH
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleOpenEditModal('telefone', 'Telefone', colaborador?.telefone)
                        }
                        className="h-6 px-2 text-[11px] text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50 font-semibold gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Solicitar Alteração
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.telefone || 'Não informado'}
                  </p>
                </div>

                {/* E-mail Corporativo (Read-only) */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    E-mail Corporativo
                  </span>
                  <p className="text-sm font-medium text-[#212121] break-all">
                    {colaborador?.email || user?.email || '—'}
                  </p>
                </div>

                {/* Chave PIX (Editável) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      Chave PIX
                    </span>
                    {getSolicitacaoPendente('Chave PIX') ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] py-0"
                      >
                        Pendente RH
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal('pix', 'Chave PIX', colaborador?.pix)}
                        className="h-6 px-2 text-[11px] text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50 font-semibold gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Solicitar Alteração
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.pix || 'Não informado'}
                  </p>
                </div>

                {/* Raça / Cor (Read-only) */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Raça / Cor
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.raca_cor || 'Não informado'}
                  </p>
                </div>

                {/* Sexo (Read-only) */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Sexo
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.sexo || 'Não informado'}
                  </p>
                </div>

                {/* Deficiência (PCD) (Read-only) */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Deficiência (PCD)
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.deficiencia || 'Nenhuma'}
                  </p>
                </div>

                {/* Documentos Complementares: Título Eleitor / CNH / Reservista */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    CNH / Título / Reservista
                  </span>
                  <p className="text-xs text-[#424242] leading-relaxed">
                    CNH: {colaborador?.cnh || '—'} <br />
                    Título: {colaborador?.titulo_eleitor || '—'} <br />
                    Reservista: {colaborador?.reservista || '—'}
                  </p>
                </div>

                {/* Filiação (Nome do Pai e Mãe) */}
                <div className="space-y-1 sm:col-span-2">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Filiação (Pai e Mãe)
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    Mãe: {colaborador?.nome_mae || 'Não informado'}
                    <br />
                    Pai: {colaborador?.nome_pai || 'Não informado'}
                  </p>
                </div>

                {/* Endereço Residencial Completo (Editável) */}
                <div className="space-y-1 sm:col-span-2 lg:col-span-3 border-t border-[#F5F5F5] pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#0D47A1]" />
                      Endereço Residencial
                    </span>
                    {getSolicitacaoPendente('Endereço') ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] py-0"
                      >
                        Pendente RH
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleOpenEditModal('endereco', 'Endereço', colaborador?.endereco)
                        }
                        className="h-6 px-2 text-[11px] text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50 font-semibold gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Solicitar Alteração
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.endereco || 'Não informado'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Seção Dados Profissionais */}
          <Card className="border border-[#E0E0E0] shadow-xs bg-white">
            <CardHeader className="border-b border-[#F0F0F0] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 text-[#3949AB] flex items-center justify-center">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-[#212121]">
                    Dados Profissionais
                  </CardTitle>
                  <CardDescription className="text-xs text-[#757575]">
                    Vínculo empregatício, lotação, jornada e tempo de casa
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-5 gap-x-6">
                {/* Cargo */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Cargo
                  </span>
                  <p className="text-sm font-bold text-[#212121]">
                    {colaborador?.cargo || 'Não informado'}
                  </p>
                </div>

                {/* Departamento */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Departamento / Área
                  </span>
                  <p className="text-sm font-bold text-[#212121]">
                    {colaborador?.departamento || 'Não informado'}
                  </p>
                </div>

                {/* Data de Admissão */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Data de Admissão
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    {formatarDataBR(colaborador?.data_admissao)}
                  </p>
                </div>

                {/* Tempo de Empresa Calculado */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Tempo de Empresa
                  </span>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E8EEF7] text-[#0D47A1] font-bold text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{tempoEmpresa}</span>
                  </div>
                </div>

                {/* Jornada de Trabalho */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Jornada de Trabalho
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.jornada || '44h semanais'}
                  </p>
                </div>

                {/* Local de Trabalho */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Local de Trabalho
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.local_trabalho || 'Escritório Central'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Seção Dados Bancários */}
          <Card className="border border-[#E0E0E0] shadow-xs bg-white">
            <CardHeader className="border-b border-[#F0F0F0] pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 text-[#00897B] flex items-center justify-center">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-[#212121]">
                      Dados Bancários
                    </CardTitle>
                    <CardDescription className="text-xs text-[#757575]">
                      Conta cadastrada para crédito salarial e benefícios
                    </CardDescription>
                  </div>
                </div>

                {getSolicitacaoPendente('Dados Bancários') ? (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-700 border-amber-300 text-xs py-1"
                  >
                    Alteração em Análise RH
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleOpenEditModal(
                        'dados_bancarios',
                        'Dados Bancários',
                        colaborador?.dados_bancarios,
                      )
                    }
                    className="border-[#0D47A1] text-[#0D47A1] hover:bg-blue-50 text-xs font-semibold gap-1.5 h-8"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Solicitar Alteração
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Conta Corrente / Salário
                  </span>
                  <p className="text-base font-bold text-[#212121] font-mono">
                    {colaborador?.dados_bancarios || 'Nenhum dado bancário cadastrado'}
                  </p>
                  <p className="text-xs text-[#757575]">
                    Chave PIX vinculada: <strong>{colaborador?.pix || 'Não cadastrada'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Conta validada para depósitos de folha e adiantamentos</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Dependentes e Contatos de Emergência (Grid 2 Colunas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dependentes */}
            <Card className="border border-[#E0E0E0] shadow-xs bg-white flex flex-col justify-between">
              <div>
                <CardHeader className="border-b border-[#F0F0F0] pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-purple-50 text-[#8E24AA] flex items-center justify-center">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-[#212121]">
                          Dependentes
                        </CardTitle>
                        <CardDescription className="text-xs text-[#757575]">
                          {dependentes.length}{' '}
                          {dependentes.length === 1
                            ? 'dependente cadastrado'
                            : 'dependentes cadastrados'}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-3">
                  {dependentes.length === 0 ? (
                    <div className="text-center py-6 text-[#757575] text-xs">
                      Nenhum dependente cadastrado no momento.
                    </div>
                  ) : (
                    dependentes.map((dep) => (
                      <div
                        key={dep.id}
                        className="rounded-lg border border-[#E0E0E0] p-3.5 bg-[#FAFAFA] flex items-center justify-between gap-3 hover:border-[#0D47A1]/30 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-[#212121]">{dep.nome}</p>
                          <div className="flex items-center gap-2 text-xs text-[#757575]">
                            <Badge
                              variant="outline"
                              className="bg-white border-[#E0E0E0] text-[10px] text-[#424242] font-semibold"
                            >
                              {dep.parentesco}
                            </Badge>
                            {dep.data_nascimento && (
                              <span>Nasc: {formatarDataBR(dep.data_nascimento)}</span>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Ativo no Plano
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </div>

              <div className="p-4 pt-0 text-[11px] text-[#757575] border-t border-[#F5F5F5] mt-4 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-[#0D47A1] shrink-0" />
                <span>Inclusão de dependentes pode ser solicitada via chamado ao RH.</span>
              </div>
            </Card>
            {/* Contatos de Emergência */}
            <Card className="border border-[#E0E0E0] shadow-xs bg-white flex flex-col justify-between">
              <div>
                <CardHeader className="border-b border-[#F0F0F0] pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-rose-50 text-[#E53935] flex items-center justify-center">
                        <PhoneCall className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-[#212121]">
                          Contatos de Emergência
                        </CardTitle>
                        <CardDescription className="text-xs text-[#757575]">
                          Pessoas de contato imediato para emergências médicas ou operacionais
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-3">
                  {contatosEmergencia.length === 0 ? (
                    <div className="text-center py-6 text-[#757575] text-xs">
                      Nenhum contato de emergência cadastrado.
                    </div>
                  ) : (
                    contatosEmergencia.map((contato) => (
                      <div
                        key={contato.id}
                        className="rounded-lg border border-[#E0E0E0] p-3.5 bg-[#FAFAFA] flex items-center justify-between gap-3 hover:border-[#0D47A1]/30 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-[#212121]">{contato.nome}</p>
                          <div className="flex items-center gap-2 text-xs text-[#757575]">
                            <Badge
                              variant="outline"
                              className="bg-white border-[#E0E0E0] text-[10px] text-[#424242] font-semibold"
                            >
                              {contato.parentesco}
                            </Badge>
                            <span className="flex items-center gap-1 font-mono text-[#212121]">
                              <Phone className="h-3 w-3 text-[#757575]" />
                              {contato.telefone}
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold text-[#0D47A1] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Principal
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </div>

              <div className="p-4 pt-0 text-[11px] text-[#757575] border-t border-[#F5F5F5] mt-4 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-[#0D47A1] shrink-0" />
                <span>Utilizado pela Segurança do Trabalho e Medicina Ocupacional.</span>
              </div>
            </Card>
          </div>

          {/* 6. Histórico de Solicitações do Colaborador */}
          <Card className="border border-[#E0E0E0] shadow-xs bg-white">
            <CardHeader className="border-b border-[#F0F0F0] pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 text-[#0D47A1] flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-[#212121]">
                      Minhas Solicitações de Alteração Cadastral
                    </CardTitle>
                    <CardDescription className="text-xs text-[#757575]">
                      Acompanhe o andamento dos seus pedidos enviados ao time de RH
                    </CardDescription>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/20 font-semibold text-xs"
                >
                  {solicitacoes.length} {solicitacoes.length === 1 ? 'registro' : 'registros'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-5">
              {solicitacoes.length === 0 ? (
                <div className="text-center py-8 text-[#757575] text-xs">
                  Você ainda não possui solicitações de alteração cadastradas.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E0E0E0] text-[#757575] font-semibold uppercase">
                        <th className="pb-3 pl-2">Data</th>
                        <th className="pb-3">Campo Solicitado</th>
                        <th className="pb-3">Valor Anterior</th>
                        <th className="pb-3">Novo Valor Solicitado</th>
                        <th className="pb-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F5]">
                      {solicitacoes.map((item) => (
                        <tr key={item.id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="py-3 pl-2 font-medium text-[#212121] whitespace-nowrap">
                            {formatarDataBR(item.data_solicitacao || item.created)}
                          </td>
                          <td className="py-3 font-bold text-[#0D47A1] whitespace-nowrap">
                            {item.campo}
                          </td>
                          <td className="py-3 text-[#757575] max-w-xs truncate">
                            {item.valor_antigo || '—'}
                          </td>
                          <td className="py-3 font-medium text-[#212121] max-w-xs truncate">
                            {item.valor_novo}
                          </td>
                          <td className="py-3 text-center whitespace-nowrap">
                            {item.status === 'pendente' && (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-300 font-semibold text-[10px]"
                              >
                                <Clock3 className="h-3 w-3 mr-1" />
                                Pendente RH
                              </Badge>
                            )}
                            {item.status === 'aprovada' && (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold text-[10px]"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Aprovada
                              </Badge>
                            )}
                            {item.status === 'rejeitada' && (
                              <Badge
                                variant="outline"
                                className="bg-rose-50 text-rose-700 border-rose-300 font-semibold text-[10px]"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Rejeitada
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 7. Modal de Solicitação de Alteração Cadastral */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md bg-white border border-[#E0E0E0] p-0 overflow-hidden">
          <div className="h-2 bg-[#0D47A1] w-full" />
          <form onSubmit={handleSubmitSolicitacao} className="p-6 space-y-4">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-[#0D47A1]" />
                <DialogTitle className="text-lg font-bold text-[#212121]">
                  Solicitar Alteração: {editFieldLabel}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-[#757575]">
                Seu pedido será direcionado ao RH para validação e atualização no sistema.
              </DialogDescription>
            </DialogHeader>

            {/* Valor Atual Cadastrado */}
            <div className="rounded-lg bg-[#F5F5F5] p-3 text-xs space-y-1 border border-[#E0E0E0]">
              <span className="font-semibold text-[#757575]">Valor atual em cadastro:</span>
              <p className="font-medium text-[#212121] break-all">
                {editOldValue || 'Nenhum valor cadastrado'}
              </p>
            </div>

            {/* Campos do Formulário conforme o tipo de dado */}
            {editFieldKey === 'estado_civil' ? (
              <div className="space-y-1.5">
                <Label htmlFor="estado_civil" className="text-xs font-semibold text-[#212121]">
                  Novo Estado Civil *
                </Label>
                <Select value={editNewValue} onValueChange={setEditNewValue}>
                  <SelectTrigger className="text-xs border-[#E0E0E0] h-9">
                    <SelectValue placeholder="Selecione o estado civil" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E0E0E0]">
                    <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                    <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                    <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                    <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                    <SelectItem value="União Estável">União Estável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : editFieldKey === 'dados_bancarios' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#212121]">Banco *</Label>
                    <Input
                      placeholder="Ex: Itaú, Bradesco, Santander"
                      value={bancoNome}
                      onChange={(e) => setBancoNome(e.target.value)}
                      className="text-xs border-[#E0E0E0] h-9"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#212121]">Tipo de Conta</Label>
                    <Select value={bancoTipo} onValueChange={setBancoTipo}>
                      <SelectTrigger className="text-xs border-[#E0E0E0] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#E0E0E0]">
                        <SelectItem value="Conta Corrente">Conta Corrente</SelectItem>
                        <SelectItem value="Conta Salário">Conta Salário</SelectItem>
                        <SelectItem value="Conta Poupança">Conta Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#212121]">
                      Agência (com dígito) *
                    </Label>
                    <Input
                      placeholder="Ex: 1842"
                      value={bancoAgencia}
                      onChange={(e) => setBancoAgencia(e.target.value)}
                      className="text-xs border-[#E0E0E0] h-9"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#212121]">
                      Conta (com dígito) *
                    </Label>
                    <Input
                      placeholder="Ex: 49201-8"
                      value={bancoConta}
                      onChange={(e) => setBancoConta(e.target.value)}
                      className="text-xs border-[#E0E0E0] h-9"
                      required
                    />
                  </div>
                </div>
              </div>
            ) : editFieldKey === 'endereco' ? (
              <div className="space-y-1.5">
                <Label htmlFor="endereco" className="text-xs font-semibold text-[#212121]">
                  Novo Endereço Completo (Rua, Nº, Apto, Bairro, Cidade - UF, CEP) *
                </Label>
                <Textarea
                  id="endereco"
                  rows={3}
                  value={editNewValue}
                  onChange={(e) => setEditNewValue(e.target.value)}
                  placeholder="Ex: Rua das Flores, 120, Apto 34 - Pinheiros, São Paulo - SP, CEP 05412-000"
                  className="text-xs border-[#E0E0E0]"
                  required
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="novo_valor" className="text-xs font-semibold text-[#212121]">
                  Novo {editFieldLabel} *
                </Label>
                <Input
                  id="novo_valor"
                  value={editNewValue}
                  onChange={(e) => setEditNewValue(e.target.value)}
                  placeholder={`Informe o novo ${editFieldLabel.toLowerCase()}`}
                  className="text-xs border-[#E0E0E0] h-9"
                  required
                />
              </div>
            )}

            {/* Observação Opcional */}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="obs" className="text-xs font-semibold text-[#757575]">
                Observação para o RH (opcional)
              </Label>
              <Input
                id="obs"
                value={editObservation}
                onChange={(e) => setEditObservation(e.target.value)}
                placeholder="Ex: Mudança de residência recente / Novo número de celular"
                className="text-xs border-[#E0E0E0] h-9"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="border-[#E0E0E0] text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs h-9 gap-1.5 font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Enviar Solicitação
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
