import teslaLogoUrl from '@/assets/images-17327.jpg'

export const TESLA_LOGO_URL = teslaLogoUrl

let cachedBase64: string | null = null

/**
 * Converte a URL do logotipo para Data URL Base64 de forma assíncrona
 * e com cache para inserção limpa em documentos jsPDF sem problemas de CORS.
 */
export async function getTeslaLogoBase64(): Promise<string> {
  if (cachedBase64) {
    return cachedBase64
  }

  try {
    const response = await fetch(TESLA_LOGO_URL)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64data = reader.result as string
        cachedBase64 = base64data
        resolve(base64data)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.warn('Falha ao carregar logotipo em base64:', err)
    return TESLA_LOGO_URL
  }
}
