import PocketBase from 'pocketbase'
import { setupRealtimeRecovery } from './realtimeRecovery'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Configura recuperação resiliente de clientes SSE no serviço de Realtime
setupRealtimeRecovery()

export default pb
