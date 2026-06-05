import Link from 'next/link'
import { login } from '@/actions/auth'
import { AuthField } from '../AuthField'

export default async function LoginPage({
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
            Entra em campo
          </span>
        </div>
        <h1 className="font-display text-4xl uppercase leading-none tracking-wide text-cream">
          Fazer Login
        </h1>
      </div>

      <form className="flex flex-col gap-4">
        {message && (
          <div className="rounded-xl border border-flare/30 bg-flare/10 p-3 text-center font-sans text-sm font-medium text-flare">
            {message}
          </div>
        )}

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
          autoComplete="current-password"
          required
        />

        <button
          formAction={login}
          className="motion-cinema mt-2 rounded-xl bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-4 py-3.5 font-display text-sm uppercase tracking-[0.15em] text-void shadow-lg shadow-brasil-gold/20 hover:brightness-105 active:scale-[0.99]"
        >
          Entrar
        </button>
      </form>

      <p className="mt-8 text-center font-sans text-sm text-cream/50">
        Ainda não tem conta?{' '}
        <Link
          href="/signup"
          className="font-semibold text-brasil-gold underline-offset-4 hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </>
  )
}
