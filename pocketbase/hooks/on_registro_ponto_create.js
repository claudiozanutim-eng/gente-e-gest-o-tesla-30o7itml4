// Hook para validação e garantia de integridade em registro_ponto:
// 1. Garante que data_hora seja sempre gerada pelo servidor (evitando manipulação de relógio do usuário)
// 2. Bloqueio de duplicidade: não permite dois registros do mesmo tipo no mesmo dia com intervalo inferior a 60 segundos
onRecordCreateRequest((e) => {
  const record = e.record
  const colabId = record.get('colaborador_id')
  const tipo = record.get('tipo')

  // 1. Data/hora oficial do servidor no momento exato do registro
  const agora = new Date()
  const agoraIso = agora.toISOString()
  record.set('data_hora', agoraIso)

  // 2. Bloqueio de duplicidade (< 60 segundos) para o mesmo colaborador e tipo de registro
  if (colabId && tipo) {
    try {
      // Buscar o último registro desse tipo feito por esse colaborador
      const ultimos = $app.findRecordsByFilter(
        'registro_ponto',
        `colaborador_id = '${colabId}' && tipo = '${tipo}'`,
        '-data_hora',
        1,
        0,
      )

      if (ultimos && ultimos.length > 0) {
        const ultimo = ultimos[0]
        const ultimaDataStr = ultimo.get('data_hora')
        if (ultimaDataStr) {
          const ultimaData = new Date(ultimaDataStr)
          const diffMs = agora.getTime() - ultimaData.getTime()
          const diffSegundos = Math.floor(diffMs / 1000)

          // Se tiver sido registrado há menos de 60 segundos
          if (diffSegundos < 60 && diffSegundos >= -5) {
            const segundosRestantes = Math.max(1, 60 - diffSegundos)
            throw new BadRequestError(
              `Registro duplicado detectado: você já registrou "${tipo}" há ${diffSegundos}s. Aguarde ${segundosRestantes} segundos para tentar novamente.`,
            )
          }
        }
      }
    } catch (err) {
      // Se for BadRequestError já instanciado, relança para o cliente HTTP
      if (err && err.status === 400) {
        throw err
      }
      // Se for outro erro de query/parse que contenha a mensagem amigável, propaga
      const msg = err && err.message ? err.message : String(err)
      if (msg.includes('Registro duplicado detectado')) {
        throw new BadRequestError(msg)
      }
      console.log('Aviso ao verificar duplicidade de ponto:', msg)
    }
  }

  return e.next()
}, 'registro_ponto')
