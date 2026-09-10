import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LancamentoPeriodico, PeriodicidadeLancamento } from '@/types'

export interface ModalLancamentoPeriodicoProps {
  open: boolean
  onClose: () => void
  onSave: (data: {
    descritivo: string
    quantidade: number
    periodicidade: PeriodicidadeLancamento
    data_recorrencia: number
    data_inicio_vigencia: string
    data_fim_vigencia?: string | null
  }) => Promise<void>
  initialData?: LancamentoPeriodico | null
}

export const ModalLancamentoPeriodico: React.FC<ModalLancamentoPeriodicoProps> = ({
  open,
  onClose,
  onSave,
  initialData,
}) => {
  const [descritivo, setDescritivo] = useState('')
  const [tipo, setTipo] = useState<'provento' | 'desconto'>('provento')
  const [valor, setValor] = useState('')
  const [periodicidade, setPeriodicidade] = useState<PeriodicidadeLancamento>('mensal')
  const [dataRecorrencia, setDataRecorrencia] = useState('5')
  const [dataInicioVigencia, setDataInicioVigencia] = useState('')
  const [dataFimVigencia, setDataFimVigencia] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setDescritivo(initialData.descritivo)
      const isDesc = initialData.quantidade < 0
      setTipo(isDesc ? 'desconto' : 'provento')
      setValor(String(Math.abs(initialData.quantidade)))
      setPeriodicidade(initialData.periodicidade || 'mensal')
      setDataRecorrencia(String(initialData.data_recorrencia || 5))
      setDataInicioVigencia(
        initialData.data_inicio_vigencia ? initialData.data_inicio_vigencia.slice(0, 10) : '',
      )
      setDataFimVigencia(
        initialData.data_fim_vigencia ? initialData.data_fim_vigencia.slice(0, 10) : '',
      )
    } else {
      setDescritivo('')
      setTipo('provento')
      setValor('')
      setPeriodicidade('mensal')
      setDataRecorrencia('5')
      setDataInicioVigencia(new Date().toISOString().slice(0, 10))
      setDataFimVigencia('')
    }
    setErro(null)
  }, [initialData, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    if (!descritivo.trim()) {
      setErro('Informe o descritivo do lançamento.')
      return
    }

    const valorNumerico = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      setErro('Informe um valor válido maior que zero.')
      return
    }

    const diaRec = parseInt(dataRecorrencia, 10)
    if (isNaN(diaRec) || diaRec < 1 || diaRec > 31) {
      setErro('Dia da recorrência deve ser entre 1 e 31.')
      return
    }

    if (!dataInicioVigencia) {
      setErro('A data de início da vigência é obrigatória.')
      return
    }

    if (dataFimVigencia && new Date(dataFimVigencia) < new Date(dataInicioVigencia)) {
      setErro('A data final de vigência não pode ser anterior à data inicial.')
      return
    }

    const quantidadeFinal = tipo === 'desconto' ? -valorNumerico : valorNumerico

    setSalvando(true)
    try {
      await onSave({
        descritivo: descritivo.trim(),
        quantidade: quantidadeFinal,
        periodicidade,
        data_recorrencia: diaRec,
        data_inicio_vigencia: new Date(dataInicioVigencia).toISOString(),
        data_fim_vigencia: dataFimVigencia
          ? new Date(`${dataFimVigencia}T23:59:59.000Z`).toISOString()
          : null,
      })
      onClose()
    } catch (err: any) {
      setErro(err?.message || 'Falha ao salvar lançamento periódico.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-[#212121]">
            {initialData ? 'Editar Lançamento Periódico' : 'Novo Lançamento Periódico'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#757575]">
            Lançamento recorrente aplicado mensalmente à folha durante o período de vigência.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {erro && (
            <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {erro}
            </div>
          )}

          {/* Tipo (Provento / Desconto) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#212121]">Natureza do Lançamento</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={tipo === 'provento' ? 'default' : 'outline'}
                onClick={() => setTipo('provento')}
                className={`text-xs h-9 ${
                  tipo === 'provento'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'border-[#E0E0E0] text-[#616161]'
                }`}
              >
                + Provento (Crédito)
              </Button>
              <Button
                type="button"
                variant={tipo === 'desconto' ? 'default' : 'outline'}
                onClick={() => setTipo('desconto')}
                className={`text-xs h-9 ${
                  tipo === 'desconto'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'border-[#E0E0E0] text-[#616161]'
                }`}
              >
                - Desconto (Débito)
              </Button>
            </div>
          </div>

          {/* Descritivo */}
          <div className="space-y-1.5">
            <Label htmlFor="per-desc" className="text-xs font-semibold text-[#212121]">
              Descritivo do Lançamento *
            </Label>
            <Input
              id="per-desc"
              value={descritivo}
              onChange={(e) => setDescritivo(e.target.value)}
              placeholder="Ex: Remuneração Mensal, Adiantamento, Vale Transporte"
              className="text-xs h-9 border-[#E0E0E0]"
              required
            />
          </div>

          {/* Valor (R$) e Periodicidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="per-valor" className="text-xs font-semibold text-[#212121]">
                Valor (R$) *
              </Label>
              <Input
                id="per-valor"
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0.00"
                className="text-xs h-9 border-[#E0E0E0] font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#212121]">Periodicidade *</Label>
              <Select
                value={periodicidade}
                onValueChange={(val: PeriodicidadeLancamento) => setPeriodicidade(val)}
              >
                <SelectTrigger className="text-xs h-9 border-[#E0E0E0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal" className="text-xs">
                    Mensal
                  </SelectItem>
                  <SelectItem value="quinzenal" className="text-xs">
                    Quinzenal
                  </SelectItem>
                  <SelectItem value="semanal" className="text-xs">
                    Semanal
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data de Recorrência (dia do mês) */}
          <div className="space-y-1.5">
            <Label htmlFor="per-rec" className="text-xs font-semibold text-[#212121]">
              Dia de Recorrência (1 a 31) *
            </Label>
            <Input
              id="per-rec"
              type="number"
              min="1"
              max="31"
              value={dataRecorrencia}
              onChange={(e) => setDataRecorrencia(e.target.value)}
              placeholder="Ex: 5 = todo dia 5"
              className="text-xs h-9 border-[#E0E0E0] font-mono"
              required
            />
            <p className="text-[11px] text-[#757575]">
              Dia do mês em que este lançamento recorrente é creditado ou descontado.
            </p>
          </div>

          {/* Vigência (Início e Fim) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="per-ini" className="text-xs font-semibold text-[#212121]">
                Início da Vigência *
              </Label>
              <Input
                id="per-ini"
                type="date"
                value={dataInicioVigencia}
                onChange={(e) => setDataInicioVigencia(e.target.value)}
                className="text-xs h-9 border-[#E0E0E0]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="per-fim" className="text-xs font-semibold text-[#212121]">
                Fim da Vigência (opcional)
              </Label>
              <Input
                id="per-fim"
                type="date"
                value={dataFimVigencia}
                onChange={(e) => setDataFimVigencia(e.target.value)}
                className="text-xs h-9 border-[#E0E0E0]"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={salvando}
              className="text-xs h-9 border-[#E0E0E0] text-[#616161]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="bg-[#0D47A1] hover:bg-[#0B3D91] text-white text-xs h-9 font-semibold"
            >
              {salvando ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Criar Lançamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
