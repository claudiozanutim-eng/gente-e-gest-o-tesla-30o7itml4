/**
 * Funções utilitárias de validação e formatação para o módulo de Colaboradores
 */

/**
 * Valida o formato e dígitos verificadores de um CPF brasileiro
 */
export function validarCpf(cpf: string): boolean {
  if (!cpf) return false
  const clean = cpf.replace(/\D/g, '')

  // CPF deve ter 11 dígitos
  if (clean.length !== 11) return false

  // Dígitos todos iguais são inválidos
  if (/^(\d)\1{10}$/.test(clean)) return false

  // Validação do 1º dígito verificador
  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(clean.charAt(i), 10) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(clean.charAt(9), 10)) return false

  // Validação do 2º dígito verificador
  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(clean.charAt(i), 10) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(clean.charAt(10), 10)) return false

  return true
}

/**
 * Formata um CPF no padrão XXX.XXX.XXX-XX
 */
export function formatarCpf(valor: string): string {
  const clean = valor.replace(/\D/g, '').slice(0, 11)
  if (!clean) return ''
  return clean
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

/**
 * Formata um telefone no padrão brasileiro:
 * (XX) XXXXX-XXXX para 11 dígitos ou (XX) XXXX-XXXX para 10 dígitos
 */
export function formatarTelefone(valor: string): string {
  const clean = valor.replace(/\D/g, '').slice(0, 11)
  if (!clean) return ''
  if (clean.length <= 10) {
    return clean.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^(\d{2})\s(\d{4})(\d)/, '($1) $2-$3')
  }
  return clean.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^(\d{2})\s(\d{5})(\d)/, '($1) $2-$3')
}

/**
 * Formata CEP no formato XXXXX-XXX
 */
export function formatarCep(valor: string): string {
  const clean = valor.replace(/\D/g, '').slice(0, 8)
  if (!clean) return ''
  return clean.replace(/^(\d{5})(\d)/, '$1-$2')
}

/**
 * Validação de formato de e-mail
 */
export function validarEmail(email: string): boolean {
  if (!email) return false
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email.trim())
}

/**
 * Converte data ISO/DB (YYYY-MM-DD ou ISO string) para YYYY-MM-DD local para input type="date"
 */
export function dateToInputString(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) {
      // Se já vier no formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return dateStr.trim()
      return ''
    }
    // Retorna YYYY-MM-DD em UTC
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return ''
  }
}

/**
 * Calcula idade com base em uma data no formato YYYY-MM-DD
 */
export function calcularIdade(dataNascStr?: string): number {
  if (!dataNascStr) return 0
  const d = new Date(dataNascStr)
  if (isNaN(d.getTime())) return 0
  const hoje = new Date()
  let idade = hoje.getFullYear() - d.getFullYear()
  const m = hoje.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) {
    idade--
  }
  return idade
}
