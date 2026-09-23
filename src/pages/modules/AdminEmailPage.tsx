import React, { useState, useEffect, useCallback } from 'react'
import {
  Mail,
  Send,
  Server,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Save,
  HelpCircle,
  MailCheck,
  Calendar,
  Users,
  Inbox,
  Play,
  FileCheck2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { emailTransacionalService, DigestPreviewInfo } from '@/services/emailService'
import { logAuditoriaService } from '@/services/api'
import { SmtpConfig, EmailLog } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { TESLA_LOGO_URL } from '@/lib/logoAsset'

export default function AdminEmailPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const tenantId = user?.tenant_id

  const [loadingConfig, setLoadingConfig] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)

  // Estados do Digest Diário
  const [loadingDigest, setLoadingDigest] = useState(false)
  const [disparandoDigest, setDisparandoDigest] = useState(false)
  const [digestPreview, setDigestPreview] = useState<DigestPreviewInfo | null>(null)
  const [forcarVazio, setForcarVazio] = useState(false)
  const [ignorarIdempotencia, setIgnorarIdempotencia] = useState(false)

  const [configId, setConfigId] = useState<string | undefined>(undefined)
  const [host, setHost] = useState('')
  const [porta, setPorta] = useState<number>(587)
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [remetenteNome, setRemetenteNome] = useState('Gente e Gestão Tesla')
  const [remetenteEmail, setRemetenteEmail] = useState('noreply@teslarh.com.br')
  const [ativo, setAtivo] = useState(false)
  const [tls, setTls] = useState(true)
  const [emailDestinoTeste, setEmailDestinoTeste] = useState('')

  const [logs, setLogs] = useState<EmailLog[]>([])

  const carregarConfig = useCallback(async () => {
    if (!tenantId) return
    try {
      setLoadingConfig(true)
      const config = await emailTransacionalService.getSmtpConfig(tenantId)
      if (config) {
        setConfigId(config.id)
        setHost(config.host || '')
        setPorta(config.porta || 587)
        setUsuario(config.usuario || '')
        // Não expor a senha no formulário por segurança (placeholder indica se já há salva)
        setSenha('')
        setRemetenteNome(config.remetente_nome || 'Gente e Gestão Tesla')
        setRemetenteEmail(config.remetente_email || 'noreply@teslarh.com.br')
        setAtivo(Boolean(config.ativo && config.host))
        setTls(config.tls !== false)
      }
    } catch (err) {
      console.error('Erro ao carregar SMTP:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar a configuração SMTP.',
        variant: 'destructive',
      })
    } finally {
      setLoadingConfig(false)
    }
  }, [tenantId, toast])

  const carregarLogs = useCallback(async () => {
    if (!tenantId) return
    try {
      setLoadingLogs(true)
      const data = await emailTransacionalService.getEmailLogs(tenantId, 100)
      setLogs(data)
    } catch (err) {
      console.error('Erro ao carregar logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }, [tenantId])

  const carregarDigestPreview = useCallback(async () => {
    if (!tenantId) return
    try {
      setLoadingDigest(true)
      const info = await emailTransacionalService.getDigestPreview()
      setDigestPreview(info)
    } catch (err) {
      console.error('Erro ao carregar prévia do digest:', err)
    } finally {
      setLoadingDigest(false)
    }
  }, [tenantId])

  useEffect(() => {
    carregarConfig()
    carregarLogs()
    carregarDigestPreview()
    if (user?.email && !emailDestinoTeste) {
      setEmailDestinoTeste(user.email)
    }
  }, [carregarConfig, carregarLogs, carregarDigestPreview, user?.email])

  const handleDispararDigestManual = async () => {
    if (!tenantId) return
    try {
      setDisparandoDigest(true)
      const res = await emailTransacionalService.dispararDigestManual({
        forcarVazio,
        ignorarIdempotencia,
      })

      if (user?.id) {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: 'disparo_digest_diario',
          entidade: 'email_log',
          entidade_id: 'digest_diario',
          dados_json: {
            forcarVazio,
            ignorarIdempotencia,
            resultado: res,
          },
        })
      }

      toast({
        title: res.enviado
          ? 'Digest Diário Enviado!'
          : res.status === 'pendente_envio'
            ? 'Registrado na Auditoria (SMTP Inativo)'
            : res.jaEnviado
              ? 'Digest Já Enviado Hoje'
              : 'Processamento do Digest Concluído',
        description: res.message,
        variant: res.status === 'falha' ? 'destructive' : 'default',
      })

      // Recarrega logs e prévia
      await Promise.all([carregarLogs(), carregarDigestPreview()])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao disparar digest diário.'
      toast({
        title: 'Erro ao disparar digest',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setDisparandoDigest(false)
    }
  }

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) return

    if (!host.trim() || !remetenteEmail.trim() || !remetenteNome.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o servidor host, o e-mail e o nome do remetente.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)
      const salvo = await emailTransacionalService.salvarSmtpConfig(tenantId, {
        id: configId,
        host: host.trim(),
        porta: Number(porta),
        usuario: usuario.trim(),
        senha: senha.trim() || undefined,
        remetente_nome: remetenteNome.trim(),
        remetente_email: remetenteEmail.trim(),
        ativo,
        tls,
      })

      setConfigId(salvo.id)
      setSenha('')

      // Log de Auditoria ao salvar configuração (sem registrar a senha!)
      if (user?.id) {
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: user.id,
          acao: configId ? 'edicao_config_smtp' : 'criacao_config_smtp',
          entidade: 'smtp_config',
          entidade_id: salvo.id,
          dados_json: {
            host: salvo.host,
            porta: salvo.porta,
            usuario: salvo.usuario,
            remetente_nome: salvo.remetente_nome,
            remetente_email: salvo.remetente_email,
            ativo: salvo.ativo,
            tls: salvo.tls,
            senha_alterada: Boolean(senha.trim()),
          },
        })
      }

      toast({
        title: 'Configurações salvas com sucesso',
        description: 'Os parâmetros SMTP foram gravados com sucesso para o tenant.',
      })
    } catch (err: unknown) {
      console.error('Erro ao salvar SMTP:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao salvar configuração.'
      toast({
        title: 'Erro ao salvar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleTestarEnvio = async () => {
    if (!host.trim()) {
      toast({
        title: 'SMTP não configurado',
        description:
          'Informe e salve as configurações de host, porta e credenciais antes de testar.',
        variant: 'destructive',
      })
      return
    }

    const destinatario = emailDestinoTeste.trim() || user?.email
    if (!destinatario) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Informe um e-mail de destino válido para receber a mensagem de teste.',
        variant: 'destructive',
      })
      return
    }

    try {
      setTestando(true)
      const res = await emailTransacionalService.testarEnvioSmtp(destinatario)
      if (res.success) {
        toast({
          title: 'E-mail de teste enviado!',
          description: res.message,
        })
      } else {
        toast({
          title: 'Falha no teste de envio',
          description: res.message || 'Verifique as credenciais e tente novamente.',
          variant: 'destructive',
        })
      }
      // Atualiza aba de logs
      carregarLogs()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao conectar ao servidor SMTP.'
      toast({
        title: 'Erro ao testar envio',
        description: msg,
        variant: 'destructive',
      })
      carregarLogs()
    } finally {
      setTestando(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
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
                Configurações de E-mail (SMTP)
              </h1>
              <Badge
                variant="outline"
                className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-xs font-semibold"
              >
                Comunicação & Disparos
              </Badge>
            </div>
            <p className="text-xs text-[#757575] mt-0.5">
              Defina o servidor de correio do seu tenant para entrega real de e-mails de
              notificações corporativas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!host.trim() ? (
            <Badge
              variant="outline"
              className="bg-slate-100 text-slate-700 border-slate-300 gap-1.5 py-1 px-3 text-xs"
            >
              <AlertCircle className="h-3.5 w-3.5 text-slate-500" />
              SMTP não configurado
            </Badge>
          ) : ativo ? (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1.5 py-1 px-3 text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              SMTP Ativo
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-300 gap-1.5 py-1 px-3 text-xs"
            >
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              SMTP Inativo (Notificações Pendentes)
            </Badge>
          )}
        </div>
      </div>

      {/* Alerta de aviso se SMTP não configurado */}
      {!host.trim() && !loadingConfig && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 flex items-start gap-3 text-xs text-amber-900">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-amber-950">Provedor SMTP não configurado</p>
            <p className="text-amber-800">
              Para habilitar o envio automático de notificações por e-mail para colaboradores e
              gestores, cadastre o host, porta e credenciais do seu provedor abaixo e ative o
              serviço.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="bg-white border border-[#E0E0E0] p-1">
          <TabsTrigger
            value="config"
            className="text-xs data-[state=active]:bg-[#E8EEF7] data-[state=active]:text-[#0D47A1] font-semibold"
          >
            Servidor SMTP
          </TabsTrigger>
          <TabsTrigger
            value="digest"
            onClick={carregarDigestPreview}
            className="text-xs data-[state=active]:bg-[#E8EEF7] data-[state=active]:text-[#0D47A1] font-semibold flex items-center gap-1.5"
          >
            <Inbox className="h-3.5 w-3.5" />
            Digest Diário do RH
            {digestPreview?.jaEnviadoHoje && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            onClick={carregarLogs}
            className="text-xs data-[state=active]:bg-[#E8EEF7] data-[state=active]:text-[#0D47A1] font-semibold"
          >
            Diagnóstico e Logs de Envio ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Formulário SMTP */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2">
              <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                  <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                    <Server className="h-4.5 w-4.5 text-[#0D47A1]" />
                    Parâmetros do Provedor de E-mail
                  </CardTitle>
                  <CardDescription className="text-xs text-[#757575]">
                    Cadastre os dados de autenticação SMTP corporativo da Tesla ou do seu provedor
                    (Gmail Corporativo, Microsoft 365, Amazon SES, etc.).
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-5">
                  {loadingConfig ? (
                    <div className="space-y-4 py-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <form onSubmit={handleSalvarConfig} className="space-y-4">
                      {/* Host e Porta */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label htmlFor="host" className="text-xs font-semibold text-[#212121]">
                            Servidor SMTP (Host) *
                          </Label>
                          <Input
                            id="host"
                            placeholder="ex: smtp.office365.com ou smtp.gmail.com"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            required
                            className="text-xs h-9 border-[#E0E0E0]"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="porta" className="text-xs font-semibold text-[#212121]">
                            Porta *
                          </Label>
                          <Input
                            id="porta"
                            type="number"
                            placeholder="587"
                            value={porta}
                            onChange={(e) => setPorta(Number(e.target.value))}
                            required
                            className="text-xs h-9 border-[#E0E0E0]"
                          />
                        </div>
                      </div>

                      {/* Usuário e Senha */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="usuario" className="text-xs font-semibold text-[#212121]">
                            Usuário / Conta de Autenticação
                          </Label>
                          <Input
                            id="usuario"
                            placeholder="ex: rh-notificacoes@teslarh.com.br"
                            value={usuario}
                            onChange={(e) => setUsuario(e.target.value)}
                            className="text-xs h-9 border-[#E0E0E0]"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="senha" className="text-xs font-semibold text-[#212121]">
                            Senha / Senha de Aplicativo
                          </Label>
                          <Input
                            id="senha"
                            type="password"
                            placeholder={
                              configId ? '•••••••• (manter atual)' : 'Digite a senha do SMTP'
                            }
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            className="text-xs h-9 border-[#E0E0E0]"
                          />
                        </div>
                      </div>

                      {/* Remetente Nome e Email */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="remetenteNome"
                            className="text-xs font-semibold text-[#212121]"
                          >
                            Nome do Remetente *
                          </Label>
                          <Input
                            id="remetenteNome"
                            placeholder="Ex: Gente e Gestão Tesla"
                            value={remetenteNome}
                            onChange={(e) => setRemetenteNome(e.target.value)}
                            required
                            className="text-xs h-9 border-[#E0E0E0]"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="remetenteEmail"
                            className="text-xs font-semibold text-[#212121]"
                          >
                            E-mail Remetente *
                          </Label>
                          <Input
                            id="remetenteEmail"
                            type="email"
                            placeholder="noreply@teslarh.com.br"
                            value={remetenteEmail}
                            onChange={(e) => setRemetenteEmail(e.target.value)}
                            required
                            className="text-xs h-9 border-[#E0E0E0]"
                          />
                        </div>
                      </div>

                      {/* Switches: Ativo e TLS */}
                      <div className="pt-2 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-[#F0F0F0]">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[#FAFAFA] border border-[#E0E0E0]">
                          <div className="space-y-0.5">
                            <Label
                              htmlFor="switch-ativo-smtp"
                              className="text-xs font-semibold text-[#212121]"
                            >
                              Serviço Ativo
                            </Label>
                            <p className="text-[11px] text-[#757575]">
                              Disparar e-mails para notificações reais
                            </p>
                          </div>
                          <Switch
                            id="switch-ativo-smtp"
                            checked={ativo}
                            onCheckedChange={setAtivo}
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-[#FAFAFA] border border-[#E0E0E0]">
                          <div className="space-y-0.5">
                            <Label
                              htmlFor="switch-tls-smtp"
                              className="text-xs font-semibold text-[#212121]"
                            >
                              Criptografia TLS / SSL (STARTTLS)
                            </Label>
                            <p className="text-[11px] text-[#757575]">
                              Recomendado para porta 587 ou 465
                            </p>
                          </div>
                          <Switch id="switch-tls-smtp" checked={tls} onCheckedChange={setTls} />
                        </div>
                      </div>

                      {/* Seção Teste de Envio */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-[#E0E0E0] space-y-3">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor="emailDestinoTeste"
                            className="text-xs font-bold text-[#212121] flex items-center gap-1.5"
                          >
                            <Send className="h-3.5 w-3.5 text-[#0D47A1]" />
                            Enviar E-mail de Teste
                          </Label>
                          <span className="text-[10px] text-[#757575]">
                            Valida a autenticação e entrega imediata
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            id="emailDestinoTeste"
                            type="email"
                            placeholder="Informe o e-mail que receberá o teste..."
                            value={emailDestinoTeste}
                            onChange={(e) => setEmailDestinoTeste(e.target.value)}
                            className="text-xs h-9 bg-white border-[#E0E0E0] flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleTestarEnvio}
                            disabled={salvando || testando || !ativo || !host.trim()}
                            className="h-9 text-xs border-[#0D47A1]/40 text-[#0D47A1] hover:bg-[#E8EEF7] gap-1.5 shrink-0 font-semibold"
                          >
                            <Send className={`h-3.5 w-3.5 ${testando ? 'animate-spin' : ''}`} />
                            {testando ? 'Enviando...' : 'Enviar e-mail de teste'}
                          </Button>
                        </div>
                        {(!ativo || !host.trim()) && (
                          <p className="text-[10px] text-amber-700">
                            * Para testar, preencha os dados de host/porta, ative o switch "Serviço
                            Ativo" e salve a configuração.
                          </p>
                        )}
                      </div>

                      {/* Botões */}
                      <div className="pt-2 flex items-center justify-end gap-3 flex-wrap">
                        <Button
                          type="submit"
                          disabled={salvando || testando}
                          className="h-9 px-5 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white gap-1.5 shadow-xs"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {salvando ? 'Salvando...' : 'Salvar Configuração'}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Informações e Ajuda */}
            <div className="space-y-4">
              <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                  <CardTitle className="text-sm font-bold text-[#212121] flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Entrega Plug-and-Play
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 text-xs space-y-3 text-[#616161]">
                  <p>
                    Assim que você preencher o host, usuário e senha válidos e salvar com{' '}
                    <strong>Serviço Ativo</strong>, os e-mails começam a sair automaticamente sem
                    necessidade de reiniciar o sistema ou alterar códigos.
                  </p>
                  <p>
                    Se o SMTP estiver desligado ou não configurado, nenhuma notificação in-app é
                    perdida: o sistema registra o status como{' '}
                    <span className="font-semibold text-amber-700">pendente_envio</span> e tudo
                    continua operando normalmente.
                  </p>
                  <div className="p-3 bg-[#E8EEF7] rounded-lg text-[#0D47A1] text-[11px] space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <MailCheck className="h-3.5 w-3.5" /> E-mails automáticos integrados:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                      <li>Solicitação cadastral pendente do colaborador (para RH/Admin)</li>
                      <li>
                        Resultado da alteração cadastral aprovada/recusada (para o colaborador)
                      </li>
                      <li>Mudança de função/cargo registrada no histórico</li>
                      <li>Novo holerite emitido ou importado para a competência</li>
                      <li>Novo comunicado corporativo (inclusive com confirmação obrigatória)</li>
                      <li>Aprovação / Recusa de Férias e Compensação de Banco de Horas</li>
                      <li>Validação e retorno de Atestados Médicos</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-[#E0E0E0] bg-[#FAFAFA] shadow-xs">
                <CardContent className="p-4 text-xs text-[#757575] space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#212121]">
                    <HelpCircle className="h-4 w-4 text-[#0D47A1]" />
                    Dica de Provedores
                  </div>
                  <p className="text-[11px]">
                    <strong>Microsoft 365:</strong> Host <code>smtp.office365.com</code>, porta 587,
                    TLS ativo. Requer conta com SMTP AUTH ativado no Centro de Administração M365.
                  </p>
                  <p className="text-[11px]">
                    <strong>Gmail:</strong> Host <code>smtp.gmail.com</code>, porta 587. Requer
                    habilitar 2FA e gerar uma <em>Senha de Aplicativo</em> de 16 caracteres.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Digest Diário do RH */}
        <TabsContent value="digest" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                        <Inbox className="h-4.5 w-4.5 text-[#0D47A1]" />
                        Digest Diário Corporativo para o RH
                      </CardTitle>
                      <CardDescription className="text-xs text-[#757575] mt-0.5">
                        Resumo consolidado e único por dia às 08:00 (horário de Brasília) para os
                        gestores e analistas de RH do tenant, evitando acúmulo de e-mails
                        individuais.
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      {digestPreview?.jaEnviadoHoje ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs font-semibold gap-1 py-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Enviado Hoje
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-slate-100 text-slate-700 border-slate-300 text-xs font-semibold gap-1 py-1"
                        >
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          Próximo Disparo: 08:00
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-5">
                  {/* Cron Info Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA]">
                      <span className="text-[10px] font-bold uppercase text-[#757575] tracking-wide">
                        Agendamento
                      </span>
                      <p className="text-sm font-bold text-[#212121] mt-0.5 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-[#0D47A1]" />
                        08:00 (America/SP)
                      </p>
                      <p className="text-[10px] text-[#757575] font-mono mt-0.5">
                        Cron: 0 11 * * * (11h UTC)
                      </p>
                    </div>

                    <div className="p-3.5 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA]">
                      <span className="text-[10px] font-bold uppercase text-[#757575] tracking-wide">
                        Anti-Duplicação
                      </span>
                      <p className="text-sm font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />1 por tenant / dia
                      </p>
                      <p className="text-[10px] text-[#757575] mt-0.5">Idempotência por data</p>
                    </div>

                    <div className="p-3.5 rounded-lg border border-[#E0E0E0] bg-[#FAFAFA]">
                      <span className="text-[10px] font-bold uppercase text-[#757575] tracking-wide">
                        Regra de Envio Vazio
                      </span>
                      <p className="text-sm font-bold text-[#0D47A1] mt-0.5 flex items-center gap-1.5">
                        <FileCheck2 className="h-3.5 w-3.5" />
                        Omitir se zerado
                      </p>
                      <p className="text-[10px] text-[#757575] mt-0.5">
                        Não envia e-mail sem pendência
                      </p>
                    </div>
                  </div>

                  {/* Métricas Atuais para o Digest */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#212121] uppercase tracking-wide">
                        Pendências Monitoradas em Tempo Real no Tenant
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={carregarDigestPreview}
                        disabled={loadingDigest}
                        className="h-7 text-xs text-[#0D47A1] hover:bg-[#E8EEF7] gap-1 px-2"
                      >
                        <RefreshCw className={`h-3 w-3 ${loadingDigest ? 'animate-spin' : ''}`} />
                        Atualizar Contadores
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-lg border border-[#E0E0E0] bg-white">
                        <span className="text-[10px] text-[#757575] block">
                          Alterações Cadastrais
                        </span>
                        <span className="text-lg font-bold text-[#0D47A1]">
                          {loadingDigest ? (
                            <Skeleton className="h-6 w-8" />
                          ) : (
                            (digestPreview?.metricas.alteracoesCadastrais ?? 0)
                          )}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg border border-[#E0E0E0] bg-white">
                        <span className="text-[10px] text-[#757575] block">
                          Férias para Aprovar
                        </span>
                        <span className="text-lg font-bold text-[#0D47A1]">
                          {loadingDigest ? (
                            <Skeleton className="h-6 w-8" />
                          ) : (
                            (digestPreview?.metricas.feriasPendentes ?? 0)
                          )}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg border border-[#E0E0E0] bg-white">
                        <span className="text-[10px] text-[#757575] block">
                          Atestados para Validar
                        </span>
                        <span className="text-lg font-bold text-[#0D47A1]">
                          {loadingDigest ? (
                            <Skeleton className="h-6 w-8" />
                          ) : (
                            (digestPreview?.metricas.atestadosPendentes ?? 0)
                          )}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg border border-[#E0E0E0] bg-white">
                        <span className="text-[10px] text-[#757575] block">
                          Compensações de Horas
                        </span>
                        <span className="text-lg font-bold text-[#0D47A1]">
                          {loadingDigest ? (
                            <Skeleton className="h-6 w-8" />
                          ) : (
                            (digestPreview?.metricas.compensacoesPendentes ?? 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Disparo Manual e Teste Imediato */}
                  <div className="p-4 rounded-xl border border-[#E0E0E0] bg-slate-50 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-[#212121] flex items-center gap-1.5">
                          <Play className="h-3.5 w-3.5 text-[#0D47A1]" />
                          Disparo Manual Sob Demanda
                        </h4>
                        <p className="text-[11px] text-[#757575]">
                          Útil para homologação, testes de entrega e disparos pontuais antes do
                          horário programado.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forcarVazio}
                          onChange={(e) => setForcarVazio(e.target.checked)}
                          className="rounded border-[#BDBDBD] text-[#0D47A1] focus:ring-[#0D47A1]"
                        />
                        <span className="text-[#424242]">
                          Forçar envio mesmo sem pendências (modo teste)
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ignorarIdempotencia}
                          onChange={(e) => setIgnorarIdempotencia(e.target.checked)}
                          className="rounded border-[#BDBDBD] text-[#0D47A1] focus:ring-[#0D47A1]"
                        />
                        <span className="text-[#424242]">
                          Ignorar checagem se já foi enviado hoje
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#757575]">
                        Destinatários: {digestPreview?.destinatarios.length || 0} usuário(s) de RH
                      </span>

                      <Button
                        type="button"
                        onClick={handleDispararDigestManual}
                        disabled={disparandoDigest || loadingDigest}
                        className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white text-xs h-9 px-4 gap-1.5 font-semibold shadow-xs"
                      >
                        <Send className={`h-3.5 w-3.5 ${disparandoDigest ? 'animate-spin' : ''}`} />
                        {disparandoDigest ? 'Processando Digest...' : 'Disparar Digest Agora'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Painel lateral de Destinatários do Digest */}
            <div className="space-y-4">
              <Card className="border border-[#E0E0E0] bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-[#F0F0F0]">
                  <CardTitle className="text-sm font-bold text-[#212121] flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#0D47A1]" />
                    Destinatários de RH do Tenant
                  </CardTitle>
                  <CardDescription className="text-xs text-[#757575]">
                    Usuários ativos com perfil RH, Admin RH ou Admin que recebem o digest único.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-3">
                  {loadingDigest ? (
                    <div className="space-y-2 py-2">
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ) : !digestPreview?.destinatarios || digestPreview.destinatarios.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#757575]">
                      Nenhum usuário com perfil de RH e e-mail ativo encontrado.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F0F0F0]">
                      {digestPreview.destinatarios.map((d, idx) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-[#212121]">{d.nome || 'Usuário RH'}</p>
                            <p className="text-[11px] text-[#757575] font-mono">{d.email}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-[10px] uppercase font-mono font-bold"
                          >
                            {d.perfil}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-[#E0E0E0] bg-[#FAFAFA] shadow-xs">
                <CardContent className="p-4 text-xs text-[#757575] space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#212121]">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Auditoria & Rastreabilidade
                  </div>
                  <p className="text-[11px]">
                    Cada disparo do Digest Diário é registrado com o identificador de tipo de evento{' '}
                    <code>digest_diario</code> na aba <strong>Diagnóstico e Logs de Envio</strong> e
                    na trilha oficial de conformidade de <strong>Logs de Auditoria</strong>.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: Diagnóstico e Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#F0F0F0] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#212121] flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-[#0D47A1]" />
                  Histórico de Disparos de E-mail
                </CardTitle>
                <CardDescription className="text-xs text-[#757575]">
                  Últimos 60 registros de tentativas de envio de e-mails para diagnóstico técnico do
                  tenant.
                </CardDescription>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={carregarLogs}
                disabled={loadingLogs}
                className="h-8 text-xs border-[#E0E0E0] gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                Atualizar Logs
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {loadingLogs ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-10 w-full bg-slate-100" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#757575]">
                  Nenhum log de e-mail registrado até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E0E0E0] bg-[#FAFAFA] text-[#757575] font-semibold uppercase text-[10px]">
                        <th className="py-3 pl-4 min-w-[150px]">Data e Hora</th>
                        <th className="py-3 min-w-[200px]">Destinatário</th>
                        <th className="py-3 min-w-[220px]">Assunto / Tipo</th>
                        <th className="py-3 min-w-[120px]">Status</th>
                        <th className="py-3 pr-4 min-w-[200px]">Diagnóstico / Erro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F5]">
                      {logs.map((log) => {
                        const dataStr = new Date(log.created).toLocaleString('pt-BR')
                        return (
                          <tr key={log.id} className="hover:bg-[#FAFAFA] transition-colors">
                            <td className="py-3 pl-4 font-mono text-[11px] text-[#616161]">
                              {dataStr}
                            </td>
                            <td className="py-3 font-medium text-[#212121]">{log.destinatario}</td>
                            <td className="py-3 text-[#424242]">
                              <p className="font-semibold">{log.assunto}</p>
                              {log.tipo_evento && (
                                <span className="inline-block mt-0.5 text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                                  {log.tipo_evento}
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              {log.status === 'enviado' ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] gap-1"
                                >
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  Enviado
                                </Badge>
                              ) : log.status === 'pendente_envio' ? (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1"
                                >
                                  <Clock className="h-3 w-3 text-amber-600" />
                                  Pendente Envio
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-rose-50 text-rose-800 border-rose-300 text-[10px] gap-1"
                                >
                                  <AlertCircle className="h-3 w-3 text-rose-600" />
                                  Falha
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-[11px] text-[#757575]">
                              {log.erro ? (
                                <span className="text-rose-700 font-mono text-[10px] line-clamp-2">
                                  {log.erro}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
