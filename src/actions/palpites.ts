'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PalpiteResult = { ok: boolean; message: string }

// Salva / atualiza o palpite do usuário logado para uma partida.
// A RLS garante que só dá pra salvar antes do início do jogo.
export async function salvarPalpite(formData: FormData): Promise<PalpiteResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sessão expirada. Faça login novamente.' }

  const partidaId = formData.get('partidaId') as string
  const casa = Number(formData.get('palpiteCasa'))
  const fora = Number(formData.get('palpiteFora'))

  if (!partidaId) return { ok: false, message: 'Partida inválida.' }
  if (!Number.isInteger(casa) || !Number.isInteger(fora) || casa < 0 || fora < 0) {
    return { ok: false, message: 'Informe um placar válido para os dois times.' }
  }
  if (casa > 15 || fora > 15) {
    return { ok: false, message: 'O placar máximo permitido é 15.' }
  }

  // Determina a fase do palpite: jogos de grupo (grupo != null) são GRUPO
  // (congelam no prazo da pré-Copa); demais são MATA (congelam 5 min antes).
  const { data: partida } = await supabase
    .from('partidas')
    .select('grupo')
    .eq('id', partidaId)
    .single()
  const fasePalpite = partida?.grupo ? 'GRUPO' : 'MATA'

  const { error } = await supabase.from('palpites').upsert(
    {
      user_id: user.id,
      partida_id: partidaId,
      palpite_casa: casa,
      palpite_fora: fora,
      fase_palpite: fasePalpite,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,partida_id' }
  )

  if (error) {
    // RLS rejeita após o kickoff (ou se a partida não existe)
    return { ok: false, message: 'Não foi possível salvar — o jogo já começou?' }
  }

  revalidatePath('/')
  return { ok: true, message: 'Palpite salvo!' }
}
