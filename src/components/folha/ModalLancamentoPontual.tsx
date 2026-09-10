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
import { Textarea } from '@/components/ui/textarea'
import { LancamentoPontual } from '@/types'

export interface ModalLancamentoPontualProps {
  open: boolean
  onClose: () => void
  onSave: (data: {
    descritivo: string
    quantidade: number
    data: string
    comentario?: string
  }) => Promise<void>
  initialData?: LancamentoPontual | null
}

export const ModalLancamentoPontual: React.FC<ModalLancamentoPontualProps> = ({
  open,
  onClose,
  onSave,
  initialData,
}) => {
  const [descritivo, setDescritivo] = useState('')
  const [tipo, setTipo] = useState<'provento' | 'desconto'>('provento')
  const [valor, setValor] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [comentario, setComentario] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setDescritivo(initialData.descritivo)
      const isDesc = initialData.quantidade < 0
      setTipo(isDesc ? 'desconto' : 'provento')
      setValor(String(Math.abs(initialData.quantidade)))
      setDataEvento(initialData.data ? initialData.data.slice(0, 10) : '')
      setComentario(initialData.comentario || '')
    } else {
      setDescritivo('')
      setTipo('provento')
      setValor('')
      setDataEvento(new Date().toISOString().slice(0, 10))
      setComentario('')
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

    if (!dataEvento) {
      setErro('Informe a data do evento pontual.')
      return
    }

    const quantidadeFinal = tipo === 'desconto' ? -valorNumerico : valorNumerico

    setSalvando(true)
    try {
      await onSave({
        descritivo: descritivo.trim(),
        quantidade: quantidadeFinal,
        data: new Date(`${dataEvento}T12:00:00.000Z`).toISOString(),
        comentario: comentario.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setErro(err?.message || 'Falha ao salvar lançamento pontual.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-[#212121]">
            {initialData ? 'Editar Lançamento Pontual' : 'Novo Lançamento Pontual'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#757575]">
            Lançamento extraordinário do mês (horas noturnas, comissões, bônus ou descontos por
            falta).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {erro && (
            <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {erro}
            </div>
          )}

          {/* Natureza (Provento / Desconto) */}
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
            <Label htmlFor="pont-desc" className="text-xs font-semibold text-[#212121]">
              Descritivo do Lançamento *
            </Label>
            <Input
              id="pont-desc"
              value={descritivo}
              onChange={(e) => setDescritivo(e.target.value)}
              placeholder="Ex: Horas Noturnas, Comissão, Desconto por Falta"
              className="text-xs h-9 border-[#E0E0E0]"
              required
            />
          </div>

          {/* Valor (R$) e Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pont-valor" className="text-xs font-semibold text-[#212121]">
                Valor (R$) *
              </Label>
              <Input
                id="pont-valor"
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
              <Label htmlFor="pont-data" className="text-xs font-semibold text-[#212121]">
                Data do Evento *
              </Label>
              <Input
                id="pont-data"
                type="date"
                value={dataEvento}
                onChange={(e) => setDataEvento(e.target.value)}
                className="text-xs h-9 border-[#E0E0E0]"
                required
              />
            </div>
          </div>

          {/* Comentário */}
          <div className="space-y-1.5">
            <Label htmlFor="pont-coment" className="text-xs font-semibold text-[#212121]">
              Comentário / Justificativa (opcional)
            </Label>
            <Textarea
              id="pont-coment"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Detalhes adicionais sobre a origem do provento ou motivo do desconto..."
              className="text-xs border-[#E0E0E0] min-h-[70px] resize-none"
            />
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
