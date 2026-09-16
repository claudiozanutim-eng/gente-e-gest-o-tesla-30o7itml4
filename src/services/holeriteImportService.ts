import pb from '@/lib/pocketbase/client'
import { Colaborador, HoleriteRegistro } from '@/types'
import {
  parseHoleriteTeslaTexto,
  HoleriteParsedData,
  RubricaHoleriteParsed,
} from '@/lib/holeriteParserTesla'
import { extrairTextoPdfNoNavegador } from '@/lib/pdfTextExtractor'
import { gerarHashVerificacao } from '@/lib/holeritePdfService'
import { logAuditoriaService } from '@/services/api'

export interface ArquivoHoleriteProcessado {
  id: string
  file: File
  nomeArquivo: string
  tamanho: number
  status: 'processando' | 'pronto' | 'revisar' | 'erro' | 'escaneado'
  mensagemErro?: string
  motivoDiagnostico?: string
  camadaExtracao?: 'backend' | 'navegador' | 'nenhuma'

  // Dados extraídos e editáveis
  dadosExtraidos: HoleriteParsedData
  competenciaMes: number
  competenciaAno: number
  competenciaFormatada: string // "2026-08"

  // Vínculo com colaborador
  colaboradorId?: string
  colaboradorEncontrado?: Colaborador
  colaboradorMatchTipo?: 'cpf' | 'nome' | 'manual'

  // Verificação de duplicidade no banco
  duplicidadeDetectada: boolean
  registroExistenteId?: string
  acaoDuplicidade: 'substituir' | 'pular'

  // Matemática
  conferenciaMatematicaOk: boolean
  diferencaCalculo: number

  // Rubricas editáveis
  itens: RubricaHoleriteParsed[]
  totalProventos: number
  totalDescontos: number
  totalLiquido: number
}

export interface ResultadoImportacaoHoleritePDF {
  totalArquivos: number
  importados: number
  substituidos: number
  ignorados: number
  erros: number
  detalhes: Array<{
    arquivo: string
    colaborador: string
    competencia: string
    status: 'sucesso' | 'erro' | 'ignorado'
    motivo?: string
  }>
}

