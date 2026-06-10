import { Home, Goal, Trophy, ListChecks, ClipboardCheck } from 'lucide-react';
import { getCurrentProfile } from '@/lib/auth';
import { tournamentStarted } from '@/lib/phase';
import { BottomNavItem } from '@/components/nav-links';
import { MoreMenu } from '@/components/MoreMenu';

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
        <MoreMenu isAdmin={!!profile?.is_admin} hasUser={!!profile} />
      </div>
    </nav>
  );
}
