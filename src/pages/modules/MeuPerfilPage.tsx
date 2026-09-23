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
  MessageSquarePlus,
  FileSpreadsheet,
} from 'lucide-react'
import {
  validarCpf,
  formatarCpf,
  formatarTelefone,
  formatarCep,
  validarEmail,
  dateToInputString,
} from '@/lib/validationColaborador'
import { useAuth } from '@/context/AuthContext'
import {
  colaboradorService,
  dependenteService,
  contatoEmergenciaService,
  solicitacaoService,
  logAuditoriaService,
  historicoFuncaoService,
} from '@/services/api'
import { HistoricoFuncao } from '@/types'
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
  const [historicoFuncoes, setHistoricoFuncoes] = useState<HistoricoFuncao[]>([])
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

  // Subcampos para blocos compostos
  const [docSubTipo, setDocSubTipo] = useState<'cnh' | 'titulo_eleitor' | 'reservista'>('cnh')
  const [filiacaoSubTipo, setFiliacaoSubTipo] = useState<'nome_mae' | 'nome_pai'>('nome_mae')

  // Endereço estruturado
  const [endCep, setEndCep] = useState<string>('')
  const [endLogradouro, setEndLogradouro] = useState<string>('')
  const [endNumero, setEndNumero] = useState<string>('')
  const [endComplemento, setEndComplemento] = useState<string>('')
  const [endBairro, setEndBairro] = useState<string>('')
  const [endCidade, setEndCidade] = useState<string>('')
  const [endUf, setEndUf] = useState<string>('')

  // Modal de Solicitação Geral
  const [modalGeralOpen, setModalGeralOpen] = useState<boolean>(false)
  const [descricaoGeral, setDescricaoGeral] = useState<string>('')
  const [submittingGeral, setSubmittingGeral] = useState<boolean>(false)

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

        // Buscar dependentes, contatos, solicitações e histórico de funções em paralelo
        const [depList, contatosList, solicList, funcList] = await Promise.all([
          dependenteService.getDependentesByColaborador(colabRecord.id).catch(() => []),
          contatoEmergenciaService.getContatosByColaborador(colabRecord.id).catch(() => []),
          solicitacaoService.getSolicitacoesByColaborador(colabRecord.id).catch(() => []),
          historicoFuncaoService.getHistoricoPorColaborador(colabRecord.id, false).catch(() => []),
        ])

        setDependentes(depList)
        setContatosEmergencia(contatosList)
        setSolicitacoes(solicList)
        setHistoricoFuncoes(funcList)
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

  // Abre modal para qualquer campo de dados pessoais
  const handleOpenEditModal = (campoKey: string, label: string, valorAtual?: string) => {
    setEditFieldKey(campoKey)
    setEditFieldLabel(label)
    setEditOldValue(valorAtual || '')
    setEditObservation('')

    if (campoKey === 'dados_bancarios') {
      const raw = valorAtual || ''
      setEditNewValue(raw)
      const bancoMatch = raw.match(/^(.*?)\s*\|/i)
      const agenciaMatch = raw.match(/Agência:\s*([^|]+)/i)
      const contaMatch = raw.match(/Conta[^:]*:\s*([^|]+)/i)

      setBancoNome(bancoMatch ? bancoMatch[1].trim() : '')
      setBancoAgencia(agenciaMatch ? agenciaMatch[1].trim() : '')
      setBancoConta(contaMatch ? contaMatch[1].trim() : '')
      setBancoTipo(raw.toLowerCase().includes('poupança') ? 'Conta Poupança' : 'Conta Corrente')
    } else if (campoKey === 'documentos_complementares') {
      setDocSubTipo('cnh')
      setEditOldValue(colaborador?.cnh || '')
      setEditNewValue(colaborador?.cnh || '')
    } else if (campoKey === 'filiacao') {
      setFiliacaoSubTipo('nome_mae')
      setEditOldValue(colaborador?.nome_mae || '')
      setEditNewValue(colaborador?.nome_mae || '')
    } else if (campoKey === 'endereco') {
      const raw = valorAtual || ''
      setEditNewValue(raw)
      // Tentar decompor se já estiver no padrão "Rua X, nº Y, Compl, Bairro, Cidade - UF, CEP 00000-000"
      const cepMatch = raw.match(/CEP\s*([\d-]+)/i)
      setEndCep(cepMatch ? formatarCep(cepMatch[1]) : '')
      setEndLogradouro('')
      setEndNumero('')
      setEndComplemento('')
      setEndBairro('')
      setEndCidade('')
      setEndUf('')
    } else if (campoKey === 'data_nascimento') {
      setEditNewValue(dateToInputString(valorAtual))
    } else {
      setEditNewValue(valorAtual || '')
    }

    setModalOpen(true)
  }

  // Mudança do subtipo de documento complementar no modal
  const handleDocSubTipoChange = (novoSubTipo: 'cnh' | 'titulo_eleitor' | 'reservista') => {
    setDocSubTipo(novoSubTipo)
    let valAtual = ''
    if (novoSubTipo === 'cnh') valAtual = colaborador?.cnh || ''
    if (novoSubTipo === 'titulo_eleitor') valAtual = colaborador?.titulo_eleitor || ''
    if (novoSubTipo === 'reservista') valAtual = colaborador?.reservista || ''
    setEditOldValue(valAtual)
    setEditNewValue(valAtual)
  }

  // Mudança do subtipo de filiação no modal
  const handleFiliacaoSubTipoChange = (novoSubTipo: 'nome_mae' | 'nome_pai') => {
    setFiliacaoSubTipo(novoSubTipo)
    const valAtual =
      novoSubTipo === 'nome_mae' ? colaborador?.nome_mae || '' : colaborador?.nome_pai || ''
    setEditOldValue(valAtual)
    setEditNewValue(valAtual)
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

    let finalCampoLabel = editFieldLabel
    let finalNewValue = editNewValue.trim()
    let finalOldValue = editOldValue.trim()

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
    } else if (editFieldKey === 'documentos_complementares') {
      const mapaLabels: Record<string, string> = {
        cnh: 'CNH',
        titulo_eleitor: 'Título de Eleitor',
        reservista: 'Reservista',
      }
      finalCampoLabel = mapaLabels[docSubTipo] || 'CNH'
      finalOldValue =
        (docSubTipo === 'cnh'
          ? colaborador.cnh
          : docSubTipo === 'titulo_eleitor'
            ? colaborador.titulo_eleitor
            : colaborador.reservista) || 'Não informado'
    } else if (editFieldKey === 'filiacao') {
      finalCampoLabel = filiacaoSubTipo === 'nome_mae' ? 'Mãe' : 'Pai'
      finalOldValue =
        (filiacaoSubTipo === 'nome_mae' ? colaborador.nome_mae : colaborador.nome_pai) ||
        'Não informado'
    } else if (editFieldKey === 'endereco') {
      // Se preencheu os subcampos estruturados, montar o endereço
      if (endLogradouro.trim()) {
        const partes: string[] = []
        partes.push(endLogradouro.trim())
        if (endNumero.trim()) partes.push(`nº ${endNumero.trim()}`)
        if (endComplemento.trim()) partes.push(endComplemento.trim())
        if (endBairro.trim()) partes.push(endBairro.trim())
        if (endCidade.trim() || endUf.trim()) {
          partes.push(`${endCidade.trim() || ''}${endUf.trim() ? ` - ${endUf.trim()}` : ''}`)
        }
        if (endCep.trim()) partes.push(`CEP ${formatarCep(endCep.trim())}`)
        finalNewValue = partes.join(', ')
      }
    } else if (editFieldKey === 'cpf') {
      const cpfFormatado = formatarCpf(finalNewValue)
      if (finalNewValue && !validarCpf(finalNewValue)) {
        toast({
          title: 'CPF inválido',
          description: 'O número de CPF digitado não é válido. Verifique os dígitos.',
          variant: 'destructive',
        })
        return
      }
      finalNewValue = cpfFormatado
    } else if (editFieldKey === 'email') {
      if (finalNewValue && !validarEmail(finalNewValue)) {
        toast({
          title: 'E-mail inválido',
          description: 'Por favor, insira um formato de e-mail válido.',
          variant: 'destructive',
        })
        return
      }
    }

    if (!finalNewValue) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o novo valor desejado para a solicitação.',
        variant: 'destructive',
      })
      return
    }

    if (finalNewValue === finalOldValue) {
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
        campo: finalCampoLabel,
        valor_antigo: finalOldValue || 'Não informado',
        valor_novo: editObservation
          ? `${finalNewValue} (Obs: ${editObservation.trim()})`
          : finalNewValue,
      }

      const novaSolicitacao = await solicitacaoService.createSolicitacao(payload)

      // Atualiza lista local de solicitações
      setSolicitacoes((prev) => [novaSolicitacao, ...prev])

      toast({
        title: 'Solicitação enviada ao RH com sucesso',
        description: `Seu pedido de alteração de "${finalCampoLabel}" foi registrado e está em análise.`,
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

  // Enviar Solicitação Geral (texto livre)
  const handleSubmitSolicitacaoGeral = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!colaborador || !user?.tenant_id) {
      toast({
        title: 'Erro ao enviar',
        description: 'Registro de colaborador não localizado.',
        variant: 'destructive',
      })
      return
    }

    const texto = descricaoGeral.trim()
    if (!texto) {
      toast({
        title: 'Descrição obrigatória',
        description: 'Por favor, descreva as correções necessárias nos seus dados cadastrais.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmittingGeral(true)

      const payload = {
        colaborador_id: colaborador.id,
        tenant_id: user.tenant_id,
        campo: 'Geral',
        valor_antigo: 'Revisão cadastral solicitada pelo colaborador',
        valor_novo: texto,
      }

      const novaSolicitacao = await solicitacaoService.createSolicitacao(payload)
      setSolicitacoes((prev) => [novaSolicitacao, ...prev])

      toast({
        title: 'Solicitação enviada ao RH com sucesso',
        description: 'Sua solicitação geral foi encaminhada para a equipe de Recursos Humanos.',
      })

      setModalGeralOpen(false)
      setDescricaoGeral('')
    } catch (err) {
      console.error('Erro ao enviar solicitação geral:', err)
      toast({
        title: 'Falha ao registrar solicitação',
        description: 'Não foi possível enviar a solicitação geral. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingGeral(false)
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

  // Função vigente atual: busca no histórico a que não tem data_fim
  const funcaoVigente = useMemo(() => {
    if (historicoFuncoes.length === 0) return null
    const aberta = historicoFuncoes.find((h) => !h.data_fim)
    if (aberta) return aberta
    return [...historicoFuncoes].sort(
      (a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime(),
    )[0]
  }, [historicoFuncoes])

  // Início da função vigente e tempo calculado no cargo atual
  const dataInicioFuncaoAtual = funcaoVigente?.data_inicio || colaborador?.data_admissao
  const tempoNoCargoAtual = useMemo(() => {
    return calcularTempoEmpresa(dataInicioFuncaoAtual)
  }, [dataInicioFuncaoAtual])

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
                <span>{user?.email || colaborador?.email || 'Sem e-mail cadastrado'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-blue-200" />
                <span>{colaborador?.local_trabalho || 'Escritório Central'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-200" />
                <span>Admissão: {formatarDataBR(colaborador?.data_admissao)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-blue-200" />
                <span>No Cargo Atual: {tempoNoCargoAtual}</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Botão de Solicitação Geral em destaque */}
                  {getSolicitacaoPendente('Geral') ? (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-300 text-xs py-1"
                    >
                      <Clock3 className="h-3.5 w-3.5 mr-1 text-amber-600" />
                      Solicitação Geral em Análise
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setModalGeralOpen(true)}
                      className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs font-semibold h-8 px-3 gap-1.5 shadow-xs"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      Solicitação Geral
                    </Button>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs text-[#757575] bg-[#F5F5F5] px-2.5 py-1 rounded-md cursor-default">
                        <Info className="h-3.5 w-3.5 text-[#0D47A1]" />
                        <span>Campos com</span>
                        <Edit3 className="h-3 w-3 text-[#0D47A1]" />
                        <span>são editáveis via RH</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-xs">
                      Clique em &quot;Solicitar Alteração&quot; em qualquer campo para pedir
                      correção ao RH caso encontre erro de digitação.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-5 gap-x-6">
                {/* Nome Completo */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      Nome Completo
                    </span>
                    {getSolicitacaoPendente('Nome Completo') ? (
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
                            'nome_completo',
                            'Nome Completo',
                            colaborador?.nome_completo || colaborador?.nome,
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
                    {colaborador?.nome_completo || colaborador?.nome || '—'}
                  </p>
                </div>

                {/* CPF */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      CPF
                    </span>
                    {getSolicitacaoPendente('CPF') ? (
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
                        onClick={() => handleOpenEditModal('cpf', 'CPF', colaborador?.cpf)}
                        className="h-6 px-2 text-[11px] text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50 font-semibold gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Solicitar Alteração
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#212121] font-mono">
                    {colaborador?.cpf || '—'}
                  </p>
                </div>

                {/* RG */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      RG
                    </span>
                    {getSolicitacaoPendente('RG') ? (
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
                        onClick={() => handleOpenEditModal('rg', 'RG', colaborador?.rg)}
                        className="h-6 px-2 text-[11px] text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50 font-semibold gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Solicitar Alteração
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.rg || 'Não informado'}
                  </p>
                </div>

                {/* Data de Nascimento */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      Data de Nascimento
                    </span>
                    {getSolicitacaoPendente('Data de Nascimento') ? (
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
                            'data_nascimento',
                            'Data de Nascimento',
                            colaborador?.data_nascimento,
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
                    {formatarDataBR(colaborador?.data_nascimento)}
                  </p>
                </div>

                {/* Estado Civil */}
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

                {/* Telefone */}
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

                {/* E-mail Corporativo */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      E-mail Corporativo
                    </span>
                    {getSolicitacaoPendente('E-mail Corporativo') ||
                    getSolicitacaoPendente('E-mail') ? (
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
                            'email',
                            'E-mail Corporativo',
                            user?.email || colaborador?.email,
                          )
                        }
                        className="h-6 px-2 text-[11px] text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50 font-semibold gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Solicitar Alteração
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#212121] break-all">
                    {user?.email || colaborador?.email || '—'}
                  </p>
                </div>

                {/* Chave PIX */}
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

                {/* Raça / Cor */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      Raça / Cor
                    </span>
                    {getSolicitacaoPendente('Raça / Cor') ? (
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
                          handleOpenEditModal('raca_cor', 'Raça / Cor', colaborador?.raca_cor)
                        }
                        className="h-6 px-2 text-[11px] text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50 font-semibold gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Solicitar Alteração
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.raca_cor || 'Não informado'}
                  </p>
                </div>

                {/* Sexo */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      Sexo
                    </span>
                    {getSolicitacaoPendente('Sexo') ? (
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
                        onClick={() => handleOpenEditModal('sexo', 'Sexo', colaborador?.sexo)}
                        className="h-6 px-2 text-[11px] text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50 font-semibold gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Solicitar Alteração
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.sexo || 'Não informado'}
                  </p>
                </div>

                {/* Deficiência (PCD) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      Deficiência (PCD)
                    </span>
                    {getSolicitacaoPendente('Deficiência (PCD)') ? (
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
                            'deficiencia',
                            'Deficiência (PCD)',
                            colaborador?.deficiencia,
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
                    {colaborador?.deficiencia || 'Nenhuma'}
                  </p>
                </div>

                {/* Documentos Complementares: Título Eleitor / CNH / Reservista */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      CNH / Título / Reservista
                    </span>
                    {getSolicitacaoPendente('CNH') ||
                    getSolicitacaoPendente('Título de Eleitor') ||
                    getSolicitacaoPendente('Reservista') ? (
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
                            'documentos_complementares',
                            'CNH / Título / Reservista',
                            colaborador?.cnh ||
                              colaborador?.titulo_eleitor ||
                              colaborador?.reservista,
                          )
                        }
                        className="h-6 px-2 text-[11px] text-[#0D47A1] hover:text-[#0A3A82] hover:bg-blue-50 font-semibold gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Solicitar Alteração
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-[#424242] leading-relaxed">
                    CNH: {colaborador?.cnh || '—'} <br />
                    Título: {colaborador?.titulo_eleitor || '—'} <br />
                    Reservista: {colaborador?.reservista || '—'}
                  </p>
                </div>

                {/* Filiação (Nome do Pai e Mãe) */}
                <div className="space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                      Filiação (Pai e Mãe)
                    </span>
                    {getSolicitacaoPendente('Mãe') || getSolicitacaoPendente('Pai') ? (
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
                            'filiacao',
                            'Filiação (Pai e Mãe)',
                            `Mãe: ${colaborador?.nome_mae || 'Não informado'} | Pai: ${colaborador?.nome_pai || 'Não informado'}`,
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
                    Mãe: {colaborador?.nome_mae || 'Não informado'}
                    <br />
                    Pai: {colaborador?.nome_pai || 'Não informado'}
                  </p>
                </div>

                {/* Endereço Residencial Completo */}
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

                {/* Tempo no Cargo Atual */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Tempo no Cargo Atual
                  </span>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E8EEF7] text-[#0D47A1] font-bold text-xs">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>{tempoNoCargoAtual}</span>
                  </div>
                  {funcaoVigente?.data_inicio && (
                    <span className="text-[10px] text-[#757575] block">
                      Início da função: {formatarDataBR(funcaoVigente.data_inicio)}
                    </span>
                  )}
                </div>

                {/* Tempo Total de Empresa */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Tempo de Empresa (CLT)
                  </span>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-[#424242] font-semibold text-xs">
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
                <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                  <span className="text-xs font-semibold text-[#757575] uppercase tracking-wide">
                    Local de Trabalho
                  </span>
                  <p className="text-sm font-medium text-[#212121]">
                    {colaborador?.local_trabalho || 'Escritório Central'}
                  </p>
                </div>
              </div>

              {/* Linha do Tempo de Funções no Meu Perfil */}
              <div className="mt-6 pt-6 border-t border-[#F0F0F0] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-[#0D47A1]" />
                    <h4 className="text-xs font-bold text-[#212121] uppercase tracking-wide">
                      Minha Jornada e Histórico de Funções
                    </h4>
                  </div>
                  {historicoFuncoes.length > 0 && (
                    <span className="text-[11px] text-[#757575]">
                      {historicoFuncoes.length}{' '}
                      {historicoFuncoes.length === 1 ? 'etapa registrada' : 'etapas registradas'}
                    </span>
                  )}
                </div>

                {historicoFuncoes.length > 0 ? (
                  <div className="relative border-l-2 border-[#0D47A1] ml-3 pl-4 space-y-5 text-xs">
                    {[...historicoFuncoes]
                      .sort(
                        (a, b) =>
                          new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime(),
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
                              <p className="font-bold text-[#212121] text-xs">{item.cargo}</p>
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
                                      : 'Etapa Anterior'}
                                </Badge>
                              )}
                            </div>

                            <div className="mt-0.5 space-y-0.5 text-[#616161]">
                              <p className="text-[11px]">
                                <strong className="text-[#424242]">Departamento:</strong>{' '}
                                {item.departamento || colaborador?.departamento || 'Não informado'}
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

                    {/* Nó fixo da Admissão e Integração */}
                    <div className="relative opacity-80 pt-1">
                      <span className="absolute -left-[23px] top-2 h-3 w-3 rounded-full bg-slate-300 ring-4 ring-white" />
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-[#212121]">Admissão e Integração</p>
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-[#0D47A1] border-blue-200 text-[10px]"
                        >
                          Ingresso
                        </Badge>
                      </div>
                      <p className="text-[#757575] text-[11px] mt-0.5">
                        Contratação inicial registrada em{' '}
                        {formatarDataBR(colaborador?.data_admissao)} • Tempo total na empresa:{' '}
                        <strong>{tempoEmpresa}</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Fallback inicial: posição atual a partir da admissão */
                  <div className="relative border-l-2 border-[#0D47A1] ml-3 pl-4 space-y-4 text-xs">
                    <div className="relative">
                      <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-[#0D47A1] ring-4 ring-white" />
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-[#212121]">
                          {colaborador?.cargo || 'Cargo atual'}
                        </p>
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]"
                        >
                          Posição Atual
                        </Badge>
                      </div>
                      <p className="text-[#757575] text-[11px]">
                        Departamento: {colaborador?.departamento || 'Setor'} • Desde{' '}
                        {formatarDataBR(colaborador?.data_admissao)}
                      </p>
                      <p className="text-[10px] text-[#757575] mt-0.5">
                        Tempo na função: <strong>{tempoEmpresa}</strong>
                      </p>
                    </div>

                    <div className="relative opacity-70">
                      <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-slate-300 ring-4 ring-white" />
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-[#212121]">Admissão e Integração</p>
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-[#0D47A1] border-blue-200 text-[10px]"
                        >
                          Ingresso
                        </Badge>
                      </div>
                      <p className="text-[#757575] text-[11px] mt-0.5">
                        Contratação inicial registrada em{' '}
                        {formatarDataBR(colaborador?.data_admissao)}
                      </p>
                    </div>
                  </div>
                )}
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
            ) : editFieldKey === 'sexo' ? (
              <div className="space-y-1.5">
                <Label htmlFor="sexo_select" className="text-xs font-semibold text-[#212121]">
                  Novo Sexo *
                </Label>
                <Select value={editNewValue} onValueChange={setEditNewValue}>
                  <SelectTrigger className="text-xs border-[#E0E0E0] h-9">
                    <SelectValue placeholder="Selecione o sexo" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E0E0E0]">
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                    <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : editFieldKey === 'raca_cor' ? (
              <div className="space-y-1.5">
                <Label htmlFor="raca_select" className="text-xs font-semibold text-[#212121]">
                  Nova Raça / Cor *
                </Label>
                <Select value={editNewValue} onValueChange={setEditNewValue}>
                  <SelectTrigger className="text-xs border-[#E0E0E0] h-9">
                    <SelectValue placeholder="Selecione a raça/cor" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E0E0E0]">
                    <SelectItem value="Branca">Branca</SelectItem>
                    <SelectItem value="Preta">Preta</SelectItem>
                    <SelectItem value="Parda">Parda</SelectItem>
                    <SelectItem value="Amarela">Amarela</SelectItem>
                    <SelectItem value="Indígena">Indígena</SelectItem>
                    <SelectItem value="Não informado">Não informado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : editFieldKey === 'deficiencia' ? (
              <div className="space-y-1.5">
                <Label
                  htmlFor="deficiencia_select"
                  className="text-xs font-semibold text-[#212121]"
                >
                  Deficiência (PCD) *
                </Label>
                <Select value={editNewValue} onValueChange={setEditNewValue}>
                  <SelectTrigger className="text-xs border-[#E0E0E0] h-9">
                    <SelectValue placeholder="Selecione a condição" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E0E0E0]">
                    <SelectItem value="Nenhuma">Nenhuma</SelectItem>
                    <SelectItem value="Física">Física</SelectItem>
                    <SelectItem value="Auditiva">Auditiva</SelectItem>
                    <SelectItem value="Visual">Visual</SelectItem>
                    <SelectItem value="Intelectual">Intelectual</SelectItem>
                    <SelectItem value="Múltipla">Múltipla</SelectItem>
                    <SelectItem value="Reabilitado">Reabilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : editFieldKey === 'documentos_complementares' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#212121]">
                    Selecione qual documento deseja alterar *
                  </Label>
                  <Select
                    value={docSubTipo}
                    onValueChange={(val: 'cnh' | 'titulo_eleitor' | 'reservista') =>
                      handleDocSubTipoChange(val)
                    }
                  >
                    <SelectTrigger className="text-xs border-[#E0E0E0] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#E0E0E0]">
                      <SelectItem value="cnh">CNH (Carteira Nacional de Habilitação)</SelectItem>
                      <SelectItem value="titulo_eleitor">Título de Eleitor</SelectItem>
                      <SelectItem value="reservista">Certificado de Reservista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="novo_doc_val" className="text-xs font-semibold text-[#212121]">
                    Novo número para{' '}
                    {docSubTipo === 'cnh'
                      ? 'CNH'
                      : docSubTipo === 'titulo_eleitor'
                        ? 'Título de Eleitor'
                        : 'Reservista'}{' '}
                    *
                  </Label>
                  <Input
                    id="novo_doc_val"
                    value={editNewValue}
                    onChange={(e) => setEditNewValue(e.target.value)}
                    placeholder="Digite o número do documento"
                    className="text-xs border-[#E0E0E0] h-9 font-mono"
                    required
                  />
                </div>
              </div>
            ) : editFieldKey === 'filiacao' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#212121]">
                    Selecione qual filiação deseja alterar *
                  </Label>
                  <Select
                    value={filiacaoSubTipo}
                    onValueChange={(val: 'nome_mae' | 'nome_pai') =>
                      handleFiliacaoSubTipoChange(val)
                    }
                  >
                    <SelectTrigger className="text-xs border-[#E0E0E0] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#E0E0E0]">
                      <SelectItem value="nome_mae">Nome da Mãe</SelectItem>
                      <SelectItem value="nome_pai">Nome do Pai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="novo_filiacao_val"
                    className="text-xs font-semibold text-[#212121]"
                  >
                    Novo {filiacaoSubTipo === 'nome_mae' ? 'Nome da Mãe' : 'Nome do Pai'} *
                  </Label>
                  <Input
                    id="novo_filiacao_val"
                    value={editNewValue}
                    onChange={(e) => setEditNewValue(e.target.value)}
                    placeholder="Digite o nome completo"
                    className="text-xs border-[#E0E0E0] h-9"
                    required
                  />
                </div>
              </div>
            ) : editFieldKey === 'cpf' ? (
              <div className="space-y-1.5">
                <Label htmlFor="novo_cpf" className="text-xs font-semibold text-[#212121]">
                  Novo CPF (com validação de dígitos) *
                </Label>
                <Input
                  id="novo_cpf"
                  value={editNewValue}
                  onChange={(e) => setEditNewValue(formatarCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="text-xs border-[#E0E0E0] h-9 font-mono"
                  required
                />
              </div>
            ) : editFieldKey === 'telefone' ? (
              <div className="space-y-1.5">
                <Label htmlFor="novo_tel" className="text-xs font-semibold text-[#212121]">
                  Novo Telefone / Celular (com DDD) *
                </Label>
                <Input
                  id="novo_tel"
                  value={editNewValue}
                  onChange={(e) => setEditNewValue(formatarTelefone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="text-xs border-[#E0E0E0] h-9 font-mono"
                  required
                />
              </div>
            ) : editFieldKey === 'data_nascimento' ? (
              <div className="space-y-1.5">
                <Label htmlFor="novo_nasc" className="text-xs font-semibold text-[#212121]">
                  Nova Data de Nascimento *
                </Label>
                <Input
                  id="novo_nasc"
                  type="date"
                  value={editNewValue}
                  onChange={(e) => setEditNewValue(e.target.value)}
                  className="text-xs border-[#E0E0E0] h-9"
                  required
                />
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
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1 col-span-1">
                    <Label className="text-xs font-semibold text-[#212121]">CEP</Label>
                    <Input
                      placeholder="00000-000"
                      value={endCep}
                      maxLength={9}
                      onChange={(e) => setEndCep(formatarCep(e.target.value))}
                      className="text-xs border-[#E0E0E0] h-9 font-mono"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs font-semibold text-[#212121]">
                      Logradouro (Rua/Av)
                    </Label>
                    <Input
                      placeholder="Ex: Av. Paulista"
                      value={endLogradouro}
                      onChange={(e) => setEndLogradouro(e.target.value)}
                      className="text-xs border-[#E0E0E0] h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1 col-span-1">
                    <Label className="text-xs font-semibold text-[#212121]">Número</Label>
                    <Input
                      placeholder="Ex: 1000"
                      value={endNumero}
                      onChange={(e) => setEndNumero(e.target.value)}
                      className="text-xs border-[#E0E0E0] h-9"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs font-semibold text-[#212121]">Complemento</Label>
                    <Input
                      placeholder="Ex: Apto 42, Bloco B"
                      value={endComplemento}
                      onChange={(e) => setEndComplemento(e.target.value)}
                      className="text-xs border-[#E0E0E0] h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1 col-span-1">
                    <Label className="text-xs font-semibold text-[#212121]">Bairro</Label>
                    <Input
                      placeholder="Bairro"
                      value={endBairro}
                      onChange={(e) => setEndBairro(e.target.value)}
                      className="text-xs border-[#E0E0E0] h-9"
                    />
                  </div>
                  <div className="space-y-1 col-span-1">
                    <Label className="text-xs font-semibold text-[#212121]">Cidade</Label>
                    <Input
                      placeholder="Cidade"
                      value={endCidade}
                      onChange={(e) => setEndCidade(e.target.value)}
                      className="text-xs border-[#E0E0E0] h-9"
                    />
                  </div>
                  <div className="space-y-1 col-span-1">
                    <Label className="text-xs font-semibold text-[#212121]">UF</Label>
                    <Input
                      placeholder="SP"
                      maxLength={2}
                      value={endUf}
                      onChange={(e) => setEndUf(e.target.value.toUpperCase())}
                      className="text-xs border-[#E0E0E0] h-9 uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="endereco" className="text-xs font-semibold text-[#757575]">
                    Ou digite o endereço completo em texto livre *
                  </Label>
                  <Textarea
                    id="endereco"
                    rows={2}
                    value={editNewValue}
                    onChange={(e) => setEditNewValue(e.target.value)}
                    placeholder="Ex: Rua Zilda, nº 1250, Apto 09, Casa Verde Alta, São Paulo - SP, CEP 02545-001"
                    className="text-xs border-[#E0E0E0]"
                  />
                </div>
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

      {/* 8. Modal de Solicitação Geral */}
      <Dialog open={modalGeralOpen} onOpenChange={setModalGeralOpen}>
        <DialogContent className="max-w-md bg-white border border-[#E0E0E0] p-0 overflow-hidden">
          <div className="h-2 bg-[#0D47A1] w-full" />
          <form onSubmit={handleSubmitSolicitacaoGeral} className="p-6 space-y-4">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4 text-[#0D47A1]" />
                <DialogTitle className="text-lg font-bold text-[#212121]">
                  Solicitação Geral de Correção Cadastral
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-[#757575]">
                Use este formulário para solicitar correções abrangentes ou múltiplos campos com
                divergência na sua ficha cadastral.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-blue-50/70 p-3 text-xs text-[#0D47A1] space-y-1 border border-blue-100">
              <p className="font-semibold flex items-center gap-1.5">
                <Info className="h-4 w-4 text-[#0D47A1] shrink-0" />
                Como funciona a solicitação geral?
              </p>
              <p className="text-[#37474F] text-[11px] leading-relaxed">
                Descreva detalhadamente o que precisa ser corrigido (por exemplo: &quot;Meu nome e
                CPF possuem erros de digitação: o correto é...&quot;). A equipe de RH analisará seu
                pedido para efetuar o ajuste.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc_geral" className="text-xs font-semibold text-[#212121]">
                Descreva as correções necessárias *
              </Label>
              <Textarea
                id="desc_geral"
                rows={5}
                value={descricaoGeral}
                onChange={(e) => setDescricaoGeral(e.target.value)}
                placeholder="Ex: Meu sobrenome está incorreto, o certo é Silva e meu RG é 55.702.934-X expedido pela SSP-SP. Favor atualizar também meu e-mail corporativo para..."
                className="text-xs border-[#E0E0E0] resize-y min-h-[110px]"
                required
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalGeralOpen(false)}
                disabled={submittingGeral}
                className="border-[#E0E0E0] text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingGeral}
                className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs h-9 gap-1.5 font-semibold"
              >
                {submittingGeral ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Enviar ao RH
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
