import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type CurrentProfile = {
  id: string
  nome: string
  avatar_url: string | null
  is_admin: boolean
}

// Valida o usuário logado no servidor do Supabase. Embrulhado em cache() do
// React: na mesma renderização, várias chamadas (página + Navbar + BottomNav +
// callouts) reaproveitam o mesmo round-trip em vez de revalidar o token a cada
// vez. Use sempre esta função em componentes de servidor, nunca getUser() direto.
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

// Retorna o profile do usuário logado (ou null). Usado por componentes de
// servidor que precisam do nome e da flag de admin.
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const user = await getCachedUser()
  if (!user) return null

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nome, avatar_url, is_admin')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // fallback caso o trigger ainda não tenha rodado
    return {
      id: user.id,
      nome: (user.user_metadata?.nome as string) ?? 'Participante',
      avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
      is_admin: false,
    }
  }
  return profile as CurrentProfile
})
