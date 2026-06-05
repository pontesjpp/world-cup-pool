/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Avatares enviados no cadastro são fotos de celular (alguns MB). O limite
  // padrão de body de Server Action é 1 MB — sobe pra acomodar a foto.
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
  images: {
    remotePatterns: [
      // Escudos dos times vindos da football-data.org
      { protocol: 'https', hostname: 'crests.football-data.org' },
      { protocol: 'https', hostname: '**.football-data.org' },
      // Fotos de perfil hospedadas no Supabase Storage
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
}

module.exports = nextConfig
