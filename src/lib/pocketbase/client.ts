import PocketBase from 'pocketbase'
import { setupRealtimeRecovery } from './realtimeRecovery'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Configura o patch de auto-recuperação do realtime
setupRealtimeRecovery(pb)

export default pb
