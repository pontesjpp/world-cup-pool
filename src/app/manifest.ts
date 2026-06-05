import type { MetadataRoute } from 'next'

// Manifest do PWA — usado por Android/Chrome e leitores modernos. No iOS o ícone
// vem do apple-touch-icon + metadados appleWebApp definidos no layout.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bolão Ponts — Copa do Mundo 2026',
    short_name: 'Bolão Ponts',
    description: 'Crava o placar. Encara a galera. Joga bonito.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1110',
    theme_color: '#0B1110',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
