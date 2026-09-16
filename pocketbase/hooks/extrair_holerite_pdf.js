// Hook para extração de texto estruturado de PDFs de Holerites via $documents.toMarkdown
routerAdd(
  'POST',
  '/backend/v1/holerites/extrair-pdf',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { message: 'Não autorizado' })
    }

    const perfil = authRecord.getString('perfil')
    if (perfil !== 'admin' && perfil !== 'admin_rh') {
      return e.json(403, { message: 'Apenas admin_rh e admin podem importar holerites' })
    }

    const files = e.findUploadedFiles('arquivo')
    if (!files || files.length === 0) {
      return e.json(400, { message: 'Nenhum arquivo PDF foi enviado' })
    }

    const file = files[0]

    try {
      const res = $documents.toMarkdown({ file: file })
      const markdown = res.markdown || ''
      const truncated = Boolean(res.truncated)

      return e.json(200, {
        success: true,
        markdown: markdown,
        truncated: truncated,
        filename: file.name || 'documento.pdf',
        size: file.size || 0,
      })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      const msg = err && err.message ? err.message : String(err)

      // 422 indica ausência de texto legível (PDF escaneado/imagem)
      if (status === 422 || msg.toLowerCase().indexOf('ocr') !== -1) {
        return e.json(422, {
          success: false,
          code: 'SCANNED_PDF',
          message:
            'O PDF enviado é digitalizado/escaneado e não contém camada de texto selecionável. Por favor, envie o PDF digital oficial gerado pelo sistema de folha.',
        })
      }

      if (status === 413) {
        return e.json(413, {
          success: false,
          code: 'FILE_TOO_LARGE',
          message: 'O arquivo PDF excede o limite máximo permitido de 10 MB.',
        })
      }

      return e.json(500, {
        success: false,
        code: 'EXTRACTION_ERROR',
        message: 'Falha interna ao processar o documento PDF.',
      })
    }
  },
  $apis.requireAuth(),
)
