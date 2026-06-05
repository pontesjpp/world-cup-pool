'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Sobe a foto pro Storage e grava a URL no profile (com cache-bust no fim para
// a imagem nova aparecer na hora mesmo quando o caminho não muda). Usa o admin
// client porque o trigger que cria o profile já rodou e não dependemos da
// sessão estar montada. Retorna true em caso de sucesso.
async function uploadAvatar(userId: string, avatar: File): Promise<boolean> {
  const admin = createAdminClient()
  const ext = (avatar.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/avatar.${ext}`

  const { error: uploadError } = await admin.storage.from('avatars').upload(path, avatar, {
    contentType: avatar.type || 'image/jpeg',
    upsert: true,
  })
  if (uploadError) return false

  const {
    data: { publicUrl },
  } = admin.storage.from('avatars').getPublicUrl(path)

  const { error: updError } = await admin
    .from('profiles')
    .update({ avatar_url: `${publicUrl}?v=${Date.now()}` })
    .eq('id', userId)

  return !updError
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Redireciona de volta com erro na URL para mostrarmos na tela
    redirect('/login?message=E-mail ou senha incorretos')
  }

  // Atualiza o cache da página e manda pro dashboard
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const nome = formData.get('nome') as string
  const avatar = formData.get('avatar') as File | null

  // Foto de perfil é obrigatória. Valida antes de criar a conta para não
  // deixar usuário sem foto. (Backstop do client; a UI também exige.)
  if (!avatar || avatar.size === 0) {
    redirect('/signup?message=Adicione uma foto de perfil para criar a conta.')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome: nome, // Salva o nome nos metadados do usuário
      },
    },
  })

  if (error) {
    redirect('/signup?message=Erro ao criar conta. Tente novamente.')
  }

  const userId = data.user?.id
  if (userId) {
    await uploadAvatar(userId, avatar)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

// Atualiza a foto de perfil do usuário LOGADO. Usada pelo aviso que aparece
// para quem criou a conta antes da foto virar obrigatória.
export async function atualizarFotoPerfil(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada. Faça login novamente.' }

  const avatar = formData.get('avatar') as File | null
  if (!avatar || avatar.size === 0) {
    return { error: 'Escolha uma foto para enviar.' }
  }

  const ok = await uploadAvatar(user.id, avatar)
  if (!ok) return { error: 'Não foi possível enviar a foto. Tente novamente.' }

  revalidatePath('/', 'layout')
  return {}
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
