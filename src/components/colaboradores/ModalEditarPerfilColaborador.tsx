import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Lock,
  Upload,
  User,
  MapPin,
  CreditCard,
  Briefcase,
  Users,
  PhoneCall,
  Plus,
  Trash2,
  AlertTriangle,
  Save,
  X,
  Loader2,
  Info,
} from 'lucide-react'
import { Colaborador, Dependente, ContatoEmergencia, SolicitacaoAlteracao } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { usePermission } from '@/hooks/usePermission'
import {
  colaboradorService,
  dependenteService,
  contatoEmergenciaService,
  solicitacaoService,
  logAuditoriaService,
} from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import {
  validarCpf,
  formatarCpf,
  validarEmail,
  formatarTelefone,
  formatarCep,
  dateToInputString,
  calcularIdade,
} from '@/lib/validationColaborador'

export interface ModalEditarPerfilColaboradorProps {
  colaborador: Colaborador | null
  open: boolean
  onClose: () => void
  onSaved: (colaboradorAtualizado: Colaborador) => void
}

interface ItemDependenteDraft {
  id?: string // Se tiver id, já existe no banco
  nome: string
  parentesco: string
  data_nascimento: string
  isDeleted?: boolean
}

interface ItemContatoDraft {
  id?: string
  nome: string
  telefone: string
  parentesco: string
  isDeleted?: boolean
}

