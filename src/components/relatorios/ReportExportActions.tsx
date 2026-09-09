import React, { useState } from 'react'
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportToExcel, exportToPdf, ExportReportOptions } from '@/lib/exportReports'
import { toast } from '@/hooks/use-toast'
import { logAuditoriaService } from '@/services/api'
import { useAuth } from '@/context/AuthContext'

interface ReportExportActionsProps<T = any> {
  options: ExportReportOptions<T>
  disabled?: boolean
  className?: string
}

export const ReportExportActions: React.FC<ReportExportActionsProps> = ({
  options,
  disabled = false,
  className = '',
}) => {
  const { user } = useAuth()
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)

  const handleExportExcel = async () => {
    if (disabled || loadingExcel) return
    try {
      setLoadingExcel(true)
      const filename = await exportToExcel(options)
      toast({
        title: 'Relatório exportado com sucesso',
        description: `Arquivo Excel "${filename}" gerado e baixado.`,
      })

      // Registrar auditoria
      if (user?.tenant_id && user?.id) {
        logAuditoriaService
          .registrarLog({
            tenant_id: user.tenant_id,
            user_id: user.id,
            acao: 'exportar_relatorio_excel',
            entidade: 'relatorio',
            entidade_id: options.filePrefix,
            dados_json: {
              relatorio: options.reportTitle,
              formato: 'xlsx',
              totalRegistros: options.data.length,
              arquivo: filename,
              periodo: `${options.startDate || ''} a ${options.endDate || ''}`,
            },
          })
          .catch(() => {})
      }
    } catch (err) {
      console.error('Erro ao exportar Excel:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar a planilha Excel. Tente novamente.',
      })
    } finally {
      setLoadingExcel(false)
    }
  }

  const handleExportPdf = async () => {
    if (disabled || loadingPdf) return
    try {
      setLoadingPdf(true)
      const filename = await exportToPdf(options)
      toast({
        title: 'Relatório exportado com sucesso',
        description: `Arquivo PDF "${filename}" gerado e baixado.`,
      })

      // Registrar auditoria
      if (user?.tenant_id && user?.id) {
        logAuditoriaService
          .registrarLog({
            tenant_id: user.tenant_id,
            user_id: user.id,
            acao: 'exportar_relatorio_pdf',
            entidade: 'relatorio',
            entidade_id: options.filePrefix,
            dados_json: {
              relatorio: options.reportTitle,
              formato: 'pdf',
              totalRegistros: options.data.length,
              arquivo: filename,
              periodo: `${options.startDate || ''} a ${options.endDate || ''}`,
            },
          })
          .catch(() => {})
      }
    } catch (err) {
      console.error('Erro ao exportar PDF:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o arquivo PDF. Tente novamente.',
      })
    } finally {
      setLoadingPdf(false)
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E0E0E0] mt-4 ${className}`}
    >
      <div className="text-xs text-[#757575] font-medium flex items-center gap-1.5">
        <span>
          Mostrando <strong>{options.data.length}</strong> registro(s)
        </span>
        <span>•</span>
        <span>Pronto para download nos formatos oficiais</span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Botão Exportar Excel (ícone 📊, verde) */}
        <Button
          type="button"
          onClick={handleExportExcel}
          disabled={disabled || loadingExcel || loadingPdf || options.data.length === 0}
          className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-semibold h-9 px-3.5 shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          title="Exportar para planilha Excel (.xlsx)"
        >
          {loadingExcel ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="text-sm leading-none" role="img" aria-label="Excel">
              📊
            </span>
          )}
          <span>{loadingExcel ? 'Gerando Excel...' : 'Exportar Excel'}</span>
        </Button>

        {/* Botão Exportar PDF (ícone 📕, vermelho) */}
        <Button
          type="button"
          onClick={handleExportPdf}
          disabled={disabled || loadingPdf || loadingExcel || options.data.length === 0}
          className="bg-[#C62828] hover:bg-[#B71C1C] text-white text-xs font-semibold h-9 px-3.5 shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          title="Exportar para documento PDF (.pdf)"
        >
          {loadingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="text-sm leading-none" role="img" aria-label="PDF">
              📕
            </span>
          )}
          <span>{loadingPdf ? 'Gerando PDF...' : 'Exportar PDF'}</span>
        </Button>
      </div>
    </div>
  )
}
