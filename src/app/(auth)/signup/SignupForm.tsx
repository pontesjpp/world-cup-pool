'use client'

import { useRef, useState, useTransition } from 'react'
import { signup } from '@/actions/auth'
import { resizeImageFile } from '@/lib/image'
import { AuthField } from '../AuthField'
import { AvatarPicker } from '../AvatarPicker'

// Formulário de cadastro no cliente. A foto é obrigatória, então o botão fica
// travado até a pessoa escolher uma imagem. No envio, a foto é redimensionada
// no navegador antes de ir para a Server Action — fotos de celular têm vários
// MB e estourariam o limite de corpo da Vercel (~4,5 MB).
export function SignupForm({ message }: { message?: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file || pending) return
    const form = formRef.current
    if (!form) return

    startTransition(async () => {
      const resized = await resizeImageFile(file)
      const fd = new FormData(form)
      fd.set('avatar', resized) // troca o arquivo original pelo reduzido
      await signup(fd) // redireciona no sucesso (ou volta com ?message no erro)
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {message && (
        <div className="rounded-xl border border-flare/30 bg-flare/10 p-3 text-center font-sans text-sm font-medium text-flare">
          {message}
        </div>
      )}

      <AuthField
        id="nome"
        name="nome"
        type="text"
        label="Nome"
        placeholder="Seu nome ou apelido"
        autoComplete="name"
        required
      />
      <AuthField
        id="email"
        name="email"
        type="email"
        label="E-mail"
        placeholder="seu@email.com"
        autoComplete="email"
        required
      />
      <AuthField
        id="password"
        name="password"
        type="password"
        label="Senha"
        placeholder="••••••••"
        autoComplete="new-password"
        required
      />

      <AvatarPicker onSelect={setFile} />

      <button
        type="submit"
        disabled={!file || pending}
        className="motion-cinema mt-2 rounded-xl bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-4 py-3.5 font-display text-sm uppercase tracking-[0.15em] text-void shadow-lg shadow-brasil-gold/20 hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? 'Criando…' : 'Criar conta'}
      </button>
      {!file && (
        <p className="text-center font-sans text-xs text-cream/45">
          Escolha uma foto de perfil para liberar o cadastro.
        </p>
      )}
    </form>
  )
}

export default SignupForm
