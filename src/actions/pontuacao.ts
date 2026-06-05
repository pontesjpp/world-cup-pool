'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recomputarTudo } from '@/actions/scoring'

// Recalcula TODAS as categorias de pontuação (partidas, classificação,
// chaveamento, bônus finais) lendo as regras atuais. Restrito a admins.
export async function calcularPontuacao() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) throw new Error('Acesso restrito a administradores')

  const res = await recomputarTudo()
  if (!res.ok) throw new Error(res.message)

  revalidatePath('/ranking')
  revalidatePath('/realizadas')
}
