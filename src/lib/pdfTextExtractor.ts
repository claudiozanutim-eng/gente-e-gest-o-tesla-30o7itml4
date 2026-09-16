/**
 * Utilitário de extração de texto de PDF no navegador (Camada 2 - Fallback do leitor).
 * Carrega dinamicamente a biblioteca pdf.js via CDN com suporte a fallback resiliente.
 */

// Declaração de tipos mínimos para pdfjsLib no window
interface PdfJsTextItem {
  str: string
  transform?: number[]
  width?: number
  height?: number
  hasEOL?: boolean
}

interface PdfJsTextContent {
  items: PdfJsTextItem[]
}

interface PdfJsPage {
  getTextContent: () => Promise<PdfJsTextContent>
}

interface PdfJsDocument {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfJsPage>
  destroy?: () => Promise<void>
}

interface PdfJsLib {
  getDocument: (src: { data: Uint8Array; cMapUrl?: string; cMapPacked?: boolean } | Uint8Array) => {
    promise: Promise<PdfJsDocument>
  }
  GlobalWorkerOptions: {
    workerSrc: string
  }
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib
  }
}

let pdfJsLoadingPromise: Promise<PdfJsLib> | null = null

/**
 * Carrega dinamicamente o pdf.js e configura seu worker
 */
export async function getPdfJsLib(): Promise<PdfJsLib> {
  if (typeof window === 'undefined') {
    throw new Error('Extração no navegador indisponível fora do ambiente browser.')
  }

  if (window.pdfjsLib && window.pdfjsLib.getDocument) {
    return window.pdfjsLib
  }

  if (pdfJsLoadingPromise) {
    return pdfJsLoadingPromise
  }

  pdfJsLoadingPromise = new Promise<PdfJsLib>((resolve, reject) => {
    // CDN URLs estáveis e consagradas para pdf.js v3.11.174
    const cdnScriptUrls = [
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
      'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
    ]

    let currentCdnIndex = 0

    const tryLoadScript = () => {
      if (window.pdfjsLib && window.pdfjsLib.getDocument) {
        configWorker(window.pdfjsLib)
        resolve(window.pdfjsLib)
        return
      }

      if (currentCdnIndex >= cdnScriptUrls.length) {
        reject(
          new Error(
            'Não foi possível inicializar o leitor de PDF auxiliar no navegador. Verifique a conexão com a internet.',
          ),
        )
        return
      }

      const script = document.createElement('script')
      script.src = cdnScriptUrls[currentCdnIndex]
      script.async = true
      script.crossOrigin = 'anonymous'

      script.onload = () => {
        if (window.pdfjsLib && window.pdfjsLib.getDocument) {
          configWorker(window.pdfjsLib)
          resolve(window.pdfjsLib)
        } else {
          currentCdnIndex++
          tryLoadScript()
        }
      }

      script.onerror = () => {
        script.remove()
        currentCdnIndex++
        tryLoadScript()
      }

      document.head.appendChild(script)
    }

    const configWorker = (lib: PdfJsLib) => {
      try {
        if (!lib.GlobalWorkerOptions.workerSrc) {
          lib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        }
      } catch {
        /* intentionally ignored */
      }
    }

    tryLoadScript()
  })

  return pdfJsLoadingPromise
}

export interface ResultadoExtracaoPdfBrowser {
  texto: string
  totalPaginas: number
  caracteres: number
  sucesso: boolean
  motivo?: string
}

/**
 * Lê o arquivo PDF no cliente (File) e extrai o texto página a página
 */
export async function extrairTextoPdfNoNavegador(file: File): Promise<ResultadoExtracaoPdfBrowser> {
  try {
    const pdfjs = await getPdfJsLib()
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    const loadingTask = pdfjs.getDocument({
      data: uint8Array,
      cMapPacked: true,
    })

    const pdfDoc = await loadingTask.promise
    const numPages = pdfDoc.numPages || 1
    const paginasTexto: string[] = []

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i)
      const textContent = await page.getTextContent()

      // Monta as linhas preservando a ordenação vertical aproximada
      // Itens com mesma coordenada Y aproximada formam uma linha com espaços
      const items = textContent.items || []
      if (items.length === 0) continue

      let paginaBuffer = ''
      let ultimoY: number | null = null

      for (const item of items) {
        const str = item.str || ''
        const y = item.transform ? Math.round(item.transform[5]) : null

        if (ultimoY !== null && y !== null && Math.abs(y - ultimoY) > 4) {
          paginaBuffer += '\n'
        } else if (
          paginaBuffer.length > 0 &&
          !paginaBuffer.endsWith('\n') &&
          !paginaBuffer.endsWith(' ')
        ) {
          paginaBuffer += ' '
        }

        paginaBuffer += str
        if (y !== null) ultimoY = y
      }

      paginasTexto.push(paginaBuffer)
    }

    const textoCompleto = paginasTexto.join('\n\n--- Quebra de Página ---\n\n').trim()

    return {
      texto: textoCompleto,
      totalPaginas: numPages,
      caracteres: textoCompleto.length,
      sucesso: textoCompleto.length >= 20,
      motivo:
        textoCompleto.length < 20
          ? 'Pouco texto extraído para leitura confiável (aparenta ser imagem/escaneado).'
          : undefined,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      texto: '',
      totalPaginas: 0,
      caracteres: 0,
      sucesso: false,
      motivo: `O leitor falhou em processar o arquivo (${msg})`,
    }
  }
}
