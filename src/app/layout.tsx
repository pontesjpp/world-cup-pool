import type { Metadata } from 'next';
import { Anton, Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';

// Display/Headers: condensada, pesada (estilo Impact/Tungsten/Antonio)
const display = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
});

// UI/Data: limpa, com numerais tabulares
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Bolão da Galera — Copa do Mundo 2026',
  description: 'Crava o placar. Encara a galera. Joga bonito.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable}`}>
      <body className="bg-void min-h-screen font-sans text-cream antialiased">

        {/* Renderiza APENAS em telas médias/grandes (PC/Tablet) */}
        <div className="hidden md:block">
          <Navbar />
        </div>

        {/* O conteúdo das páginas (com padding extra no mobile por causa do BottomNav) */}
        <main className="max-w-5xl mx-auto p-4 pb-24 md:pb-8">
          {children}
        </main>

        {/* Renderiza APENAS em telas pequenas (Celular) */}
        <div className="block md:hidden">
          <BottomNav />
        </div>

      </body>
    </html>
  );
}
