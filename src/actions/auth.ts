'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Se a pessoa enviou uma foto, sobe pro Storage e grava no profile.
  // Usa o admin client porque o trigger que cria o profile já rodou e
  // não dependemos da sessão estar montada nesse instante.
  if (userId && avatar && avatar.size > 0) {
    const admin = createAdminClient()
    const ext = (avatar.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadError } = await admin.storage
      .from('avatars')
      .upload(path, avatar, {
        contentType: avatar.type || 'image/jpeg',
        upsert: true,
      })

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = admin.storage.from('avatars').getPublicUrl(path)

      await admin
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
