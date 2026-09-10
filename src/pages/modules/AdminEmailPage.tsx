import React, { useState, useEffect, useCallback } from 'react'
import {
  Mail,
  Send,
  Server,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Save,
  HelpCircle,
  MailCheck,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { emailTransacionalService } from '@/services/emailService'
import { SmtpConfig, EmailLog } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminEmailPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const tenantId = user?.tenant_id

  const [loadingConfig, setLoadingConfig] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)

  const [configId, setConfigId] = useState<string | undefined>(undefined)
  const [host, setHost] = useState('')
  const [porta, setPorta] = useState<number>(587)
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [remetenteNome, setRemetenteNome] = useState('Gente e Gestão Tesla')
  const [remetenteEmail, setRemetenteEmail] = useState('noreply@teslarh.com.br')
  const [ativo, setAtivo] = useState(false)
  const [tls, setTls] = useState(true)

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
        setAtivo(Boolean(config.ativo))
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
      const data = await emailTransacionalService.getEmailLogs(tenantId, 60)
      setLogs(data)
    } catch (err) {
      console.error('Erro ao carregar logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }, [tenantId])

  useEffect(() => {
    carregarConfig()
    carregarLogs()
  }, [carregarConfig, carregarLogs])

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
      toast({
        title: 'Configurações salvas',
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
    try {
      setTestando(true)
      const res = await emailTransacionalService.testarEnvioSmtp()
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
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#E8EEF7] flex items-center justify-center text-[#0D47A1]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
                Configurações de E-mail (SMTP)
              </h1>
              <p className="text-xs text-[#757575] mt-0.5">
                Defina o servidor de correio do seu tenant para entrega real de e-mails de
                notificações corporativas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              ativo
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 gap-1'
                : 'bg-amber-50 text-amber-700 border-amber-300 gap-1'
            }
          >
            {ativo ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                SMTP Ativo
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                SMTP Inativo (Notificações Pendentes de Envio)
              </>
            )}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="bg-white border border-[#E0E0E0] p-1">
          <TabsTrigger
            value="config"
            className="text-xs data-[state=active]:bg-[#E8EEF7] data-[state=active]:text-[#0D47A1] font-semibold"
          >
            Servidor SMTP
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
                            <Label className="text-xs font-semibold text-[#212121]">
                              Serviço Ativo
                            </Label>
                            <p className="text-[11px] text-[#757575]">
                              Disparar e-mails para notificações reais
                            </p>
                          </div>
                          <Switch checked={ativo} onCheckedChange={setAtivo} />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-[#FAFAFA] border border-[#E0E0E0]">
                          <div className="space-y-0.5">
                            <Label className="text-xs font-semibold text-[#212121]">
                              Usar Criptografia TLS / STARTTLS
                            </Label>
                            <p className="text-[11px] text-[#757575]">
                              Recomendado para porta 587 ou 465
                            </p>
                          </div>
                          <Switch checked={tls} onCheckedChange={setTls} />
                        </div>
                      </div>

                      {/* Botões */}
                      <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTestarEnvio}
                          disabled={salvando || testando || !ativo}
                          className="h-9 text-xs border-[#0D47A1]/30 text-[#0D47A1] hover:bg-[#E8EEF7] gap-1.5"
                        >
                          <Send className={`h-3.5 w-3.5 ${testando ? 'animate-pulse' : ''}`} />
                          {testando ? 'Enviando teste...' : 'Testar Envio (Meu E-mail)'}
                        </Button>

                        <Button
                          type="submit"
                          disabled={salvando || testando}
                          className="h-9 text-xs font-semibold bg-[#0D47A1] hover:bg-[#0A3A82] text-white gap-1.5"
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
                      <li>Aprovação / Recusa / Cancelamento de Férias</li>
                      <li>Resposta de compensação de banco de horas</li>
                      <li>Validação de atestado médico pelo RH</li>
                      <li>Novo holerite disponibilizado</li>
                      <li>Publicação de comunicado corporativo</li>
                      <li>Decisão de alteração cadastral</li>
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

        {/* TAB 2: Diagnóstico e Logs */}
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
                        <th className="py-3 min-w-[220px]">Assunto</th>
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
                            <td className="py-3 text-[#424242]">{log.assunto}</td>
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