export const ModalEditarPerfilColaborador: React.FC<ModalEditarPerfilColaboradorProps> = ({
  colaborador,
  open,
  onClose,
  onSaved,
}) => {
  const { user } = useAuth()
  const {
    podeEditarPerfilColaborador,
    podeEditarCpfColaborador,
    podeEditarAdmissaoStatusColaborador,
  } = usePermission()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<string>('secao1')
  const [loading, setLoading] = useState<boolean>(false)
  const [salvando, setSalvando] = useState<boolean>(false)

  // Banner de solicitações pendentes
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState<SolicitacaoAlteracao[]>([])

  // Lista de departamentos para o dropdown da Seção 4
  const [departamentosTenant, setDepartamentosTenant] = useState<string[]>([])

  // Preview de foto
  const [fotoPreview, setFotoPreview] = useState<string>('')
  const [fotoErro, setFotoErro] = useState<string>('')
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null)
  const [fotoRemovida, setFotoRemovida] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ===============================
  // ESTADOS DO FORMULÁRIO (6 SEÇÕES)
  // ===============================

  // Seção 1 — Dados Pessoais
  const [fotoUrl, setFotoUrl] = useState<string>('')
  const [nomeCompleto, setNomeCompleto] = useState<string>('')
  const [cpf, setCpf] = useState<string>('')
  const [rg, setRg] = useState<string>('')
  const [tituloEleitor, setTituloEleitor] = useState<string>('')
  const [cnh, setCnh] = useState<string>('')
  const [reservista, setReservista] = useState<string>('')
  const [dataNascimento, setDataNascimento] = useState<string>('')
  const [estadoCivil, setEstadoCivil] = useState<string>('')
  const [sexo, setSexo] = useState<string>('')
  const [racaCor, setRacaCor] = useState<string>('')
  const [possuiDeficiencia, setPossuiDeficiencia] = useState<boolean>(false)
  const [descricaoDeficiencia, setDescricaoDeficiencia] = useState<string>('')
  const [nomePai, setNomePai] = useState<string>('')
  const [nomeMae, setNomeMae] = useState<string>('')

  // Seção 2 — Contato e Endereço
  const [logradouro, setLogradouro] = useState<string>('')
  const [numero, setNumero] = useState<string>('')
  const [complemento, setComplemento] = useState<string>('')
  const [bairro, setBairro] = useState<string>('')
  const [cidade, setCidade] = useState<string>('')
  const [estado, setEstado] = useState<string>('')
  const [cep, setCep] = useState<string>('')
  const [telefone, setTelefone] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [pix, setPix] = useState<string>('')

  // Seção 3 — Dados Bancários
  const [banco, setBanco] = useState<string>('')
  const [agencia, setAgencia] = useState<string>('')
  const [conta, setConta] = useState<string>('')
  const [tipoConta, setTipoConta] = useState<string>('Corrente')

  // Seção 4 — Dados Profissionais
  const [cargo, setCargo] = useState<string>('')
  const [departamento, setDepartamento] = useState<string>('')
  const [dataAdmissao, setDataAdmissao] = useState<string>('')
  const [jornada, setJornada] = useState<string>('44h/semana')
  const [localTrabalho, setLocalTrabalho] = useState<string>('')
  const [status, setStatus] = useState<string>('ativo')

  // Seção 5 — Dependentes
  const [dependentesList, setDependentesList] = useState<ItemDependenteDraft[]>([])

  // Seção 6 — Contatos de Emergência
  const [contatosList, setContatosList] = useState<ItemContatoDraft[]>([])

  // Erros de validação
  const [erros, setErros] = useState<Record<string, string>>({})

  // Parser do endereço composto armazenado em colaborador.endereco
  const parseEndereco = (enderecoStr?: string) => {
    if (!enderecoStr) return
    // Tenta quebrar padrões comuns como "Rua X, 123, Apto 1 - Bairro, Cidade - UF, CEP"
    // Caso não consiga decompor perfeitamente, atribui ao logradouro
    const partesVirgula = enderecoStr.split(',').map((p) => p.trim())
    if (partesVirgula.length >= 2) {
      setLogradouro(partesVirgula[0] || '')
      // Checar se a segunda parte tem número
      const segundo = partesVirgula[1] || ''
      setNumero(segundo)
    } else {
      setLogradouro(enderecoStr)
    }

    // Tentar extrair CEP se houver (formato 00000-000 ou 8 dígitos)
    const cepMatch = enderecoStr.match(/\b\d{5}-?\d{3}\b/)
    if (cepMatch) {
      setCep(formatarCep(cepMatch[0]))
    }
  }

  // Parser dos dados bancários em string
  const parseDadosBancarios = (dadosStr?: string) => {
    if (!dadosStr) return
    // Formato padrão: "Banco Itaú (341) | Agência: 1842 | Conta Corrente: 49201-8"
    const partes = dadosStr.split('|').map((p) => p.trim())
    partes.forEach((p) => {
      if (p.toLowerCase().startsWith('banco')) {
        setBanco(p.replace(/^banco\s*:?\s*/i, ''))
      } else if (p.toLowerCase().startsWith('agência:') || p.toLowerCase().startsWith('agencia:')) {
        setAgencia(p.replace(/^ag[eê]ncia\s*:?\s*/i, ''))
      } else if (p.toLowerCase().includes('conta')) {
        if (p.toLowerCase().includes('poupança') || p.toLowerCase().includes('poupanca')) {
          setTipoConta('Poupança')
        } else {
          setTipoConta('Corrente')
        }
        setConta(p.replace(/^conta\s*(corrente|poupança|poupanca)?\s*:?\s*/i, ''))
      } else if (!banco) {
        setBanco(p)
      }
    })
  }

  // Carregar dados iniciais ao abrir o modal
  useEffect(() => {
    if (!open || !colaborador) {
      if (fotoPreview && fotoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(fotoPreview)
      }
      setFotoPreview('')
      setFotoArquivo(null)
      setFotoRemovida(false)
      setErros({})
      setActiveTab('secao1')
      return
    }

    if (fotoPreview && fotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(fotoPreview)
    }
    setFotoArquivo(null)
    setFotoRemovida(false)
    setErros({})
    setFotoErro('')

    // Preencher campos Seção 1
    const nomeBase = colaborador.nome_completo || colaborador.nome || ''
    setNomeCompleto(nomeBase)
    setCpf(colaborador.cpf || '')
    setRg(colaborador.rg || '')
    setTituloEleitor(colaborador.titulo_eleitor || '')
    setCnh(colaborador.cnh || '')
    setReservista(colaborador.reservista || '')
    setDataNascimento(dateToInputString(colaborador.data_nascimento))
    setEstadoCivil(colaborador.estado_civil || '')
    setSexo(colaborador.sexo || '')
    setRacaCor(colaborador.raca_cor || '')
    setPossuiDeficiencia(Boolean(colaborador.deficiencia && colaborador.deficiencia !== 'Nenhuma'))
    setDescricaoDeficiencia(
      colaborador.deficiencia && colaborador.deficiencia !== 'Nenhuma'
        ? colaborador.deficiencia
        : '',
    )
    setNomePai(colaborador.nome_pai || '')
    setNomeMae(colaborador.nome_mae || '')
    setFotoUrl(colaborador.foto_url || '')
    setFotoPreview(colaborador.foto_url || '')

    // Preencher campos Seção 2
    parseEndereco(colaborador.endereco)
    setTelefone(colaborador.telefone ? formatarTelefone(colaborador.telefone) : '')
    setEmail(colaborador.email || '')
    setPix(colaborador.pix || '')

    // Preencher campos Seção 3
    parseDadosBancarios(colaborador.dados_bancarios)

    // Preencher campos Seção 4
    setCargo(colaborador.cargo || '')
    setDepartamento(colaborador.departamento || '')
    setDataAdmissao(dateToInputString(colaborador.data_admissao))
    setJornada(colaborador.jornada || '44h/semana')
    setLocalTrabalho(colaborador.local_trabalho || '')
    setStatus(colaborador.status || 'ativo')

    // Carregar dependentes, contatos e solicitações pendentes
    async function carregarRelacionados() {
      if (!colaborador) return
      try {
        setLoading(true)
        const [deps, conts, solics, todosColabs] = await Promise.all([
          dependenteService.getDependentesByColaborador(colaborador.id).catch(() => []),
          contatoEmergenciaService.getContatosByColaborador(colaborador.id).catch(() => []),
          solicitacaoService.getSolicitacoesByColaborador(colaborador.id).catch(() => []),
          user?.tenant_id
            ? colaboradorService.getColaboradores(user.tenant_id).catch(() => [])
            : Promise.resolve([]),
        ])

        setDependentesList(
          deps.map((d) => ({
            id: d.id,
            nome: d.nome,
            parentesco: d.parentesco,
            data_nascimento: dateToInputString(d.data_nascimento),
          })),
        )

        setContatosList(
          conts.map((c) => ({
            id: c.id,
            nome: c.nome,
            telefone: formatarTelefone(c.telefone),
            parentesco: c.parentesco,
          })),
        )

        // Filtrar apenas pendentes
        const pendentes = solics.filter((s) => s.status === 'pendente')
        setSolicitacoesPendentes(pendentes)

        // Extrair departamentos distintos do tenant para alimentar o dropdown
        const depts = new Set<string>()
        if (colaborador.departamento) depts.add(colaborador.departamento)
        depts.add('Recursos Humanos')
        depts.add('Marketing')
        depts.add('TI')
        depts.add('Financeiro')
        depts.add('Diretoria')
        depts.add('Operações')
        depts.add('Comercial')
        todosColabs.forEach((c) => {
          if (c.departamento && c.departamento.trim()) {
            depts.add(c.departamento.trim())
          }
        })
        setDepartamentosTenant(Array.from(depts).sort())
      } catch (err) {
        console.error('Erro ao carregar dados complementares para edição:', err)
      } finally {
        setLoading(false)
      }
    }

    carregarRelacionados()
  }, [open, colaborador, user?.tenant_id])

  if (!colaborador || !podeEditarPerfilColaborador) {
    return null
  }

  // Upload de Foto nativo via File / URL.createObjectURL (sem converter para base64)
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFotoErro('')
    if (!file) return

    // Limite de 5 MB
    const maxSizeBytes = 5 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      setFotoErro('A imagem deve ter no máximo 5 MB.')
      toast({
        title: 'Arquivo muito grande',
        description: 'Selecione uma imagem PNG ou JPEG com menos de 5 MB.',
        variant: 'destructive',
      })
      return
    }

    // Formatos válidos: PNG, JPEG
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      setFotoErro('Formato inválido. Apenas PNG ou JPEG.')
      toast({
        title: 'Formato inválido',
        description: 'Envie um arquivo PNG ou JPEG.',
        variant: 'destructive',
      })
      return
    }

    if (fotoPreview && fotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(fotoPreview)
    }

    const previewUrl = URL.createObjectURL(file)
    setFotoPreview(previewUrl)
    setFotoArquivo(file)
    setFotoRemovida(false)
  }

  // Adicionar Dependente
  const handleAdicionarDependente = () => {
    setDependentesList((prev) => [
      ...prev,
      {
        nome: '',
        parentesco: 'Filho(a)',
        data_nascimento: '',
      },
    ])
  }

  // Remover Dependente
  const handleRemoverDependente = (index: number) => {
    setDependentesList((prev) => {
      const item = prev[index]
      if (item.id) {
        // Marcar como deletado para apagar no backend ao salvar
        return prev.map((dep, idx) => (idx === index ? { ...dep, isDeleted: true } : dep))
      }
      return prev.filter((_, idx) => idx !== index)
    })
  }

  // Adicionar Contato de Emergência
  const handleAdicionarContato = () => {
    setContatosList((prev) => [
      ...prev,
      {
        nome: '',
        telefone: '',
        parentesco: '',
      },
    ])
  }

  // Remover Contato de Emergência
  const handleRemoverContato = (index: number) => {
    setContatosList((prev) => {
      const item = prev[index]
      if (item.id) {
        return prev.map((cont, idx) => (idx === index ? { ...cont, isDeleted: true } : cont))
      }
      return prev.filter((_, idx) => idx !== index)
    })
  }

  // Validação dos Campos Obrigatórios e Regras de Negócio
  const validarFormulario = (): boolean => {
    const novosErros: Record<string, string> = {}

    // Obrigatórios: nome completo, CPF, data de nascimento, cargo, departamento, data de admissão, status
    if (!nomeCompleto.trim()) {
      novosErros.nomeCompleto = 'Nome completo é obrigatório'
    }

    if (!cpf.trim()) {
      novosErros.cpf = 'CPF é obrigatório'
    } else if (podeEditarCpfColaborador) {
      if (!validarCpf(cpf)) {
        novosErros.cpf = 'CPF inválido. Verifique os dígitos.'
      }
    }

    if (!dataNascimento) {
      novosErros.dataNascimento = 'Data de nascimento é obrigatória'
    } else {
      const dataNascObj = new Date(dataNascimento)
      const hoje = new Date()
      if (dataNascObj > hoje) {
        novosErros.dataNascimento = 'Data de nascimento não pode ser futura'
      } else {
        const idade = calcularIdade(dataNascimento)
        if (idade < 16) {
          novosErros.dataNascimento = 'Colaborador não pode ter menos de 16 anos'
        }
      }
    }

    if (!cargo.trim()) {
      novosErros.cargo = 'Cargo é obrigatório'
    }

    if (!departamento.trim()) {
      novosErros.departamento = 'Departamento é obrigatório'
    }

    if (!dataAdmissao) {
      novosErros.dataAdmissao = 'Data de admissão é obrigatória'
    } else {
      const dataAdmObj = new Date(dataAdmissao)
      const hoje = new Date()
      if (dataAdmObj > hoje) {
        novosErros.dataAdmissao = 'Data de admissão não pode ser futura'
      } else if (dataNascimento) {
        // Não pode ser anterior à data de nascimento + 16 anos
        const dataNascObj = new Date(dataNascimento)
        const dataMinimaAdmissao = new Date(dataNascObj)
        dataMinimaAdmissao.setFullYear(dataMinimaAdmissao.getFullYear() + 16)

        if (dataAdmObj < dataMinimaAdmissao) {
          novosErros.dataAdmissao = 'Admissão não pode ser anterior a 16 anos da data de nascimento'
        }
      }
    }

    if (!status) {
      novosErros.status = 'Status é obrigatório'
    }

    // E-mail: validar formato se preenchido
    if (email.trim() && !validarEmail(email)) {
      novosErros.email = 'E-mail em formato inválido'
    }

    setErros(novosErros)

    if (Object.keys(novosErros).length > 0) {
      // Se houver erros, direcionar para a primeira aba que contém erro
      if (novosErros.nomeCompleto || novosErros.cpf || novosErros.dataNascimento) {
        setActiveTab('secao1')
      } else if (novosErros.email) {
        setActiveTab('secao2')
      } else if (
        novosErros.cargo ||
        novosErros.departamento ||
        novosErros.dataAdmissao ||
        novosErros.status
      ) {
        setActiveTab('secao4')
      }

      toast({
        title: 'Verifique os campos obrigatórios',
        description: 'Preencha todos os campos destacados em vermelho antes de salvar.',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  // Submissão do Formulário Completo
  const handleSalvar = async () => {
    if (!validarFormulario()) return
    if (!colaborador || !user?.tenant_id || !user?.id) return

    try {
      setSalvando(true)

      // Montar endereço unificado
      const partesEnd = [
        logradouro.trim(),
        numero.trim() ? `nº ${numero.trim()}` : '',
        complemento.trim(),
        bairro.trim(),
        cidade.trim() ? `${cidade.trim()} - ${estado.trim() || 'SP'}` : '',
        cep.trim() ? `CEP ${cep.trim()}` : '',
      ]
        .filter(Boolean)
        .join(', ')

      // Montar dados bancários unificados
      const dadosBancariosStr = [
        banco.trim() ? `Banco: ${banco.trim()}` : '',
        agencia.trim() ? `Agência: ${agencia.trim()}` : '',
        conta.trim() ? `Conta ${tipoConta}: ${conta.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      // Preparar payload de atualização do colaborador
      const dadosAtualizados: Partial<Colaborador> = {
        nome: nomeCompleto.trim().split(' ')[0] || nomeCompleto.trim(),
        nome_completo: nomeCompleto.trim(),
        rg: rg.trim(),
        titulo_eleitor: tituloEleitor.trim(),
        cnh: cnh.trim(),
        reservista: reservista.trim(),
        data_nascimento: dataNascimento ? `${dataNascimento} 00:00:00.000Z` : undefined,
        estado_civil: estadoCivil || undefined,
        sexo: sexo || undefined,
        raca_cor: racaCor || undefined,
        deficiencia: possuiDeficiencia ? descricaoDeficiencia.trim() || 'Sim' : 'Nenhuma',
        nome_pai: nomePai.trim(),
        nome_mae: nomeMae.trim(),
        endereco: partesEnd || colaborador.endereco,
        telefone: telefone.trim(),
        email: email.trim(),
        pix: pix.trim(),
        dados_bancarios: dadosBancariosStr || colaborador.dados_bancarios,
        cargo: cargo.trim(),
        departamento: departamento.trim(),
        jornada: jornada.trim(),
        local_trabalho: localTrabalho.trim(),
      }

      // Se a foto foi removida expressamente
      if (fotoRemovida) {
        dadosAtualizados.foto_url = ''
      }

      // CPF: só altera se tiver permissão de admin
      if (podeEditarCpfColaborador && cpf.trim()) {
        dadosAtualizados.cpf = cpf.trim()
      }

      // Data admissão e Status: só altera se tiver permissão admin_rh ou admin
      if (podeEditarAdmissaoStatusColaborador) {
        if (dataAdmissao) {
          dadosAtualizados.data_admissao = `${dataAdmissao} 00:00:00.000Z`
        }
        if (status) {
          dadosAtualizados.status = status as 'ativo' | 'inativo'
        }
      }

      // 1. Identificar campos alterados para auditoria detalhada
      const camposAlterados: Record<string, { anterior: unknown; novo: unknown }> = {}
      Object.keys(dadosAtualizados).forEach((key) => {
        const k = key as keyof Colaborador
        const valAnterior = colaborador[k]
        const valNovo = dadosAtualizados[k]

        // Normalizar para comparação
        const strAnt = (valAnterior ?? '').toString().trim()
        const strNovo = (valNovo ?? '').toString().trim()
        if (strAnt !== strNovo) {
          camposAlterados[key] = {
            anterior: valAnterior ?? null,
            novo: valNovo ?? null,
          }
        }
      })

      // 2. Salvar atualização cadastral na coleção colaborador
      let colaboradorSalvo = await colaboradorService.updateColaborador(
        colaborador.id,
        dadosAtualizados,
      )

      // 2.1 Upload ou remoção nativa de foto via FormData
      if (fotoArquivo) {
        try {
          colaboradorSalvo = await colaboradorService.uploadFotoArquivo(colaborador.id, fotoArquivo)

          // Auditoria específica da alteração de foto
          await logAuditoriaService.registrarLog({
            tenant_id: user.tenant_id,
            user_id: user.id,
            acao: `Foto de perfil de ${colaborador.nome} atualizada por ${user.name}`,
            entidade: 'colaborador',
            entidade_id: colaborador.id,
            dados_json: {
              tipo_acao: 'upload_foto_colaborador',
              origem: 'modal_editar_perfil',
              nome_arquivo: fotoArquivo.name,
              tamanho_bytes: fotoArquivo.size,
              tipo_mime: fotoArquivo.type,
              colaborador_id: colaborador.id,
              colaborador_nome: colaborador.nome,
              responsavel_id: user.id,
              responsavel_nome: user.name,
              data_upload: new Date().toISOString(),
            },
          })
        } catch (fotoErr) {
          console.warn('Erro ao enviar foto via FormData:', fotoErr)
          toast({
            title: 'Aviso sobre a foto',
            description: 'Os dados cadastrais foram salvos, mas houve falha no upload da foto.',
            variant: 'destructive',
          })
        }
      } else if (fotoRemovida) {
        try {
          colaboradorSalvo = await colaboradorService.removerFoto(colaborador.id)

          // Auditoria de remoção de foto
          await logAuditoriaService.registrarLog({
            tenant_id: user.tenant_id,
            user_id: user.id,
            acao: `Foto de perfil de ${colaborador.nome} removida por ${user.name}`,
            entidade: 'colaborador',
            entidade_id: colaborador.id,
            dados_json: {
              tipo_acao: 'remocao_foto_colaborador',
              origem: 'modal_editar_perfil',
              colaborador_id: colaborador.id,
              responsavel_id: user.id,
              responsavel_nome: user.name,
              data_remocao: new Date().toISOString(),
            },
          })
        } catch (remErr) {
          console.warn('Erro ao remover foto:', remErr)
        }
      }

      // 3. Processar Dependentes (Criar, atualizar ou deletar)
      for (const dep of dependentesList) {
        if (dep.isDeleted && dep.id) {
          await dependenteService.deleteDependente(dep.id).catch((err) => {
            console.warn('Erro ao deletar dependente:', err)
          })
        } else if (!dep.isDeleted && !dep.id && dep.nome.trim()) {
          await dependenteService.createDependente({
            colaborador_id: colaborador.id,
            tenant_id: user.tenant_id,
            nome: dep.nome.trim(),
            parentesco: dep.parentesco.trim() || 'Filho(a)',
            data_nascimento: dep.data_nascimento
              ? `${dep.data_nascimento} 00:00:00.000Z`
              : undefined,
          })
        } else if (!dep.isDeleted && dep.id && dep.nome.trim()) {
          await dependenteService.updateDependente(dep.id, {
            nome: dep.nome.trim(),
            parentesco: dep.parentesco.trim(),
            data_nascimento: dep.data_nascimento
              ? `${dep.data_nascimento} 00:00:00.000Z`
              : undefined,
          })
        }
      }

      // 4. Processar Contatos de Emergência (Criar, atualizar ou deletar)
      for (const cont of contatosList) {
        if (cont.isDeleted && cont.id) {
          await contatoEmergenciaService.deleteContato(cont.id).catch((err) => {
            console.warn('Erro ao deletar contato:', err)
          })
        } else if (!cont.isDeleted && !cont.id && cont.nome.trim() && cont.telefone.trim()) {
          await contatoEmergenciaService.createContato({
            colaborador_id: colaborador.id,
            tenant_id: user.tenant_id,
            nome: cont.nome.trim(),
            telefone: cont.telefone.trim(),
            parentesco: cont.parentesco.trim() || 'Familiar',
          })
        } else if (!cont.isDeleted && cont.id && cont.nome.trim()) {
          await contatoEmergenciaService.updateContato(cont.id, {
            nome: cont.nome.trim(),
            telefone: cont.telefone.trim(),
            parentesco: cont.parentesco.trim(),
          })
        }
      }

      // 5. Integração com fluxo de solicitação de alteração:
      // Ao salvar a edição direta, rejeitar automaticamente todas as solicitações pendentes
      // daquele colaborador com comentário: "Perfil editado diretamente por [perfil do usuário]"
      if (solicitacoesPendentes.length > 0) {
        const perfilUsuarioFormatado =
          user.perfil === 'admin'
            ? 'Administrador Geral'
            : user.perfil === 'admin_rh'
              ? 'Administrador de RH'
              : 'RH Operacional'

        const motivoAutoRejeicao = `Perfil editado diretamente por ${perfilUsuarioFormatado}`

        await Promise.allSettled(
          solicitacoesPendentes.map((solic) =>
            solicitacaoService.rejeitarSolicitacao(solic, user.id, motivoAutoRejeicao),
          ),
        )
      }

      // 6. Registrar em log_auditoria:
      // "Perfil de [Nome do Colaborador] editado por [Nome do Usuário]" com os campos alterados em dados_json
      const nomeColab = colaborador.nome_completo || colaborador.nome
      const acaoDescricao = `Perfil de ${nomeColab} editado por ${user.name}`

      await logAuditoriaService.registrarLog({
        tenant_id: user.tenant_id,
        user_id: user.id,
        acao: acaoDescricao,
        entidade: 'colaborador',
        entidade_id: colaborador.id,
        dados_json: {
          colaborador_id: colaborador.id,
          colaborador_nome: nomeColab,
          usuario_id: user.id,
          usuario_nome: user.name,
          usuario_perfil: user.perfil,
          campos_alterados: camposAlterados,
          solicitacoes_pendentes_rejeitadas: solicitacoesPendentes.length,
          data_edicao: new Date().toISOString(),
        },
      })

      // 7. Toast de sucesso: "Perfil atualizado com sucesso"
      toast({
        title: 'Perfil atualizado com sucesso',
        description: `Os dados cadastrais de ${nomeColab} foram salvos no sistema.`,
      })

      onSaved(colaboradorSalvo)
      onClose()
    } catch (err) {
      console.error('Erro ao salvar edição do colaborador:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar o perfil. Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const Iniciais = () => {
    const nome = nomeCompleto || colaborador?.nome || 'CO'
    const parts = nome.trim().split(/\s+/)
    if (parts.length === 1) return <>{parts[0].slice(0, 2).toUpperCase()}</>
    return <>{(parts[0][0] + parts[parts.length - 1][0]).toUpperCase()}</>
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] p-0 flex flex-col bg-[#F5F5F5] border border-[#E0E0E0] shadow-2xl overflow-hidden">
        {/* Header do Modal com azul Tesla corporativo #0D47A1 */}
        <div className="bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1E88E5] text-white px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20 text-white font-bold">
                <User className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white tracking-tight">
                  Editar Perfil do Colaborador
                </DialogTitle>
                <DialogDescription className="text-xs text-white/80">
                  Edição cadastral direta com registro automático de auditoria
                </DialogDescription>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-[11px] bg-white/20 px-2.5 py-1 rounded-full font-semibold">
                Perfil Atual: {user?.perfil?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Banner de Solicitações Pendentes (se houver) */}
        {solicitacoesPendentes.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-900 flex items-start gap-2.5 shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-tight">
              <strong>Atenção:</strong> Este colaborador possui{' '}
              <strong>{solicitacoesPendentes.length}</strong>{' '}
              {solicitacoesPendentes.length === 1
                ? 'solicitação de alteração pendente'
                : 'solicitações de alteração pendentes'}
              . Ao salvar, as alterações manuais sobrescreverão os valores atuais e as solicitações
              serão rejeitadas automaticamente.
            </div>
          </div>
        )}

        {/* Abas das 6 Seções */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0 bg-[#F5F5F5]"
        >
          <div className="bg-white border-b border-[#E0E0E0] px-4 pt-1.5 shrink-0 overflow-x-auto scrollbar-thin">
            <TabsList className="bg-transparent h-10 p-0 flex gap-1 justify-start min-w-max">
              <TabsTrigger
                value="secao1"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
              >
                <User className="h-3.5 w-3.5" />
                1. Dados Pessoais
                {(erros.nomeCompleto || erros.cpf || erros.dataNascimento) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="secao2"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
              >
                <MapPin className="h-3.5 w-3.5" />
                2. Contato e Endereço
                {erros.email && <span className="h-1.5 w-1.5 rounded-full bg-red-600" />}
              </TabsTrigger>
              <TabsTrigger
                value="secao3"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
              >
                <CreditCard className="h-3.5 w-3.5" />
                3. Dados Bancários
              </TabsTrigger>
              <TabsTrigger
                value="secao4"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
              >
                <Briefcase className="h-3.5 w-3.5" />
                4. Dados Profissionais
                {(erros.cargo || erros.departamento || erros.dataAdmissao || erros.status) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="secao5"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                5. Dependentes ({dependentesList.filter((d) => !d.isDeleted).length})
              </TabsTrigger>
              <TabsTrigger
                value="secao6"
                className="data-[state=active]:border-b-2 data-[state=active]:border-[#0D47A1] data-[state=active]:text-[#0D47A1] data-[state=active]:shadow-none rounded-none text-xs font-semibold px-3 py-2 text-[#757575] hover:text-[#212121] gap-1.5"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                6. Contatos Emergência ({contatosList.filter((c) => !c.isDeleted).length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Área com Scroll do Conteúdo das Seções */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* SEÇÃO 1 — DADOS PESSOAIS */}
            <TabsContent value="secao1" className="m-0 space-y-5">
              {/* Foto do Colaborador com preview circular */}
              <div className="p-4 rounded-xl bg-white border border-[#E0E0E0] flex flex-col sm:flex-row items-center gap-5">
                <Avatar className="h-20 w-20 rounded-full border-2 border-[#0D47A1]/20 shadow-md ring-2 ring-blue-50">
                  {fotoPreview && <AvatarImage src={fotoPreview} className="object-cover" />}
                  <AvatarFallback className="bg-[#0D47A1] text-white text-xl font-bold">
                    <Iniciais />
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-1.5 text-center sm:text-left flex-1">
                  <Label className="text-xs font-bold text-[#212121]">
                    Foto de Perfil do Colaborador
                  </Label>
                  <p className="text-[11px] text-[#757575]">
                    Formatos aceitos: PNG ou JPEG. Limite de tamanho: 5 MB. Upload nativo com
                    armazenamento seguro.
                  </p>
                  {fotoErro && <p className="text-xs text-red-600 font-medium">{fotoErro}</p>}
                  <div className="flex flex-wrap gap-2 pt-1 justify-center sm:justify-start">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleFotoChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 text-xs border-[#E0E0E0] text-[#0D47A1] hover:bg-blue-50 gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Escolher Imagem
                    </Button>
                    {fotoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (fotoPreview && fotoPreview.startsWith('blob:')) {
                            URL.revokeObjectURL(fotoPreview)
                          }
                          setFotoPreview('')
                          setFotoArquivo(null)
                          setFotoRemovida(true)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="h-8 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        Remover Foto
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Formulário Dados Pessoais */}
              <div className="p-5 rounded-xl bg-white border border-[#E0E0E0] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Nome Completo */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-bold text-[#212121]">
                      Nome Completo <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      value={nomeCompleto}
                      onChange={(e) => setNomeCompleto(e.target.value)}
                      placeholder="Ex: Lucas Ferreira dos Santos"
                      className={`text-xs h-9 bg-white ${
                        erros.nomeCompleto
                          ? 'border-red-600 ring-1 ring-red-600'
                          : 'border-[#E0E0E0]'
                      }`}
                    />
                    {erros.nomeCompleto && (
                      <span className="text-[11px] text-red-600">{erros.nomeCompleto}</span>
                    )}
                  </div>

                  {/* CPF: bloqueado para 'rh' e 'admin_rh'; editável APENAS para 'admin' */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-bold text-[#212121]">
                        CPF <span className="text-red-600">*</span>
                      </Label>
                      {!podeEditarCpfColaborador && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help">
                              <Lock className="h-3.5 w-3.5 text-amber-600" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-xs">
                            Este campo só pode ser editado pelo Administrador Geral
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Input
                      value={cpf}
                      onChange={(e) => setCpf(formatarCpf(e.target.value))}
                      disabled={!podeEditarCpfColaborador}
                      placeholder="000.000.000-00"
                      className={`text-xs h-9 font-mono ${
                        !podeEditarCpfColaborador
                          ? 'bg-[#EEEEEE] text-[#616161] cursor-not-allowed border-[#BDBDBD]'
                          : erros.cpf
                            ? 'border-red-600 ring-1 ring-red-600 bg-white'
                            : 'border-[#E0E0E0] bg-white'
                      }`}
                    />
                    {erros.cpf && <span className="text-[11px] text-red-600">{erros.cpf}</span>}
                  </div>

                  {/* RG */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">RG</Label>
                    <Input
                      value={rg}
                      onChange={(e) => setRg(e.target.value)}
                      placeholder="Ex: 45.192.830-7 SSP/SP"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* Título de Eleitor */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">
                      Título de Eleitor
                    </Label>
                    <Input
                      value={tituloEleitor}
                      onChange={(e) => setTituloEleitor(e.target.value)}
                      placeholder="Ex: 1892 0382 0141"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* CNH */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">CNH</Label>
                    <Input
                      value={cnh}
                      onChange={(e) => setCnh(e.target.value)}
                      placeholder="Ex: 05492819201 - B"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* Reservista */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">
                      Certificado de Reservista
                    </Label>
                    <Input
                      value={reservista}
                      onChange={(e) => setReservista(e.target.value)}
                      placeholder="Ex: 08/391.029-4"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* Data de Nascimento (datepicker) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-[#212121]">
                      Data de Nascimento <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                      className={`text-xs h-9 bg-white ${
                        erros.dataNascimento
                          ? 'border-red-600 ring-1 ring-red-600'
                          : 'border-[#E0E0E0]'
                      }`}
                    />
                    {erros.dataNascimento && (
                      <span className="text-[11px] text-red-600">{erros.dataNascimento}</span>
                    )}
                  </div>

                  {/* Estado Civil (dropdown) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Estado Civil</Label>
                    <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                      <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
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

                  {/* Sexo (dropdown) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Sexo</Label>
                    <Select value={sexo} onValueChange={setSexo}>
                      <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
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

                  {/* Raça/Cor (dropdown) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Raça / Cor</Label>
                    <Select value={racaCor} onValueChange={setRacaCor}>
                      <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                        <SelectValue placeholder="Selecione raça/cor" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#E0E0E0]">
                        <SelectItem value="Branca">Branca</SelectItem>
                        <SelectItem value="Preta">Preta</SelectItem>
                        <SelectItem value="Parda">Parda</SelectItem>
                        <SelectItem value="Amarela">Amarela</SelectItem>
                        <SelectItem value="Indígena">Indígena</SelectItem>
                        <SelectItem value="Não informado">Prefiro não informar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Possui Deficiência? (toggle sim/não) */}
                  <div className="space-y-1 sm:col-span-2">
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA]">
                      <div>
                        <Label className="text-xs font-semibold text-[#212121]">
                          Possui alguma deficiência (PCD)?
                        </Label>
                        <p className="text-[11px] text-[#757575]">
                          Indique se o colaborador se enquadra na cota legal de pessoas com
                          deficiência.
                        </p>
                      </div>
                      <Switch checked={possuiDeficiencia} onCheckedChange={setPossuiDeficiencia} />
                    </div>
                  </div>

                  {/* Campo de texto se sim */}
                  {possuiDeficiencia && (
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs font-semibold text-[#616161]">
                        Descrição da Deficiência
                      </Label>
                      <Input
                        value={descricaoDeficiencia}
                        onChange={(e) => setDescricaoDeficiencia(e.target.value)}
                        placeholder="Ex: Física, Auditiva, Visual, Múltipla ou CID específico"
                        className="text-xs h-9 border-[#E0E0E0] bg-white"
                      />
                    </div>
                  )}

                  {/* Nome da Mãe */}
                  <div className="space-y-1 sm:col-span-1 lg:col-span-1.5">
                    <Label className="text-xs font-semibold text-[#616161]">Nome da Mãe</Label>
                    <Input
                      value={nomeMae}
                      onChange={(e) => setNomeMae(e.target.value)}
                      placeholder="Nome completo da mãe"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* Nome do Pai */}
                  <div className="space-y-1 sm:col-span-1 lg:col-span-1.5">
                    <Label className="text-xs font-semibold text-[#616161]">Nome do Pai</Label>
                    <Input
                      value={nomePai}
                      onChange={(e) => setNomePai(e.target.value)}
                      placeholder="Nome completo do pai"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* SEÇÃO 2 — CONTATO E ENDEREÇO */}
            <TabsContent value="secao2" className="m-0 space-y-4">
              <div className="p-5 rounded-xl bg-white border border-[#E0E0E0] space-y-4">
                <div className="flex items-center gap-2 border-b border-[#F0F0F0] pb-2">
                  <MapPin className="h-4 w-4 text-[#0D47A1]" />
                  <h3 className="text-xs font-bold text-[#212121] uppercase">
                    Endereço Residencial
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {/* CEP */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">CEP</Label>
                    <Input
                      value={cep}
                      onChange={(e) => setCep(formatarCep(e.target.value))}
                      placeholder="00000-000"
                      className="text-xs h-9 border-[#E0E0E0] bg-white font-mono"
                    />
                  </div>

                  {/* Logradouro */}
                  <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                    <Label className="text-xs font-semibold text-[#616161]">
                      Logradouro (Rua / Av)
                    </Label>
                    <Input
                      value={logradouro}
                      onChange={(e) => setLogradouro(e.target.value)}
                      placeholder="Ex: Av. Paulista"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* Número */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Número</Label>
                    <Input
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="123"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* Complemento */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Complemento</Label>
                    <Input
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="Apto, Bloco..."
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* Bairro */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Bairro</Label>
                    <Input
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Ex: Bela Vista"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* Cidade */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Cidade</Label>
                    <Input
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="São Paulo"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* Estado (UF) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Estado (UF)</Label>
                    <Input
                      value={estado}
                      onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="SP"
                      className="text-xs h-9 border-[#E0E0E0] bg-white uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 border-b border-[#F0F0F0] pt-4 pb-2">
                  <User className="h-4 w-4 text-[#0D47A1]" />
                  <h3 className="text-xs font-bold text-[#212121] uppercase">
                    Canais de Contato e Chave PIX
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Telefone com máscara */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">
                      Telefone / Celular
                    </Label>
                    <Input
                      value={telefone}
                      onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                      placeholder="(11) 98765-4321"
                      className="text-xs h-9 border-[#E0E0E0] bg-white font-mono"
                    />
                  </div>

                  {/* E-mail com validação */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">E-mail</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@dominio.com"
                      className={`text-xs h-9 bg-white ${
                        erros.email ? 'border-red-600 ring-1 ring-red-600' : 'border-[#E0E0E0]'
                      }`}
                    />
                    {erros.email && <span className="text-[11px] text-red-600">{erros.email}</span>}
                  </div>

                  {/* PIX (chave) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Chave PIX</Label>
                    <Input
                      value={pix}
                      onChange={(e) => setPix(e.target.value)}
                      placeholder="CPF, e-mail, celular ou chave aleatória"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* SEÇÃO 3 — DADOS BANCÁRIOS */}
            <TabsContent value="secao3" className="m-0 space-y-4">
              <div className="p-5 rounded-xl bg-white border border-[#E0E0E0] space-y-4">
                <div className="flex items-center gap-2 border-b border-[#F0F0F0] pb-2">
                  <CreditCard className="h-4 w-4 text-[#0D47A1]" />
                  <h3 className="text-xs font-bold text-[#212121] uppercase">
                    Conta para Depósito Salarial
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Banco */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold text-[#616161]">
                      Banco (Nome ou Código)
                    </Label>
                    <Input
                      value={banco}
                      onChange={(e) => setBanco(e.target.value)}
                      placeholder="Ex: Itaú (341), Bradesco (237), Santander, Nubank..."
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>

                  {/* Agência */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Agência</Label>
                    <Input
                      value={agencia}
                      onChange={(e) => setAgencia(e.target.value)}
                      placeholder="0000"
                      className="text-xs h-9 border-[#E0E0E0] bg-white font-mono"
                    />
                  </div>

                  {/* Tipo de Conta */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">Tipo de Conta</Label>
                    <Select value={tipoConta} onValueChange={setTipoConta}>
                      <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#E0E0E0]">
                        <SelectItem value="Corrente">Corrente</SelectItem>
                        <SelectItem value="Poupança">Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Conta com dígito */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold text-[#616161]">
                      Número da Conta (com dígito)
                    </Label>
                    <Input
                      value={conta}
                      onChange={(e) => setConta(e.target.value)}
                      placeholder="00000-0"
                      className="text-xs h-9 border-[#E0E0E0] bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* SEÇÃO 4 — DADOS PROFISSIONAIS */}
            <TabsContent value="secao4" className="m-0 space-y-4">
              <div className="p-5 rounded-xl bg-white border border-[#E0E0E0] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Cargo */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-bold text-[#212121]">
                      Cargo <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      placeholder="Ex: Analista de Recursos Humanos Pleno"
                      className={`text-xs h-9 bg-white ${
                        erros.cargo ? 'border-red-600 ring-1 ring-red-600' : 'border-[#E0E0E0]'
                      }`}
                    />
                    {erros.cargo && <span className="text-[11px] text-red-600">{erros.cargo}</span>}
                  </div>

                  {/* Departamento (dropdown com departamentos do tenant) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-[#212121]">
                      Departamento <span className="text-red-600">*</span>
                    </Label>
                    <Select value={departamento} onValueChange={setDepartamento}>
                      <SelectTrigger
                        className={`text-xs h-9 bg-white ${
                          erros.departamento
                            ? 'border-red-600 ring-1 ring-red-600'
                            : 'border-[#E0E0E0]'
                        }`}
                      >
                        <SelectValue placeholder="Selecione o departamento" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#E0E0E0]">
                        {departamentosTenant.map((dep) => (
                          <SelectItem key={dep} value={dep}>
                            {dep}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {erros.departamento && (
                      <span className="text-[11px] text-red-600">{erros.departamento}</span>
                    )}
                  </div>

                  {/* Data de Admissão: bloqueada para 'rh', editável por 'admin_rh' e 'admin' */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-bold text-[#212121]">
                        Data de Admissão <span className="text-red-600">*</span>
                      </Label>
                      {!podeEditarAdmissaoStatusColaborador && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help">
                              <Lock className="h-3.5 w-3.5 text-amber-600" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-xs">
                            Este campo só pode ser editado pelo Administrador de RH ou Administrador
                            Geral
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Input
                      type="date"
                      value={dataAdmissao}
                      onChange={(e) => setDataAdmissao(e.target.value)}
                      disabled={!podeEditarAdmissaoStatusColaborador}
                      className={`text-xs h-9 ${
                        !podeEditarAdmissaoStatusColaborador
                          ? 'bg-[#EEEEEE] text-[#616161] cursor-not-allowed border-[#BDBDBD]'
                          : erros.dataAdmissao
                            ? 'border-red-600 ring-1 ring-red-600 bg-white'
                            : 'border-[#E0E0E0] bg-white'
                      }`}
                    />
                    {erros.dataAdmissao && (
                      <span className="text-[11px] text-red-600">{erros.dataAdmissao}</span>
                    )}
                  </div>

                  {/* Jornada de Trabalho (ex: 44h/semana, 40h/semana, 30h/semana) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#616161]">
                      Jornada de Trabalho
                    </Label>
                    <Select value={jornada} onValueChange={setJornada}>
                      <SelectTrigger className="text-xs h-9 border-[#E0E0E0] bg-white">
                        <SelectValue placeholder="Selecione a jornada" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#E0E0E0]">
                        <SelectItem value="44h/semana">44h/semana (Integral padrão)</SelectItem>
                        <SelectItem value="40h/semana">40h/semana (Segunda a Sexta)</SelectItem>
                        <SelectItem value="30h/semana">30h/semana (Estágio / Parcial)</SelectItem>
                        <SelectItem value="12x36">Escala 12x36</SelectItem>
                        <SelectItem value="20h/semana">20h/semana (Meio período)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status: bloqueado para 'rh', editável por 'admin_rh' e 'admin' */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-bold text-[#212121]">
                        Status do Colaborador <span className="text-red-600">*</span>
                      </Label>
                      {!podeEditarAdmissaoStatusColaborador && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help">
                              <Lock className="h-3.5 w-3.5 text-amber-600" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-xs">
                            Este campo só pode ser editado pelo Administrador de RH ou Administrador
                            Geral
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {podeEditarAdmissaoStatusColaborador ? (
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger
                          className={`text-xs h-9 bg-white ${
                            erros.status ? 'border-red-600 ring-1 ring-red-600' : 'border-[#E0E0E0]'
                          }`}
                        >
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-[#E0E0E0]">
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={status === 'ativo' ? 'Ativo' : 'Inativo'}
                        disabled
                        className="text-xs h-9 bg-[#EEEEEE] text-[#616161] cursor-not-allowed border-[#BDBDBD]"
                      />
                    )}
                    {erros.status && (
                      <span className="text-[11px] text-red-600">{erros.status}</span>
                    )}
                  </div>

                  {/* Local de Trabalho */}
                  <div className="space-y-1 sm:col-span-3">
                    <Label className="text-xs font-semibold text-[#616161]">
                      Local de Trabalho
                    </Label>
                    <Input
                      value={localTrabalho}
                      onChange={(e) => setLocalTrabalho(e.target.value)}
                      placeholder="Ex: Matriz São Paulo - Sede / Remoto / Híbrido"
                      className="text-xs h-9 border-[#E0E0E0] bg-white"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* SEÇÃO 5 — DEPENDENTES */}
            <TabsContent value="secao5" className="m-0 space-y-4">
              <div className="p-5 rounded-xl bg-white border border-[#E0E0E0] space-y-4">
                <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#0D47A1]" />
                    <h3 className="text-xs font-bold text-[#212121] uppercase">
                      Lista de Dependentes
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAdicionarDependente}
                    className="h-8 text-xs text-[#0D47A1] border-[#0D47A1]/30 hover:bg-blue-50 font-semibold gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar Dependente
                  </Button>
                </div>

                {dependentesList.filter((d) => !d.isDeleted).length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#757575]">
                    Nenhum dependente adicionado. Clique no botão acima para incluir filhos, cônjuge
                    ou dependentes legais.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dependentesList.map((dep, idx) => {
                      if (dep.isDeleted) return null
                      return (
                        <div
                          key={dep.id || idx}
                          className="p-3 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                        >
                          <div className="sm:col-span-5 space-y-1">
                            <Label className="text-[11px] font-semibold text-[#616161]">
                              Nome do Dependente
                            </Label>
                            <Input
                              value={dep.nome}
                              onChange={(e) => {
                                const val = e.target.value
                                setDependentesList((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, nome: val } : item,
                                  ),
                                )
                              }}
                              placeholder="Nome completo"
                              className="text-xs h-8 bg-white border-[#E0E0E0]"
                            />
                          </div>

                          <div className="sm:col-span-3 space-y-1">
                            <Label className="text-[11px] font-semibold text-[#616161]">
                              Parentesco
                            </Label>
                            <Select
                              value={dep.parentesco}
                              onValueChange={(val) => {
                                setDependentesList((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, parentesco: val } : item,
                                  ),
                                )
                              }}
                            >
                              <SelectTrigger className="text-xs h-8 bg-white border-[#E0E0E0]">
                                <SelectValue placeholder="Parentesco" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-[#E0E0E0]">
                                <SelectItem value="Filho(a)">Filho(a)</SelectItem>
                                <SelectItem value="Cônjuge">Cônjuge</SelectItem>
                                <SelectItem value="Companheiro(a)">Companheiro(a)</SelectItem>
                                <SelectItem value="Enteado(a)">Enteado(a)</SelectItem>
                                <SelectItem value="Outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="sm:col-span-3 space-y-1">
                            <Label className="text-[11px] font-semibold text-[#616161]">
                              Data de Nascimento
                            </Label>
                            <Input
                              type="date"
                              value={dep.data_nascimento}
                              onChange={(e) => {
                                const val = e.target.value
                                setDependentesList((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, data_nascimento: val } : item,
                                  ),
                                )
                              }}
                              className="text-xs h-8 bg-white border-[#E0E0E0]"
                            />
                          </div>

                          <div className="sm:col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoverDependente(idx)}
                              className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              title="Remover dependente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* SEÇÃO 6 — CONTATOS DE EMERGÊNCIA */}
            <TabsContent value="secao6" className="m-0 space-y-4">
              <div className="p-5 rounded-xl bg-white border border-[#E0E0E0] space-y-4">
                <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-4 w-4 text-[#0D47A1]" />
                    <h3 className="text-xs font-bold text-[#212121] uppercase">
                      Contatos de Emergência
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAdicionarContato}
                    className="h-8 text-xs text-[#0D47A1] border-[#0D47A1]/30 hover:bg-blue-50 font-semibold gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar Contato de Emergência
                  </Button>
                </div>

                {contatosList.filter((c) => !c.isDeleted).length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#757575]">
                    Nenhum contato de emergência cadastrado. Adicione pelo menos um contato para
                    situações críticas.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contatosList.map((cont, idx) => {
                      if (cont.isDeleted) return null
                      return (
                        <div
                          key={cont.id || idx}
                          className="p-3 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                        >
                          <div className="sm:col-span-5 space-y-1">
                            <Label className="text-[11px] font-semibold text-[#616161]">
                              Nome do Contato
                            </Label>
                            <Input
                              value={cont.nome}
                              onChange={(e) => {
                                const val = e.target.value
                                setContatosList((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, nome: val } : item,
                                  ),
                                )
                              }}
                              placeholder="Nome da pessoa"
                              className="text-xs h-8 bg-white border-[#E0E0E0]"
                            />
                          </div>

                          <div className="sm:col-span-3 space-y-1">
                            <Label className="text-[11px] font-semibold text-[#616161]">
                              Telefone / Celular
                            </Label>
                            <Input
                              value={cont.telefone}
                              onChange={(e) => {
                                const val = formatarTelefone(e.target.value)
                                setContatosList((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, telefone: val } : item,
                                  ),
                                )
                              }}
                              placeholder="(00) 00000-0000"
                              className="text-xs h-8 bg-white border-[#E0E0E0] font-mono"
                            />
                          </div>

                          <div className="sm:col-span-3 space-y-1">
                            <Label className="text-[11px] font-semibold text-[#616161]">
                              Parentesco / Relação
                            </Label>
                            <Input
                              value={cont.parentesco}
                              onChange={(e) => {
                                const val = e.target.value
                                setContatosList((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, parentesco: val } : item,
                                  ),
                                )
                              }}
                              placeholder="Ex: Cônjuge, Mãe, Irmão"
                              className="text-xs h-8 bg-white border-[#E0E0E0]"
                            />
                          </div>

                          <div className="sm:col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoverContato(idx)}
                              className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              title="Remover contato"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Rodapé com botões Cancelar e Salvar */}
        <div className="bg-white border-t border-[#E0E0E0] px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#757575] flex items-center gap-1.5 hidden sm:flex">
            <Info className="h-3.5 w-3.5 text-[#0D47A1]" />
            <span>Campos marcados com (*) são de preenchimento obrigatório.</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={salvando}
              className="text-xs h-9 px-4 border-[#E0E0E0] text-[#616161] hover:bg-slate-100"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSalvar}
              disabled={salvando || loading}
              className="text-xs h-9 px-5 bg-[#0D47A1] hover:bg-[#0A3A82] text-white font-semibold gap-1.5 shadow-xs"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando alterações...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
