'use client'

// Lista recolhível "palpites da galera": quem cravou o quê e quantos pontos
// somou (encerrado) ou está somando (ao vivo, parcial). Ordem decrescente já
// vem pronta do servidor (rankFinalizado / rankAoVivo). Aqui é só aberto/fechado.

import { useState } from 'react'
import Image from 'next/image'
import { Users, ChevronDown } from 'lucide-react'
import type { RankedPalpite } from '@/lib/palpitesGalera'

function Avatar({ nome, url }: { nome: string; url: string | null }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={nome}
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full border border-white/10 object-cover"
      />
    )
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-void/60 font-display text-xs uppercase text-cream/70">
      {nome.charAt(0)}
    </div>
  )
}

type Props = {
  palpites: RankedPalpite[]
  // Ao vivo: pontos são provisórios (placar parcial). Muda o rótulo.
  live?: boolean
}

export function PalpitesGalera({ palpites, live = false }: Props) {
  const [open, setOpen] = useState(false)
  if (palpites.length === 0) return null

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="motion-cinema flex w-full items-center justify-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brasil-gold/80 hover:text-brasil-gold"
      >
        <Users size={14} />
        {open ? 'Esconder palpites da galera' : 'Ver palpites da galera'}
        <span className="tabular text-cream/40">({palpites.length})</span>
        <ChevronDown size={14} className={`motion-cinema ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4">
          {live && (
            <p className="mb-2 text-center font-sans text-[10px] uppercase tracking-[0.2em] text-flare/80">
              Pontos parciais · placar ao vivo
            </p>
          )}
          <ol className="space-y-1">
            {palpites.map((p, i) => (
              <li
                key={p.user_id}
                className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${
                  p.isMe ? 'bg-brasil-gold/[0.08] ring-1 ring-brasil-gold/20' : ''
                }`}
              >
                <span className="tabular w-5 shrink-0 text-center font-display text-sm text-cream/30">
                  {i + 1}
                </span>
                <Avatar nome={p.nome} url={p.avatar_url} />
                <span className="min-w-0 flex-1 truncate font-sans text-[13px] text-cream/80">
                  {p.nome}
                  {p.isMe && (
                    <span className="ml-1 font-semibold uppercase tracking-wide text-[10px] text-brasil-gold/70">
                      você
                    </span>
                  )}
                </span>
                <span className="tabular shrink-0 font-display text-sm tracking-score text-cream/60">
                  {p.palpite_casa}–{p.palpite_fora}
                </span>
                <span
                  className={`tabular w-12 shrink-0 text-right font-display text-sm uppercase ${
                    p.pontos > 0 ? 'text-pitch-vivid' : 'text-cream/30'
                  }`}
                >
                  +{p.pontos}
                  {p.solitario && (
                    <span title="Bônus de placar solitário" className="text-brasil-gold">
                      {' '}
                      ★
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export default PalpitesGalera
