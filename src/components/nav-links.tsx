'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Item da navegação mobile (bottom nav) com destaque de rota ativa.
export function BottomNavItem({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  const pathname = usePathname()
  const active = isActive(pathname, href)
  return (
    <Link
      href={href}
      className={`motion-cinema flex flex-1 flex-col items-center justify-center gap-1 ${
        active ? 'text-brasil-gold' : 'text-cream/50 hover:text-brasil-gold'
      }`}
    >
      {icon}
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.15em]">{label}</span>
    </Link>
  )
}

// Link da navegação desktop (navbar) com destaque de rota ativa.
export function TopNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const active = isActive(pathname, href)
  return (
    <Link
      href={href}
      className={`motion-cinema font-sans text-sm font-semibold uppercase tracking-[0.15em] ${
        active ? 'text-brasil-gold' : 'text-cream/60 hover:text-brasil-gold'
      }`}
    >
      {children}
    </Link>
  )
}
