import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, Loader2, Layers, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
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
import { PROFILE_HOME_MAP } from '@/types'
import { TESLA_LOGO_URL } from '@/lib/logoAsset'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password) {
      setErrorMessage('Preencha seu e-mail corporativo e senha.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await login(email, password)
      if (res.success && res.user) {
        const targetRoute = PROFILE_HOME_MAP[res.user.perfil] || '/portal'
        navigate(targetRoute, { replace: true })
      } else {
        setErrorMessage(res.error || 'E-mail ou senha inválidos')
      }
    } catch {
      setErrorMessage('E-mail ou senha inválidos')
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
            <div className="mb-3 relative group">
              <img
                src={TESLA_LOGO_URL}
                alt="Logotipo Tesla Mecatrônica"
                className="h-20 w-20 rounded-full object-cover shadow-lg border-2 border-[#0D47A1]/20 bg-[#06152b] ring-4 ring-white"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
              Gente e Gestão Tesla
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0D47A1] mt-1">
              Tesla Mecatrônica • Plataforma RH
            </p>
          </div>

          <Card className="border border-[#E0E0E0] bg-white shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold tracking-tight text-[#212121]">
                Acesse sua conta
              </CardTitle>
              <CardDescription className="text-sm text-[#757575]">
                Entre com seu e-mail corporativo
              </CardDescription>
            </CardHeader>

            <CardContent>
              {errorMessage && (
                <Alert
                  variant="destructive"
                  className="mb-4 bg-[#FFEBEE] text-[#C62828] border-[#C62828]/20"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm font-medium">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      className="pl-9 border-[#E0E0E0] focus-visible:ring-[#1565C0] focus-visible:ring-offset-0"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-[#212121]">
                      Senha
                    </Label>
                    <Link
                      to="/esqueci-senha"
                      className="text-xs font-medium text-[#0D47A1] hover:underline"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-[#757575]" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="pl-9 pr-10 border-[#E0E0E0] focus-visible:ring-[#1565C0] focus-visible:ring-offset-0"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isSubmitting}
                      className="absolute right-3 top-3 text-[#757575] hover:text-[#212121] focus:outline-none"
                      aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
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
                      Autenticando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-[#757575]">
        © {new Date().getFullYear()} Gente e Gestão Tesla RH Ltda. Todos os direitos reservados.
      </footer>
    </div>
  )
}
