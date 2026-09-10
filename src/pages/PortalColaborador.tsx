import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  User,
  Palmtree,
  Gift,
  FileCheck,
  Plus,
  Calendar,
  Layers,
  ChevronRight,
  Megaphone,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  Shield,
  Eye,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { comunicadoService } from '@/services/api'
import {
  Comunicado,
  ComunicadoCategoria,
  COMUNICADO_CATEGORIAS,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'

export default function PortalColaborador() {
  const navigate = useNavigate()
  const { user, colaborador } = useAuth()
  const { toast } = useToast()

  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todos')
  const [modalComunicado, setModalComunicado] = useState<Comunicado | null>(null)

  // Perfil e regras de permissão
  const perfil = user?.perfil || 'colaborador'
  const canPublish = perfil === 'admin' || perfil === 'rh'
  const badgeStyle = PROFILE_BADGE_COLORS[perfil]

  // Nome exibido na saudação
  const primeiroNome = useMemo(() => {
    const raw = colaborador?.nome || user?.name || 'Colaborador'
    return raw.trim().split(' ')[0]
  }, [colaborador?.nome, user?.name])

  const nomeCompleto = colaborador?.nome || user?.name || 'Colaborador'

  // Carrega comunicados do tenant do usuário
  useEffect(() => {
    async function loadData() {
      if (!user?.tenant_id) return
      try {
        setLoading(true)
        // No mural do colaborador, apenas comunicados ativos são exibidos
        const allComunicados = await comunicadoService.getComunicados(user.tenant_id, true)
        // Aplica RLS e regras de segmentação locais por perfil/setor/cargo
        const visiveis = comunicadoService.filtrarPorPerfil(allComunicados, perfil, colaborador)
        setComunicados(visiveis)
      } catch (err) {
        console.error('Erro ao carregar comunicados:', err)
        toast({
          title: 'Erro ao carregar mural',
          description: 'Não foi possível carregar os comunicados do mural.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user?.tenant_id, perfil, colaborador, toast])

  // Lista de categorias filtradas
  const categoriasList: ComunicadoCategoria[] = [
    'RH',
    'Empresa',
    'Qualidade',
    'Segurança',
    'Benefícios',
  ]

  // Comunicados filtrados pela categoria selecionada na barra de tags
  const comunicadosFiltrados = useMemo(() => {
    if (selectedCategoria === 'todos') {
      return comunicados
    }
    return comunicados.filter((c) => c.categoria === selectedCategoria)
  }, [comunicados, selectedCategoria])

  // Contagem por categoria para as tags
  const contagemPorCategoria = useMemo(() => {
    const map: Record<string, number> = { todos: comunicados.length }
    categoriasList.forEach((cat) => {
      map[cat] = comunicados.filter((c) => c.categoria === cat).length
    })
    return map
  }, [comunicados])

  // Formatação de data em pt-BR
  const formatarDataPublicacao = (dateStr?: string) => {
    if (!dateStr) return 'Data recente'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  // Atalhos de navegação do Portal do Colaborador
  const atalhos = [
    {
      title: 'Meu Ponto',
      subtitle: 'Batidas e espelho',
      path: '/ponto',
      icon: Clock,
      color: 'bg-blue-50 text-[#0D47A1] border-blue-200 hover:border-[#0D47A1]/50',
    },
    {
      title: 'Banco de Horas',
      subtitle: 'Saldo e fechamentos',
      path: '/banco-horas',
      icon: Clock,
      color: 'bg-blue-50 text-[#0D47A1] border-blue-200 hover:border-[#0D47A1]/50',
    },
    {
      title: 'Demonstrativo',
      subtitle: 'Holerite e proventos',
      path: '/demonstrativo',
      icon: FileText,
      color: 'bg-blue-50 text-[#0D47A1] border-blue-200 hover:border-[#0D47A1]/50',
    },
    {
      title: 'Docs Importantes',
      subtitle: 'Normas e ciências',
      path: '/documentos-importantes',
      icon: Shield,
      color: 'bg-blue-50 text-[#0D47A1] border-blue-100 hover:border-[#0D47A1]/40',
    },
    {
      title: 'Meus Documentos',
      subtitle: 'Certificados e contratos',
      path: '/meus-documentos',
      icon: FileCheck,
      color: 'bg-blue-50 text-[#1E88E5] border-blue-100 hover:border-[#1E88E5]/40',
    },
    {
      title: 'Meu Perfil',
      subtitle: 'Dados e cadastros',
      path: '/meu-perfil',
      icon: User,
      color: 'bg-indigo-50 text-[#3949AB] border-indigo-100 hover:border-[#3949AB]/40',
    },
    {
      title: 'Benefícios',
      subtitle: 'Saúde e refeição',
      path: '/beneficios',
      icon: Gift,
      color: 'bg-purple-50 text-[#8E24AA] border-purple-100 hover:border-[#8E24AA]/40',
    },
    {
      title: 'Atestados',
      subtitle: 'Envios e histórico',
      path: '/atestados',
      icon: FileCheck,
      color: 'bg-amber-50 text-[#FB8C00] border-amber-100 hover:border-[#FB8C00]/40',
    },
    {
      title: 'Minhas Férias',
      subtitle: 'Períodos e saldo',
      path: '/ferias',
      icon: Palmtree,
      color: 'bg-emerald-50 text-[#2E7D32] border-emerald-100 hover:border-[#2E7D32]/40',
    },
  ]

  // Trata clique do botão Nova Publicação - redireciona para tela de gestão de comunicados
  const handleNovaPublicacao = () => {
    navigate('/comunicados/gestao')
  }

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header com Saudação "Olá, [Nome]!" */}
      <div className="relative overflow-hidden rounded-2xl border border-[#0D47A1]/20 bg-gradient-to-r from-[#0D47A1] via-[#1565C0] to-[#1E88E5] p-6 md:p-8 text-white shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-blue-200" />
              <span>Portal do Colaborador • Gente & Gestão</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Olá, {primeiroNome}!
            </h1>
            <p className="text-sm md:text-base text-white/90 max-w-2xl leading-relaxed">
              Bem-vindo ao seu ambiente de trabalho digital. Acompanhe os comunicados corporativos,
              notícias da empresa e acesse seus serviços com rapidez.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur-md p-3 border border-white/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{nomeCompleto}</span>
                <Badge
                  variant="outline"
                  className={`${badgeStyle.bg} ${badgeStyle.text} text-[10px] px-2 py-0 border-0 font-bold`}
                >
                  {PROFILE_LABELS[perfil]}
                </Badge>
              </div>
              <p className="text-white/80 text-[11px] mt-0.5">
                {colaborador?.cargo || 'Colaborador'}{' '}
                {colaborador?.departamento ? `• ${colaborador.departamento}` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Grid de Atalhos Rápidos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#212121] flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#0D47A1]" />
            Atalhos do Colaborador
          </h2>
          <span className="text-xs text-[#757575]">Acesso direto às suas ferramentas</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-9 gap-3">
          {atalhos.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.title}
                onClick={() => navigate(item.path)}
                className={`group flex flex-col items-start p-4 rounded-xl border bg-white shadow-xs hover:shadow-md transition-all duration-200 text-left ${item.color}`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-white shadow-xs group-hover:scale-105 transition-transform">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <span className="text-sm font-bold text-[#212121] group-hover:text-[#0D47A1] transition-colors leading-tight">
                  {item.title}
                </span>
                <span className="text-[11px] text-[#757575] mt-1 line-clamp-1">
                  {item.subtitle}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Mural de Comunicados */}
      <div className="space-y-5">
        {/* Topo do Mural: Título, Filtros e Botão de Ação */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-[#0D47A1]" />
              <h2 className="text-xl font-bold text-[#212121]">Mural de Comunicados</h2>
              <Badge
                variant="outline"
                className="text-xs bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/20 font-semibold"
              >
                {comunicadosFiltrados.length}{' '}
                {comunicadosFiltrados.length === 1 ? 'publicação' : 'publicações'}
              </Badge>
            </div>
            <p className="text-xs text-[#757575] mt-1">
              Fique por dentro das novidades, alinhamentos estratégicos e comunicados oficiais.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Botão + Nova Publicação visível apenas para perfis RH e Admin */}
            {canPublish && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleNovaPublicacao}
                    className="bg-[#0D47A1] hover:bg-[#0A3A82] text-white shadow-sm text-xs font-semibold h-9 px-4 gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Nova Publicação
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs bg-[#212121] text-white">
                  Permissão exclusiva para RH e Administrador
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Filtros por Categoria (Tags clicáveis) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#757575] flex items-center gap-1.5 mr-1">
            <Filter className="h-3.5 w-3.5" /> Filtrar:
          </span>

          {/* Tag "Todos" */}
          <button
            onClick={() => setSelectedCategoria('todos')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              selectedCategoria === 'todos'
                ? 'bg-[#0D47A1] text-white border-[#0D47A1] shadow-xs'
                : 'bg-white text-[#616161] border-[#E0E0E0] hover:bg-[#F5F5F5] hover:text-[#212121]'
            }`}
          >
            <span>Todos</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedCategoria === 'todos'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#E0E0E0] text-[#424242]'
              }`}
            >
              {contagemPorCategoria.todos}
            </span>
          </button>

          {/* Tags por Categoria */}
          {categoriasList.map((cat) => {
            const config = COMUNICADO_CATEGORIAS[cat]
            const isSelected = selectedCategoria === cat
            const count = contagemPorCategoria[cat] || 0

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategoria(cat)}
                style={{
                  borderColor: isSelected ? config.color : undefined,
                  backgroundColor: isSelected ? config.color : undefined,
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  isSelected
                    ? 'text-white shadow-xs'
                    : 'bg-white text-[#616161] border-[#E0E0E0] hover:bg-[#F5F5F5] hover:text-[#212121]'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: isSelected ? '#FFFFFF' : config.color }}
                />
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#E0E0E0] text-[#424242]'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Lista de Cards de Comunicados */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border border-[#E0E0E0] p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-20 bg-slate-100" />
                  <Skeleton className="h-4 w-24 bg-slate-100" />
                </div>
                <Skeleton className="h-6 w-3/4 bg-slate-100" />
                <Skeleton className="h-16 w-full bg-slate-100" />
                <Skeleton className="h-4 w-1/3 bg-slate-100" />
              </Card>
            ))}
          </div>
        ) : comunicadosFiltrados.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E0E0E0] bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F5F5] text-[#757575] mb-4">
              <Megaphone className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-[#212121]">Nenhum comunicado encontrado</h3>
            <p className="text-xs text-[#757575] mt-1 max-w-sm mx-auto">
              {selectedCategoria === 'todos'
                ? 'Ainda não há comunicados publicados para o seu perfil ou setor no momento.'
                : `Não existem comunicados cadastrados na categoria "${selectedCategoria}" destinados ao seu perfil.`}
            </p>
            {selectedCategoria !== 'todos' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCategoria('todos')}
                className="mt-4 text-xs border-[#E0E0E0] text-[#0D47A1]"
              >
                Limpar filtro
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {comunicadosFiltrados.map((item) => {
              const catConfig =
                COMUNICADO_CATEGORIAS[item.categoria] || COMUNICADO_CATEGORIAS.Empresa

              return (
                <Card
                  key={item.id}
                  onClick={() => setModalComunicado(item)}
                  className="group relative flex flex-col justify-between overflow-hidden border border-[#E0E0E0] bg-white shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer hover:border-[#0D47A1]/40"
                  style={{
                    borderTop: `4px solid ${catConfig.color}`,
                  }}
                >
                  <CardHeader className="p-5 pb-3 space-y-2.5">
                    {/* Header do Card: Categoria com cor e Data formatada */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-white shadow-2xs"
                        style={{ backgroundColor: catConfig.color }}
                      >
                        {item.categoria}
                      </span>

                      <div className="flex items-center gap-1 text-[11px] text-[#757575]">
                        <Calendar className="h-3 w-3" />
                        <span>{formatarDataPublicacao(item.data_publicacao || item.created)}</span>
                      </div>
                    </div>

                    {/* Título */}
                    <CardTitle className="text-base font-bold text-[#212121] group-hover:text-[#0D47A1] transition-colors leading-snug line-clamp-2">
                      {item.titulo}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    {/* Resumo do Conteúdo */}
                    <p className="text-xs text-[#616161] leading-relaxed line-clamp-3">
                      {item.conteudo}
                    </p>

                    {/* Rodapé do Card: Tag de Segmentação (se aplicável para RH/Admin/Gestores) e Ação de ler */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#F5F5F5] text-xs">
                      {item.segmentacao_tipo !== 'todos' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#757575] bg-[#F5F5F5] px-2 py-0.5 rounded">
                          {item.segmentacao_tipo === 'setor' && `Setor: ${item.segmentacao_valor}`}
                          {item.segmentacao_tipo === 'funcao' && `Cargo: ${item.segmentacao_valor}`}
                          {item.segmentacao_tipo === 'gestores' && 'Exclusivo: Gestores'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#9E9E9E]">Geral • Todos</span>
                      )}

                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D47A1] group-hover:underline ml-auto">
                        <Eye className="h-3 w-3" />
                        Ler mais
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal / Dialog de Leitura Completa do Comunicado */}
      <Dialog open={!!modalComunicado} onOpenChange={(open) => !open && setModalComunicado(null)}>
        {modalComunicado && (
          <DialogContent className="max-w-xl p-0 overflow-hidden bg-white border border-[#E0E0E0]">
            {/* Barra superior colorida pela categoria */}
            <div
              className="h-2.5 w-full"
              style={{
                backgroundColor:
                  COMUNICADO_CATEGORIAS[modalComunicado.categoria]?.color || '#0D47A1',
              }}
            />

            <div className="p-6 space-y-4">
              <DialogHeader className="space-y-2 text-left">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold text-white"
                    style={{
                      backgroundColor:
                        COMUNICADO_CATEGORIAS[modalComunicado.categoria]?.color || '#0D47A1',
                    }}
                  >
                    {modalComunicado.categoria}
                  </span>

                  <div className="flex items-center gap-1.5 text-xs text-[#757575]">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Publicado em{' '}
                      {formatarDataPublicacao(
                        modalComunicado.data_publicacao || modalComunicado.created,
                      )}
                    </span>
                  </div>
                </div>

                <DialogTitle className="text-xl font-bold text-[#212121] leading-snug">
                  {modalComunicado.titulo}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#757575]">
                  Comunicado oficial • Gente e Gestão Tesla
                </DialogDescription>
              </DialogHeader>

              <div className="py-2 text-sm text-[#424242] leading-relaxed whitespace-pre-wrap border-y border-[#F5F5F5] min-h-[120px]">
                {modalComunicado.conteudo}
              </div>

              {/* Informações adicionais do comunicado */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 text-xs text-[#757575]">
                <div className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-[#0D47A1]" />
                  <span>
                    Destinatários:{' '}
                    <strong className="text-[#212121]">
                      {modalComunicado.segmentacao_tipo === 'todos'
                        ? 'Toda a organização'
                        : modalComunicado.segmentacao_tipo === 'gestores'
                          ? 'Liderança e Gestores'
                          : modalComunicado.segmentacao_tipo === 'setor'
                            ? `Setor ${modalComunicado.segmentacao_valor}`
                            : `Função ${modalComunicado.segmentacao_valor}`}
                    </strong>
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalComunicado(null)}
                  className="border-[#E0E0E0] text-[#212121] hover:bg-[#F5F5F5] text-xs h-8"
                >
                  Fechar Leitura
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
