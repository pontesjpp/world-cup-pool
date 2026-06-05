import { createClient } from '@supabase/supabase-js'

// Client com a service-role key — bypassa RLS para escrever resultados de jogos
// e recalcular pontuação. ATENÇÃO: só pode ser importado de Server Actions /
// Route Handlers. NUNCA importe em arquivo 'use client'.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
