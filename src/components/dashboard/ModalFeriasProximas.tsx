import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ColaboradorFeriasStatus } from '@/services/feriasService'
import { Palmtree, Calendar, AlertTriangle, Building2, User, Clock } from 'lucide-react'

interface ModalFeriasProximasProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  colaboradoresProximos: ColaboradorFeriasStatus[]
}

export const ModalFeriasProximas: React.FC<ModalFeriasProximasProps> = ({
  open,
  onOpenChange,
  colaboradoresProximos,
}) => {
  const formatarData = (data: Date) => {
    try {
      return data.toLocaleDateString('pt-BR')
    } catch {
      return 'Data inválida'
    }
  }

  const getCriticidadeBadge = (diasAteLimite: number) => {
    if (diasAteLimite < 0) {
      return (
        <Badge className="bg-[#C62828] text-white hover:bg-[#B71C1C] text-[10px] font-bold">
          Vencido ({Math.abs(diasAteLimite)}d atrás)
        </Badge>
      )
    }
    if (diasAteLimite <= 15) {
      return (
        <Badge className="bg-[#D32F2F] text-white hover:bg-[#C62828] text-[10px] font-bold">
          Urgente: {diasAteLimite} {diasAteLimite === 1 ? 'dia' : 'dias'}
        </Badge>
      )
    }
    if (diasAteLimite <= 30) {
      return (
        <Badge className="bg-[#F57C00] text-white hover:bg-[#EF6C00] text-[10px] font-bold">
          Atenção: {diasAteLimite} dias
        </Badge>
      )
    }
    return (
      <Badge className="bg-[#FFA000] text-white hover:bg-[#FF8F00] text-[10px] font-bold">
        {diasAteLimite} dias restantes
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white border border-[#E0E0E0]">
        {/* Header do Modal */}
        <div className="p-6 pb-4 border-b border-[#E0E0E0] bg-[#FAFAFA]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 text-[#C62828] flex items-center justify-center shrink-0">
                <Palmtree className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-[#212121] flex items-center gap-2">
                  Férias Próximas do Vencimento Concessivo
                  <Badge
                    variant="outline"
                    className="bg-red-50 text-[#C62828] border-red-200 text-xs font-bold"
                  >
                    {colaboradoresProximos.length}{' '}
                    {colaboradoresProximos.length === 1 ? 'colaborador' : 'colaboradores'}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-[#757575] mt-0.5">
                  Regra CLT: prazo concessivo máximo (admissão + 24 meses ou ciclo anual vigente) a
                  60 dias ou menos da data limite sem concessão registrada.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {colaboradoresProximos.length === 0 ? (
            <div className="text-center py-10 text-[#757575]">
              <Palmtree className="h-10 w-10 mx-auto text-[#2E7D32] mb-2 opacity-80" />
              <p className="text-sm font-semibold text-[#212121]">
                Nenhum colaborador com férias a vencer nos próximos 60 dias!
              </p>
              <p className="text-xs text-[#757575] mt-1">
                Todas as concessões de férias dos colaboradores ativos estão em dia com a CLT.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Colaboradores cujo período concessivo expira em até 60 dias requerem alinhamento
                  imediato de escala para evitar o pagamento de férias em dobro (Art. 137 da CLT).
                </p>
              </div>

              <div className="rounded-lg border border-[#E0E0E0] overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#F5F5F5]">
                    <TableRow className="border-b border-[#E0E0E0]">
                      <TableHead className="text-xs font-semibold text-[#212121] py-2.5">
                        Colaborador
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#212121] py-2.5">
                        Cargo / Departamento
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#212121] py-2.5">
                        Admissão
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#212121] py-2.5">
                        Limite CLT
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#212121] py-2.5 text-right">
                        Prazo Restante
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colaboradoresProximos.map((item) => (
                      <TableRow
                        key={item.colaborador.id}
                        className="border-b border-[#EEEEEE] hover:bg-[#FAFAFA] transition-colors"
                      >
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-[#E8EEF7] text-[#0D47A1] flex items-center justify-center font-bold text-xs shrink-0">
                              {item.colaborador.nome ? item.colaborador.nome.charAt(0) : 'U'}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#212121]">
                                {item.colaborador.nome}
                              </p>
                              {item.colaborador.email && (
                                <p className="text-[11px] text-[#757575]">
                                  {item.colaborador.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <p className="text-xs text-[#212121]">
                            {item.colaborador.cargo || 'Não informado'}
                          </p>
                          <p className="text-[11px] text-[#757575] flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {item.colaborador.departamento || 'Geral'}
                          </p>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-[#757575]">
                          {formatarData(item.dataAdmissao)}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs font-medium text-[#212121]">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-[#9E9E9E]" />
                            {formatarData(item.dataLimiteConcessao)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          {getCriticidadeBadge(item.diasAteLimite)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 border-t border-[#E0E0E0] bg-[#FAFAFA] flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs border-[#E0E0E0]"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
