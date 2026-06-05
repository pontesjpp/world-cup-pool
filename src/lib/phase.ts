import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// A Copa já começou? (primeiro jogo já passou). Usado para a troca temporal de
// navegação: antes → "Pré-Copa"; depois → "Realizadas". Cacheado por request:
// Navbar e BottomNav renderizam juntos e compartilham a mesma consulta.
export const tournamentStarted = cache(async (): Promise<boolean> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('partidas')
    .select('data_jogo')
    .order('data_jogo', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!data?.data_jogo) return false
  return new Date(data.data_jogo).getTime() <= Date.now()
})
