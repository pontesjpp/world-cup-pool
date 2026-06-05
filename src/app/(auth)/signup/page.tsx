import Link from 'next/link'
import { signup } from '@/actions/auth'
import { AuthField } from '../AuthField'
import { AvatarPicker } from '../AvatarPicker'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams

  return (
    <>
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-[2px] w-8 bg-brasil-gold" />
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brasil-gold">
            Convocação
          </span>
        </div>
        <h1 className="font-display text-4xl uppercase leading-none tracking-wide text-cream">
          Criar Conta
        </h1>
      </div>

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

        <AvatarPicker />

        <button
          formAction={signup}
          className="motion-cinema mt-2 rounded-xl bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-4 py-3.5 font-display text-sm uppercase tracking-[0.15em] text-void shadow-lg shadow-brasil-gold/20 hover:brightness-105 active:scale-[0.99]"
        >
          Criar conta
        </button>
      </form>

      <p className="mt-8 text-center font-sans text-sm text-cream/50">
        Já tem conta?{' '}
        <Link
          href="/login"
          className="font-semibold text-brasil-gold underline-offset-4 hover:underline"
        >
          Fazer login
        </Link>
      </p>
    </>
  )
}
