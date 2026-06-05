import Link from 'next/link'
import { SignupForm } from './SignupForm'

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

      <SignupForm message={message} />

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
