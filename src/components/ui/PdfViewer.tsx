import React, { useState } from 'react'
import {
  Maximize2,
  Minimize2,
  ExternalLink,
  Download,
  FileText,
  AlertCircle,
  FileQuestion,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PdfViewerProps {
  url?: string | null
  titulo?: string
  fallbackTitle?: string
  fallbackDescription?: string
  fallbackSummary?: string[]
  className?: string
  allowExpand?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
  showExternalLink?: boolean
  showDownload?: boolean
  hideHeaderActions?: boolean
}

/**
 * Componente unificado para visualização de documentos PDF no padrão Tesla RH (#0D47A1).
 * Elimina o fundo cinza escuro (#525659) exposto do container e garante 100% de largura
 * e altura útil, sem barras cinzas cortando a leitura.
 */
export const PdfViewer: React.FC<PdfViewerProps> = ({
  url,
  titulo = 'Documento PDF',
  fallbackTitle = 'Visualização do Documento',
  fallbackDescription,
  fallbackSummary,
  className,
  allowExpand = false,
  isExpanded = false,
  onToggleExpand,
  showExternalLink = true,
  showDownload = false,
  hideHeaderActions = false,
}) => {
  const [localExpanded, setLocalExpanded] = useState(false)
  const expanded = onToggleExpand ? isExpanded : localExpanded
  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand()
    } else {
      setLocalExpanded((prev) => !prev)
    }
  }

  // Prepara URL com parâmetros úteis para exibição no viewer nativo do navegador
  // navpanes=0 esconde miniatura lateral desnecessária; toolbar=1 mantém zoom e página; view=FitH ajusta à largura útil
  const formattedUrl = url
    ? url.includes('#')
      ? url
      : `${url}#toolbar=1&navpanes=0&view=FitH`
    : ''

  return (
    <div
      className={cn('w-full h-full flex flex-col bg-slate-50 relative overflow-hidden', className)}
    >
      {/* Barra de Ações Superior (opcional quando já presente no cabeçalho do modal) */}
      {!hideHeaderActions &&
        (allowExpand || (showExternalLink && url) || (showDownload && url)) && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-[#E0E0E0] text-xs shrink-0">
            <span className="font-medium text-[#424242] truncate max-w-xs">{titulo}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {allowExpand && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggle}
                  className="h-7 px-2.5 text-xs text-[#0D47A1] border-[#0D47A1]/30 hover:bg-[#E8EEF7] gap-1"
                  title={
                    expanded ? 'Reduzir visualização (ESC)' : 'Expandir para leitura em tela cheia'
                  }
                >
                  {expanded ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5 text-[#0D47A1]" />
                      <span>Reduzir</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5 text-[#0D47A1]" />
                      <span>Expandir</span>
                    </>
                  )}
                </Button>
              )}

              {showExternalLink && url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                  className="h-7 px-2.5 text-xs border-[#E0E0E0] hover:bg-white gap-1"
                  title="Abrir em Nova Aba"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Abrir em Nova Aba</span>
                </Button>
              )}

              {showDownload && url && (
                <a
                  href={url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#E0E0E0] bg-white text-xs text-[#424242] hover:bg-slate-50 transition-colors"
                  title="Baixar arquivo"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Baixar</span>
                </a>
              )}
            </div>
          </div>
        )}

      {/* Área Principal de Leitura */}
      <div className="flex-1 w-full h-full min-h-0 bg-white relative">
        {url ? (
          <iframe
            src={formattedUrl}
            title={titulo}
            className="w-full h-full border-0 block bg-white"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-6 bg-slate-50">
            <div className="bg-white p-6 sm:p-8 rounded-xl max-w-lg w-full text-center shadow-xs border border-[#E0E0E0]">
              <div className="h-12 w-12 rounded-full bg-blue-50 text-[#0D47A1] mx-auto flex items-center justify-center mb-3">
                <FileText className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-sm text-[#212121] mb-1">{fallbackTitle}</h4>
              {fallbackDescription ? (
                <p className="text-xs text-[#757575] leading-relaxed mb-4">{fallbackDescription}</p>
              ) : (
                <p className="text-xs text-[#757575] leading-relaxed mb-4">
                  O arquivo correspondente a este registro não está disponível para pré-visualização
                  inline.
                </p>
              )}

              {fallbackSummary && fallbackSummary.length > 0 && (
                <div className="bg-[#F5F5F5] p-3 rounded-lg text-left text-xs text-[#424242] space-y-1">
                  <p className="font-semibold text-[#0D47A1]">Sumário Informativo:</p>
                  {fallbackSummary.map((item, idx) => (
                    <p key={idx}>• {item}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
