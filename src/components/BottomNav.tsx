import { Home, Goal, Trophy, Settings, LogOut, ListChecks, ClipboardCheck, BookOpen } from 'lucide-react';
import { getCurrentProfile } from '@/lib/auth';
import { tournamentStarted } from '@/lib/phase';
import { logout } from '@/actions/auth';
import { BottomNavItem } from '@/components/nav-links';

export default async function BottomNav() {
  const [profile, started] = await Promise.all([getCurrentProfile(), tournamentStarted()]);

  return (
    <nav className="pb-safe fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[rgba(8,12,11,0.75)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-around">
        <BottomNavItem href="/" icon={<Home size={22} />} label="Início" />
        {started ? (
          <BottomNavItem href="/realizadas" icon={<ClipboardCheck size={22} />} label="Realizadas" />
        ) : (
          <BottomNavItem href="/pre-copa" icon={<ListChecks size={22} />} label="Pré-Copa" />
        )}
        <BottomNavItem href="/proximosjogos" icon={<Goal size={22} />} label="Jogos" />
        <BottomNavItem href="/ranking" icon={<Trophy size={22} />} label="Ranking" />
        <BottomNavItem href="/regras" icon={<BookOpen size={22} />} label="Regras" />
        {profile?.is_admin && (
          <BottomNavItem href="/admin" icon={<Settings size={22} />} label="Admin" />
        )}
        {profile && (
          <form action={logout} className="flex-1">
            <button
              type="submit"
              className="motion-cinema flex w-full flex-col items-center justify-center gap-1 text-cream/50 hover:text-flare"
            >
              <LogOut size={22} />
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.15em]">
                Sair
              </span>
            </button>
          </form>
        )}
      </div>
    </nav>
  );
}
