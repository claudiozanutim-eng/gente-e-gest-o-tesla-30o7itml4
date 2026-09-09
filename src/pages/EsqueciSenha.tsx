import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Loader2, CheckCircle2, Layers, AlertCircle } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Por favor, informe um endereço de e-mail corporativo válido.')
      return
    }

    setIsSubmitting(true)
    try {
      await pb.collection('users').requestPasswordReset(email.trim())
      setIsSent(true)
    } catch {
      // For security and user reassurance, or if reset succeeded
      setIsSent(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#F5F5F5] selection:bg-[#E8EEF7] selection:text-[#0D47A1]">
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md animate-fade-in">
          {/* Brand header */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0D47A1] text-white shadow-md shadow-[#0D47A1]/20">
              <Layers className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#212121]">
              Gente e Gestão Tesla
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0D47A1]">
              Recuperação de Acesso
            </p>
          </div>

          <Card className="border border-[#E0E0E0] bg-white shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold tracking-tight text-[#212121]">
                Recuperar senha
              </CardTitle>
              <CardDescription className="text-sm text-[#757575]">
                {isSent
                  ? 'Verifique sua caixa de entrada'
                  : 'Informe seu e-mail corporativo para receber as instruções de recuperação.'}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {isSent ? (
                <div className="space-y-4 text-center py-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[#212121]">
                      Link de recuperação enviado!
                    </h3>
                    <p className="text-sm text-[#757575]">
                      Enviamos um e-mail para <strong className="text-[#212121]">{email}</strong>.
                      Por favor, verifique sua caixa de entrada e spam para redefinir sua senha.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errorMessage && (
                    <Alert
                      variant="destructive"
                      className="bg-[#FFEBEE] text-[#C62828] border-[#C62828]/20"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm font-medium">
                        {errorMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-[#212121]">
                      E-mail corporativo
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-[#757575]" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="nome@empresa.com.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSubmitting}
                        className="pl-9 border-[#E0E0E0] focus-visible:ring-[#1565C0] focus-visible:ring-offset-0"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#0D47A1] hover:bg-[#0A3A82] text-white font-medium py-2.5 transition-all shadow-sm active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar link de recuperação'
                    )}
                  </Button>
                </form>
              )}
            </CardContent>

            <CardFooter className="flex justify-center border-t border-[#E0E0E0] pt-4 bg-[#FAFAFA] rounded-b-xl">
              <Link
                to="/login"
                className="inline-flex items-center text-sm font-medium text-[#0D47A1] hover:underline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-[#757575]">
        © {new Date().getFullYear()} Gente e Gestão Tesla RH Ltda. Todos os direitos reservados.
      </footer>
    </div>
  )
}
