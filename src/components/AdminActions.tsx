'use client'

import { useTransition, useState } from 'react'
import { RefreshCw, Calculator } from 'lucide-react'
import { sincronizarPartidas } from '@/actions/admin'
import { calcularPontuacao } from '@/actions/pontuacao'

export default function AdminActions() {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState(false)

  function rodarSync() {
    setMsg(null)
    startTransition(async () => {
      const res = await sincronizarPartidas()
      setErro(!res.ok)
      setMsg(res.message)
    })
  }

  function rodarRecalculo() {
    setMsg(null)
    startTransition(async () => {
      try {
        await calcularPontuacao()
        setErro(false)
        setMsg('Pontuação recalculada.')
      } catch (e) {
        setErro(true)
        setMsg((e as Error).message)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={rodarSync}
          disabled={isPending}
          className="motion-cinema flex items-center justify-center gap-2 rounded-xl bg-pitch-vivid px-5 py-3 font-display text-sm uppercase tracking-wide text-white hover:brightness-110 disabled:opacity-50"
        >
          <RefreshCw size={18} className={isPending ? 'animate-spin' : ''} />
          Sincronizar partidas
        </button>
        <button
          onClick={rodarRecalculo}
          disabled={isPending}
          className="motion-cinema flex items-center justify-center gap-2 rounded-xl border border-cream/15 bg-transparent px-5 py-3 font-display text-sm uppercase tracking-wide text-cream/80 hover:border-cream/40 hover:text-cream disabled:opacity-50"
        >
          <Calculator size={18} />
          Recalcular pontuação
        </button>
      </div>
      {msg && (
        <p
          className={`font-sans text-sm font-medium ${erro ? 'text-flare' : 'text-pitch-vivid'}`}
        >
          {msg}
        </p>
      )}
    </div>
  )
}
