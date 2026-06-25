'use client'

// Item "Mais" da bottom nav (mobile): abre uma folha com os destinos
// secundários (Mata-mata, Regras, Admin, Sair), liberando espaço na barra.

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MoreHorizontal, Workflow, BookOpen, Settings, LogOut, X, LayoutList } from 'lucide-react'
import { logout } from '@/actions/auth'

type Item = { href: string; label: string; icon: typeof Workflow }

export function MoreMenu({ isAdmin, hasUser }: { isAdmin: boolean; hasUser: boolean }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const items: Item[] = [
    { href: '/mata-mata', label: 'Mata-mata', icon: Workflow },
    { href: '/classificacao', label: 'Classificação', icon: LayoutList },
    { href: '/regras', label: 'Regras', icon: BookOpen },
  ]
  if (isAdmin) items.push({ href: '/admin', label: 'Admin', icon: Settings })

  const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const active = items.some((i) => isOn(i.href))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`motion-cinema flex flex-1 flex-col items-center justify-center gap-1 ${
          active ? 'text-brasil-gold' : 'text-cream/50 hover:text-brasil-gold'
        }`}
      >
        <MoreHorizontal size={22} />
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.15em]">Mais</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-void/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-t-[24px] border-t border-white/10 bg-surface pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-cream/40">
                Mais
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-cream/40 hover:text-cream"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="divide-y divide-white/5 px-2 pb-3">
              {items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`motion-cinema flex items-center gap-3 rounded-xl px-3 py-3.5 ${
                    isOn(href) ? 'text-brasil-gold' : 'text-cream/80 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-display text-base uppercase tracking-wide">{label}</span>
                </Link>
              ))}

              {hasUser && (
                <form action={logout}>
                  <button
                    type="submit"
                    className="motion-cinema flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-cream/70 hover:text-flare"
                  >
                    <LogOut size={20} />
                    <span className="font-display text-base uppercase tracking-wide">Sair</span>
                  </button>
                </form>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}

export default MoreMenu