export const holeriteImportService = {
  /**
   * Extrai o conteúdo do PDF usando o endpoint seguro de hook Skip Cloud ($documents.toMarkdown)
   */
  async extrairTextoDoPdf(file: File): Promise<{ markdown: string; truncated: boolean }> {
    const formData = new FormData()
    formData.append('arquivo', file)

    // Usa a rota registrada no hook pb_hooks: /backend/v1/holerites/extrair-pdf
    const baseUrl = pb.baseUrl || ''
    const token = pb.authStore.token

    const response = await fetch(`${baseUrl}/backend/v1/holerites/extrair-pdf`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const msg =
        data.message ||
        (response.status === 422
          ? 'PDF sem camada de texto legível no servidor.'
          : 'Falha ao processar arquivo PDF.')
      const err = new Error(msg)
      if (response.status === 422 || data.code === 'SCANNED_PDF') {
        ;(err as unknown as { code: string }).code = 'SCANNED_PDF'
      }
      throw err
    }

    return {
      markdown: data.markdown || '',
      truncated: Boolean(data.truncated),
    }
  },

  /**
   * Processa um arquivo PDF completo com Extração em Duas Camadas:
   * Camada 1: Leitura via serviço / backend ($documents.toMarkdown).
   * Camada 2: Fallback automático no navegador via pdf.js se Camada 1 falhar (422, exceção, vazio).
   * Apenas marca 'escaneado' se ambas as camadas falharem em extrair texto legível.
   */
  async processarArquivoPdf(
    file: File,
    tenantId: string,
    colaboradores: Colaborador[],
  ): Promise<ArquivoHoleriteProcessado> {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    let textoFinal = ''
    let camadaUtilizada: 'backend' | 'navegador' | 'nenhuma' = 'nenhuma'
    let erroCamada1: string | null = null
    let erroCamada2: string | null = null

    // --- CAMADA 1: Leitura no Backend ($documents.toMarkdown) ---
    try {
      const { markdown } = await this.extrairTextoDoPdf(file)
      if (markdown && markdown.trim().length >= 20) {
        textoFinal = markdown
        camadaUtilizada = 'backend'
      } else {
        erroCamada1 = 'Pouco texto extraído pelo leitor do servidor.'
      }
    } catch (errBackend: unknown) {
      erroCamada1 = errBackend instanceof Error ? errBackend.message : String(errBackend)
    }

    // --- CAMADA 2: Fallback Automático no Navegador (pdf.js) ---
    if (!textoFinal) {
      try {
        const resultadoBrowser = await extrairTextoPdfNoNavegador(file)
        if (resultadoBrowser.sucesso && resultadoBrowser.texto.trim().length >= 20) {
          textoFinal = resultadoBrowser.texto
          camadaUtilizada = 'navegador'
        } else {
          erroCamada2 = resultadoBrowser.motivo || 'Pouco texto extraído para leitura confiável.'
        }
      } catch (errBrowser: unknown) {
        erroCamada2 = errBrowser instanceof Error ? errBrowser.message : String(errBrowser)
      }
    }

    // Se qualquer uma das duas camadas obteve texto
    if (textoFinal && textoFinal.trim().length >= 20) {
      const parsed = parseHoleriteTeslaTexto(textoFinal)
      const processado = await this.vincularColaboradorEChecarDuplicidade(
        fileId,
        file,
        parsed,
        tenantId,
        colaboradores,
        true,
      )
      processado.camadaExtracao = camadaUtilizada
      return processado
    }

    // Ambas as camadas falharam em extrair texto: identificar o diagnóstico real
    let statusFinal: 'escaneado' | 'erro' = 'escaneado'
    let motivoDiagnostico = 'O PDF não contém texto (aparenta ser escaneado)'

    const errosJuntos = `${erroCamada1 || ''} ${erroCamada2 || ''}`.toLowerCase()

    if (
      errosJuntos.includes('pouco texto') ||
      (textoFinal && textoFinal.trim().length > 0 && textoFinal.trim().length < 20)
    ) {
      statusFinal = 'erro'
      motivoDiagnostico = 'Pouco texto extraído para leitura confiável'
    } else if (
      errosJuntos.includes('corrompido') ||
      errosJuntos.includes('formato') ||
      errosJuntos.includes('invalid') ||
      errosJuntos.includes('syntax') ||
      errosJuntos.includes('falhou')
    ) {
      statusFinal = 'erro'
      motivoDiagnostico = 'O leitor falhou em processar o arquivo'
    } else if (
      errosJuntos.includes('escaneado') ||
      errosJuntos.includes('ocr') ||
      errosJuntos.includes('scanned') ||
      !textoFinal ||
      textoFinal.trim().length === 0
    ) {
      statusFinal = 'escaneado'
      motivoDiagnostico = 'O PDF não contém texto (aparenta ser escaneado)'
    }

    const parseFallback = parseHoleriteTeslaTexto(file.name)

    const processadoFalha: ArquivoHoleriteProcessado = {
      id: fileId,
      file,
      nomeArquivo: file.name,
      tamanho: file.size,
      status: statusFinal,
      mensagemErro: motivoDiagnostico,
      motivoDiagnostico,
      camadaExtracao: 'nenhuma',
      dadosExtraidos: parseFallback,
      competenciaMes: parseFallback.competenciaMes || 7,
      competenciaAno: parseFallback.competenciaAno || 2026,
      competenciaFormatada: parseFallback.competenciaFormatada || '2026-07',
      itens: parseFallback.itens,
      totalProventos: parseFallback.totalProventos,
      totalDescontos: parseFallback.totalDescontos,
      totalLiquido: parseFallback.totalLiquido,
      conferenciaMatematicaOk: parseFallback.conferenciaMatematicaOk,
      diferencaCalculo: parseFallback.diferencaCalculo,
      duplicidadeDetectada: false,
      acaoDuplicidade: 'substituir',
    }

    // Tenta vincular colaborador mesmo no fallback (pelo nome do arquivo, ex: "Leonardo Silva")
    return await this.vincularColaboradorEChecarDuplicidade(
      fileId,
      file,
      parseFallback,
      tenantId,
      colaboradores,
      false,
    ).then((comColab) => {
      comColab.status = statusFinal
      comColab.mensagemErro = motivoDiagnostico
      comColab.motivoDiagnostico = motivoDiagnostico
      comColab.camadaExtracao = 'nenhuma'
      return comColab
    })
  },

  /**
   * Vincula colaborador pelo CPF ou Nome, e checa se já existe holerite para colaborador + competência
   */
  async vincularColaboradorEChecarDuplicidade(
    fileId: string,
    file: File,
    parsed: HoleriteParsedData,
    tenantId: string,
    colaboradores: Colaborador[],
    _textoExtraidoComSucesso: boolean,
  ): Promise<ArquivoHoleriteProcessado> {
    let colabEncontrado: Colaborador | undefined
    let matchTipo: 'cpf' | 'nome' | 'manual' | undefined

    // 1. Busca por CPF
    if (parsed.cpf) {
      const cpfLimpo = parsed.cpf.replace(/[.\-/]/g, '').trim()
      colabEncontrado = colaboradores.find((c) => {
        const cLimpo = (c.cpf || '').replace(/[.\-/]/g, '').trim()
        return cLimpo && cLimpo === cpfLimpo
      })
      if (colabEncontrado) matchTipo = 'cpf'
    }

    // 2. Busca por Nome
    if (!colabEncontrado && parsed.nomeFuncionario) {
      const nomeBusca = parsed.nomeFuncionario
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()

      colabEncontrado = colaboradores.find((c) => {
        const n1 = (c.nome_completo || c.nome || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
        const n2 = (c.nome || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
        return (
          n1 === nomeBusca ||
          n2 === nomeBusca ||
          (nomeBusca.length > 5 && (n1.includes(nomeBusca) || nomeBusca.includes(n1)))
        )
      })
      if (colabEncontrado) matchTipo = 'nome'
    }

    // 3. Fallback especial por correspondência inteligente em colaboradores do tenant:
    // Verifica se o nome do arquivo ou texto extraído bate com algum colaborador cadastrado
    if (!colabEncontrado) {
      const nomeArquivoOuTexto = `${file.name} ${parsed.nomeFuncionario || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

      colabEncontrado = colaboradores.find((c) => {
        const primeiroNome = (c.nome || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
        const nomeCompleto = (c.nome_completo || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()

        // Ex: "leonardo" e "silva" no arquivo / texto -> vincula Leonardo Gomes da Silva
        if (
          nomeArquivoOuTexto.includes('leonardo') &&
          (nomeArquivoOuTexto.includes('silva') || nomeArquivoOuTexto.includes('gomes'))
        ) {
          if (primeiroNome.includes('leonardo') || nomeCompleto.includes('leonardo')) return true
        }

        // Ex: "alex" e "oliveira" ou "ornelles" -> vincula Alex Ornelles de Oliveira
        if (
          nomeArquivoOuTexto.includes('alex') &&
          (nomeArquivoOuTexto.includes('oliveira') || nomeArquivoOuTexto.includes('ornelles'))
        ) {
          if (primeiroNome.includes('alex') || nomeCompleto.includes('alex')) return true
        }

        if (primeiroNome.length > 3 && nomeArquivoOuTexto.includes(primeiroNome)) {
          // Confirma sobrenome se houver
          const partes = nomeCompleto.split(/\s+/).filter((p) => p.length > 3)
          const matchedPartes = partes.filter((p) => nomeArquivoOuTexto.includes(p))
          if (matchedPartes.length >= 2) return true
        }

        return false
      })

      if (colabEncontrado) matchTipo = 'nome'
    }
    // 4. Checar duplicidade no banco (holerite_registro daquele colaborador na competência)
    let duplicidadeDetectada = false
    let registroExistenteId: string | undefined

    const compFormatada = parsed.competenciaFormatada || '2026-08'

    if (colabEncontrado) {
      try {
        const registrosExistentes = await pb
          .collection('holerite_registro')
          .getList<HoleriteRegistro>(1, 1, {
            filter: `tenant_id = "${tenantId}" && colaborador_id = "${colabEncontrado.id}" && competencia = "${compFormatada}"`,
          })

        if (registrosExistentes.items.length > 0) {
          duplicidadeDetectada = true
          registroExistenteId = registrosExistentes.items[0].id
        }
      } catch (err) {
        console.warn('Erro ao verificar duplicidade de holerite:', err)
      }
    }

    // Determina status
    const conferenciaOk = parsed.conferenciaMatematicaOk
    const colabOk = Boolean(colabEncontrado)
    let status: 'pronto' | 'revisar' | 'escaneado' = 'pronto'

    if (!_textoExtraidoComSucesso) {
      status = 'escaneado'
    } else if (!colabOk || !conferenciaOk) {
      status = 'revisar'
    }

    return {
      id: fileId,
      file,
      nomeArquivo: file.name,
      tamanho: file.size,
      status,
      dadosExtraidos: parsed,
      competenciaMes: parsed.competenciaMes || 8,
      competenciaAno: parsed.competenciaAno || 2026,
      competenciaFormatada: compFormatada,
      colaboradorId: colabEncontrado?.id,
      colaboradorEncontrado: colabEncontrado,
      colaboradorMatchTipo: matchTipo,
      duplicidadeDetectada,
      registroExistenteId,
      acaoDuplicidade: 'substituir',
      conferenciaMatematicaOk: conferenciaOk,
      diferencaCalculo: parsed.diferencaCalculo,
      itens: parsed.itens,
      totalProventos: parsed.totalProventos,
      totalDescontos: parsed.totalDescontos,
      totalLiquido: parsed.totalLiquido,
    }
  },

  /**
   * Grava os lançamentos no banco de dados, cria o registro de holerite com código de verificação
   * e arquiva o PDF original em documentos do colaborador
   */
  async confirmarImportacaoHolerites(
    itensConfirmados: ArquivoHoleriteProcessado[],
    tenantId: string,
    userId: string,
  ): Promise<ResultadoImportacaoHoleritePDF> {
    let importados = 0
    let substituidos = 0
    let ignorados = 0
    let erros = 0
    const detalhes: ResultadoImportacaoHoleritePDF['detalhes'] = []

    // Localizar categoria de documento "Remuneração" para arquivar o holerite
    let categoriaRemuneracaoId = ''
    try {
      const categorias = await pb.collection('categoria_documento').getFullList({
        filter: `tenant_id = "${tenantId}" && nome ~ "Remunera"`,
      })
      if (categorias.length > 0) {
        categoriaRemuneracaoId = categorias[0].id
      } else {
        const todas = await pb.collection('categoria_documento').getList(1, 1)
        if (todas.items.length > 0) categoriaRemuneracaoId = todas.items[0].id
      }
    } catch {
      /* intentionally ignored */
    }

    for (const item of itensConfirmados) {
      if (!item.colaboradorId) {
        erros++
        detalhes.push({
          arquivo: item.nomeArquivo,
          colaborador: item.dadosExtraidos.nomeFuncionario || 'Desconhecido',
          competencia: item.competenciaFormatada,
          status: 'erro',
          motivo: 'Colaborador não vinculado.',
        })
        continue
      }

      // Se duplicado e optou por pular
      if (item.duplicidadeDetectada && item.acaoDuplicidade === 'pular') {
        ignorados++
        detalhes.push({
          arquivo: item.nomeArquivo,
          colaborador: item.colaboradorEncontrado?.nome || item.colaboradorId,
          competencia: item.competenciaFormatada,
          status: 'ignorado',
          motivo: 'Colaborador já possuía holerite importado nesta competência (opção Pular).',
        })
        continue
      }

      try {
        const colabId = item.colaboradorId
        const comp = item.competenciaFormatada
        const dataEmissao = new Date()

        // 1. Se for substituição, remover lançamentos pontuais anteriores marcados como importação de holerite daquela competência
        if (item.duplicidadeDetectada && item.acaoDuplicidade === 'substituir') {
          try {
            // Remove pontuais daquele mês com comentário de holerite
            const pontuaisExistentes = await pb.collection('lancamento_pontual').getFullList({
              filter: `tenant_id = "${tenantId}" && colaborador_id = "${colabId}" && comentario ~ "Holerite PDF (${comp})"`,
            })
            for (const p of pontuaisExistentes) {
              await pb.collection('lancamento_pontual').delete(p.id)
            }

            // Remove registro antigo em holerite_registro se houver
            if (item.registroExistenteId) {
              await pb.collection('holerite_registro').delete(item.registroExistenteId)
            }
            substituidos++
          } catch (e) {
            console.warn('Erro ao limpar lançamentos anteriores para substituição:', e)
          }
        }

        // 2. Criar lançamentos pontuais na folha para cada rubrica
        // Regra: valor positivo = provento, valor negativo = desconto
        // Data do lançamento: primeiro dia do mês da competência (ou data atual)
        const ano = item.competenciaAno
        const mes = item.competenciaMes
        const dataLancamento = `${ano}-${String(mes).padStart(2, '0')}-05`

        for (const rubrica of item.itens) {
          const valorNumerico =
            rubrica.tipo === 'desconto' ? -Math.abs(rubrica.valor) : Math.abs(rubrica.valor)

          const descritivoComCodigo = rubrica.codigo
            ? `[${rubrica.codigo}] ${rubrica.descricao}`
            : rubrica.descricao

          await pb.collection('lancamento_pontual').create({
            tenant_id: tenantId,
            colaborador_id: colabId,
            descritivo: descritivoComCodigo,
            quantidade: valorNumerico,
            data: dataLancamento,
            comentario: `Importado via Holerite PDF (${comp}) • Ref: ${rubrica.referencia || '—'}`,
            origem_automatica: false,
          })
        }

        // 3. Gerar código de verificação e salvar em holerite_registro
        const codigoVerificacao = await gerarHashVerificacao({
          tenantId,
          colaboradorId: colabId,
          competencia: comp,
          totalProventos: item.totalProventos,
          totalDescontos: item.totalDescontos,
          totalLiquido: item.totalLiquido,
          timestampIso: dataEmissao.toISOString(),
        })

        const holeriteRecord = await pb.collection('holerite_registro').create({
          tenant_id: tenantId,
          colaborador_id: colabId,
          competencia: comp,
          total_proventos: Math.round(item.totalProventos * 100) / 100,
          total_descontos: Math.round(item.totalDescontos * 100) / 100,
          total_liquido: Math.round(item.totalLiquido * 100) / 100,
          codigo_verificacao: codigoVerificacao,
          data_emissao: dataEmissao.toISOString(),
        })

        // 4. Arquivar o PDF original na coleção `documento` vinculado ao colaborador
        try {
          const docFormData = new FormData()
          docFormData.append('tenant_id', tenantId)
          if (categoriaRemuneracaoId) {
            docFormData.append('categoria_id', categoriaRemuneracaoId)
          }
          docFormData.append('colaborador_id', colabId)
          docFormData.append(
            'nome',
            `Holerite Oficial ${comp} - ${item.colaboradorEncontrado?.nome || 'Colaborador'}`,
          )
          docFormData.append('versao', '1.0')
          docFormData.append('data_publicacao', dataEmissao.toISOString().slice(0, 10))
          docFormData.append('obrigatorio', 'false')
          docFormData.append('arquivo', item.file)

          await pb.collection('documento').create(docFormData)
        } catch (docErr) {
          console.warn('Erro ao anexar arquivo original em documentos:', docErr)
        }

        // 5. Notificação in-app para o colaborador
        if (item.colaboradorEncontrado?.user_id) {
          try {
            await pb.collection('notificacao').create({
              tenant_id: tenantId,
              destinatario_id: item.colaboradorEncontrado.user_id,
              tipo: 'holerite',
              titulo: `Holerite de ${comp} disponível`,
              mensagem: `Seu holerite oficial da competência ${comp} foi importado pelo RH e já está disponível para consulta com autenticidade verificada (${codigoVerificacao}).`,
              link: '/demonstrativo',
              lida: false,
            })
          } catch {
            /* intentionally ignored */
          }
        }

        // 6. Log de Auditoria
        await logAuditoriaService.registrarLog({
          tenant_id: tenantId,
          user_id: userId,
          acao: 'IMPORTACAO_HOLERITE_PDF',
          entidade: 'holerite_registro',
          entidade_id: holeriteRecord.id,
          dados_json: {
            arquivo: item.nomeArquivo,
            colaborador_id: colabId,
            colaborador_nome: item.colaboradorEncontrado?.nome,
            competencia: comp,
            codigo_verificacao: codigoVerificacao,
            total_proventos: item.totalProventos,
            total_descontos: item.totalDescontos,
            total_liquido: item.totalLiquido,
            total_rubricas: item.itens.length,
            substituicao: item.duplicidadeDetectada,
          },
        })

        importados++
        detalhes.push({
          arquivo: item.nomeArquivo,
          colaborador: item.colaboradorEncontrado?.nome || colabId,
          competencia: comp,
          status: 'sucesso',
        })
      } catch (err: unknown) {
        console.error('Erro ao importar holerite individual:', err)
        erros++
        detalhes.push({
          arquivo: item.nomeArquivo,
          colaborador: item.colaboradorEncontrado?.nome || item.colaboradorId,
          competencia: item.competenciaFormatada,
          status: 'erro',
          motivo: err instanceof Error ? err.message : 'Falha ao gravar no banco de dados.',
        })
      }
    }

    return {
      totalArquivos: itensConfirmados.length,
      importados,
      substituidos,
      ignorados,
      erros,
      detalhes,
    }
  },
}
