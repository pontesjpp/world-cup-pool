/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
