'use client'

import { useState } from 'react'
import { signup } from '@/actions/auth'
import { AuthField } from '../AuthField'
import { AvatarPicker } from '../AvatarPicker'

// Formulário de cadastro no cliente: a foto é obrigatória, então o botão
// "Criar conta" fica travado até a pessoa escolher uma imagem — evitando o
// redirect que apagaria os campos já digitados.
export function SignupForm({ message }: { message?: string }) {
  const [hasPhoto, setHasPhoto] = useState(false)

  return (
    <form className="flex flex-col gap-4">
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

      <AvatarPicker onSelect={(file) => setHasPhoto(!!file)} />

      <button
        formAction={signup}
        disabled={!hasPhoto}
        className="motion-cinema mt-2 rounded-xl bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-4 py-3.5 font-display text-sm uppercase tracking-[0.15em] text-void shadow-lg shadow-brasil-gold/20 hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Criar conta
      </button>
      {!hasPhoto && (
        <p className="text-center font-sans text-xs text-cream/45">
          Escolha uma foto de perfil para liberar o cadastro.
        </p>
      )}
    </form>
  )
}

export default SignupForm
