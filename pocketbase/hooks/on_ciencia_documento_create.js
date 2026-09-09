// Hook para auto-preencher ip_origem e data_hora ao criar ciencia_documento via API
onRecordCreateRequest((e) => {
  const reqInfo = e.requestInfo()
  const record = e.record

  // Preenche a data/hora exata se ainda não informada
  if (!record.get('data_hora')) {
    record.set('data_hora', new Date().toISOString())
  }

  // Captura o IP real do cliente pelo PocketBase HTTP context
  // reqInfo.remoteIP ou headers (cf-connecting-ip, x-forwarded-for, x-real-ip)
  let clientIp = ''
  try {
    const headers = reqInfo.headers || {}
    clientIp =
      headers['cf-connecting-ip'] ||
      headers['x-forwarded-for'] ||
      headers['x-real-ip'] ||
      reqInfo.remoteIP ||
      ''
    if (clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim()
    }
  } catch (_) {}

  if (!clientIp) {
    clientIp = reqInfo.remoteIP || '127.0.0.1'
  }

  record.set('ip_origem', clientIp)

  return e.next()
}, 'ciencia_documento')
