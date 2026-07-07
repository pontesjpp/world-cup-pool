'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { atualizarConfig } from '@/actions/admin'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="motion-cinema flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-6 py-3 font-display uppercase tracking-wide text-void hover:brightness-105 active:scale-[0.99] disabled:opacity-60 sm:w-auto"
    >
      {pending && <Loader2 size={16} className="animate-spin" />}
      {pending ? 'Salvando…' : 'Salvar regras e recalcular'}
    </button>
  )
}

export default function ConfigForm({ children }: { children: React.ReactNode }) {
  const [state, action] = useFormState(atualizarConfig, null)

  return (
    <form action={action} className="space-y-6">
      {children}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton />
        {state && (
          <span
            className={`flex items-center gap-1.5 font-sans text-sm font-medium ${
              state.ok ? 'text-pitch-vivid' : 'text-flare'
            }`}
          >
            {state.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {state.message}
          </span>
        )}
      </div>
    </form>
  )
}
