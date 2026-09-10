import React, { useState, useMemo } from 'react'
import {
  Search,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Tag,
  Scale,
  Sparkles,
  Palmtree,
  Clock,
  Stethoscope,
  FileText,
  ExternalLink,
} from 'lucide-react'
import { BASE_CLT, CltArtigo } from '@/data/cltKnowledgeBase'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AssistenteConsultaCltProps {
  className?: string
  defaultOpenArticleId?: string
}

const CATEGORIA_ICONES: Record<string, React.ElementType> = {
  Férias: Palmtree,
  Jornada: Clock,
  Atestados: Stethoscope,
  Rescisão: FileText,
}

const CATEGORIA_CORES: Record<string, { bg: string; text: string; border: string }> = {
  Férias: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Jornada: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Atestados: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  Rescisão: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
}

export function AssistenteConsultaClt({ className }: AssistenteConsultaCltProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todos')
  const [artigoExpandidoId, setArtigoExpandidoId] = useState<string | null>(null)
  const [artigoModal, setArtigoModal] = useState<CltArtigo | null>(null)

  const categorias = ['todos', 'Férias', 'Jornada', 'Atestados', 'Rescisão']

  const artigosFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return BASE_CLT.filter((item) => {
      const matchCategoria = selectedCategoria === 'todos' || item.categoria === selectedCategoria

      if (!matchCategoria) return false
      if (!term) return true

      const matchTitulo = item.titulo.toLowerCase().includes(term)
      const matchResumo = item.resumo.toLowerCase().includes(term)
      const matchArtigo = item.artigoRef.toLowerCase().includes(term)
      const matchTexto = item.textoCompleto.toLowerCase().includes(term)
      const matchTags = item.tags.some((t) => t.toLowerCase().includes(term))

      return matchTitulo || matchResumo || matchArtigo || matchTexto || matchTags
    })
  }, [searchTerm, selectedCategoria])

  const toggleExpand = (id: string) => {
    setArtigoExpandidoId((prev) => (prev === id ? null : id))
  }

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Box de Pesquisa Inteligente CLT */}
      <div className="relative rounded-2xl border border-[#0D47A1]/20 bg-gradient-to-r from-[#0D47A1]/5 via-[#1E88E5]/5 to-transparent p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D47A1] text-white shadow-xs">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#212121] flex items-center gap-1.5">
                Assistente de Consulta CLT & Obrigações Trabalhistas
                <Badge
                  variant="outline"
                  className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/30 text-[10px] font-semibold"
                >
                  Base Estática
                </Badge>
              </h3>
              <p className="text-xs text-[#757575]">
                Tire dúvidas sobre regras consolidadas, prazos legais, férias, jornada e rescisões
              </p>
            </div>
          </div>
          <span className="text-xs text-[#757575] font-medium hidden sm:inline">
            {artigosFiltrados.length} de {BASE_CLT.length} artigos
          </span>
        </div>

        {/* Campo de Busca em Tempo Real */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#0D47A1]" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tire dúvidas sobre CLT e obrigações legais... (ex: férias em dobro, aviso prévio, atestado 15 dias)"
            className="pl-10 pr-10 h-10 border-[#0D47A1]/30 bg-white shadow-xs focus-visible:ring-[#0D47A1] text-sm text-[#212121]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-xs text-[#757575] hover:text-[#212121] bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Filtros por Categorias */}
        <div className="flex items-center gap-1.5 flex-wrap mt-3">
          {categorias.map((cat) => {
            const isSelected = selectedCategoria === cat
            const Icon = cat !== 'todos' ? CATEGORIA_ICONES[cat] : BookOpen

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoria(cat)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
                  isSelected
                    ? 'bg-[#0D47A1] text-white border-[#0D47A1] shadow-2xs'
                    : 'bg-white text-[#616161] border-[#E0E0E0] hover:bg-[#F5F5F5] hover:text-[#212121]'
                }`}
              >
                {Icon && <Icon className="h-3 w-3" />}
                <span className="capitalize">{cat === 'todos' ? 'Todos os Tópicos' : cat}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Lista de Resultados em Cards */}
      {artigosFiltrados.length === 0 ? (
        <Card className="border border-dashed border-[#E0E0E0] bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F5F5] text-[#757575] mb-3">
            <Search className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-[#212121]">Nenhum artigo correspondente</h4>
          <p className="text-xs text-[#757575] mt-1 max-w-md mx-auto">
            Não encontramos regras trabalhistas para o termo &ldquo;{searchTerm}&rdquo;. Tente
            pesquisar por palavras-chave como &ldquo;férias&rdquo;, &ldquo;jornada&rdquo;,
            &ldquo;atestado&rdquo;, &ldquo;banco de horas&rdquo; ou &ldquo;aviso prévio&rdquo;.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm('')
              setSelectedCategoria('todos')
            }}
            className="mt-3 text-xs border-[#E0E0E0] text-[#0D47A1]"
          >
            Limpar filtros de busca
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {artigosFiltrados.map((artigo) => {
            const isExpanded = artigoExpandidoId === artigo.id
            const catColor = CATEGORIA_CORES[artigo.categoria] || CATEGORIA_CORES.Jornada
            const CatIcon = CATEGORIA_ICONES[artigo.categoria] || BookOpen

            return (
              <Card
                key={artigo.id}
                className="border border-[#E0E0E0] bg-white hover:border-[#0D47A1]/40 shadow-xs hover:shadow-sm transition-all"
              >
                <CardContent className="p-4 space-y-3">
                  {/* Topo do Card: Categoria badge, Artigo Ref e Alerta */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${catColor.bg} ${catColor.text} ${catColor.border}`}
                    >
                      <CatIcon className="h-3 w-3" />
                      {artigo.categoria}
                    </span>

                    <span className="font-mono text-[11px] font-semibold text-[#0D47A1] bg-[#E8EEF7] px-2 py-0.5 rounded">
                      {artigo.artigoRef}
                    </span>
                  </div>

                  {/* Título do Artigo */}
                  <h4 className="text-sm font-bold text-[#212121] leading-snug">{artigo.titulo}</h4>

                  {/* Resumo */}
                  <p className="text-xs text-[#616161] leading-relaxed">{artigo.resumo}</p>

                  {/* Alerta de Prazo Legal (se existir) */}
                  {artigo.prazoAlerta && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 bg-amber-50/80 border border-amber-200 px-2.5 py-1 rounded-md">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{artigo.prazoAlerta}</span>
                    </div>
                  )}

                  {/* Texto Completo Expandível Inline */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-[#F0F0F0] space-y-2.5 animate-in fade-in-50 duration-200">
                      <div className="p-3 bg-[#F8F9FA] rounded-lg border border-[#E0E0E0] text-xs text-[#212121] leading-relaxed whitespace-pre-wrap font-sans">
                        {artigo.textoCompleto}
                      </div>

                      {/* Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <Tag className="h-3 w-3 text-[#757575]" />
                        {artigo.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-slate-100 text-[#424242] px-1.5 py-0.5 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rodapé do Card: Ações */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F5] text-xs">
                    <button
                      type="button"
                      onClick={() => toggleExpand(artigo.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D47A1] hover:text-[#0A3A82] hover:underline"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Recolher artigo
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          Ver texto completo
                        </>
                      )}
                    </button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setArtigoModal(artigo)}
                      className="h-6 px-2 text-[11px] text-[#757575] hover:text-[#0D47A1] hover:bg-[#E8EEF7] gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Modal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog / Modal de Leitura Completa do Artigo da CLT */}
      <Dialog open={!!artigoModal} onOpenChange={(open) => !open && setArtigoModal(null)}>
        {artigoModal && (
          <DialogContent className="max-w-2xl bg-white border border-[#E0E0E0] p-6 space-y-4">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border ${
                    CATEGORIA_CORES[artigoModal.categoria]?.bg
                  } ${CATEGORIA_CORES[artigoModal.categoria]?.text} ${
                    CATEGORIA_CORES[artigoModal.categoria]?.border
                  }`}
                >
                  <Scale className="h-3.5 w-3.5" />
                  {artigoModal.categoria} • Base Legal CLT
                </span>
                <span className="font-mono text-xs font-bold text-[#0D47A1] bg-[#E8EEF7] px-2.5 py-1 rounded">
                  {artigoModal.artigoRef}
                </span>
              </div>
              <DialogTitle className="text-lg font-bold text-[#212121] leading-snug">
                {artigoModal.titulo}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#757575]">
                {artigoModal.resumo}
              </DialogDescription>
            </DialogHeader>

            {artigoModal.prazoAlerta && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Prazo / Obrigatoriedade Legal:</strong> {artigoModal.prazoAlerta}
                </span>
              </div>
            )}

            <div className="p-4 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] text-xs text-[#212121] leading-relaxed whitespace-pre-wrap font-sans max-h-[320px] overflow-y-auto">
              {artigoModal.textoCompleto}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#F0F0F0] text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                {artigoModal.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] bg-slate-100 text-[#616161] px-2 py-0.5 rounded-full"
                  >
                    #{t}
                  </span>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setArtigoModal(null)}
                className="border-[#E0E0E0] text-xs h-8"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
