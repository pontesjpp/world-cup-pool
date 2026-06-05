import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth';
import { tournamentStarted } from '@/lib/phase';
import { logout } from '@/actions/auth';
import { TopNavLink } from '@/components/nav-links';

export default async function Navbar() {
  const [profile, started] = await Promise.all([getCurrentProfile(), tournamentStarted()]);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[rgba(8,12,11,0.6)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide text-cream"
        >
          <span className="text-brasil-gold">★</span> Bolão da Galera
        </Link>

        <div className="flex items-center gap-8">
          <TopNavLink href="/">Início</TopNavLink>
          {started ? (
            <TopNavLink href="/realizadas">Realizadas</TopNavLink>
          ) : (
            <TopNavLink href="/pre-copa">Pré-Copa</TopNavLink>
          )}
          <TopNavLink href="/proximosjogos">Jogos</TopNavLink>
          <TopNavLink href="/ranking">Ranking</TopNavLink>
          {profile?.is_admin && <TopNavLink href="/admin">Admin</TopNavLink>}
        </div>

        <div className="flex items-center gap-3">
          <span className="font-sans text-sm font-medium text-cream/70">
            {profile?.nome ?? 'Visitante'}
          </span>
          {profile && (
            <form action={logout}>
              <button
                type="submit"
                title="Sair"
                className="motion-cinema font-sans text-xs font-semibold uppercase tracking-[0.15em] text-cream/40 hover:text-flare"
              >
                Sair
              </button>
            </form>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="motion-cinema font-sans text-sm font-semibold uppercase tracking-[0.15em] text-cream/60 hover:text-brasil-gold"
    >
      {children}
    </Link>
  );
}
