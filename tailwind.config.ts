import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Paleta editorial: "Nike Football 2004 + World Cup" ──
        // Acento primário, dourado quente vintage (não néon)
        'brasil-gold': '#F4D000',
        // Verde do gramado — vivo, para "ao vivo"/sucesso
        'pitch-green': '#2D6A4F',
        'pitch-vivid': '#009C3B',
        // Azul editorial (camisa/azul de impressão)
        'classic-blue': '#1565C0',
        // Laranja terroso — acento quente
        'warm-orange': '#D96B2B',
        // Papel/creme — para painéis editoriais e tipografia clara
        cream: '#F6F1E8',
        // Vermelho "flare" — indicador AO VIVO (substitui o magenta)
        flare: '#E8431F',
        // Fundos
        void: {
          DEFAULT: '#0B1110',
          900: '#0B1110',
        },
        // Superfície escura e quente (não preto puro)
        surface: '#15110C',
        ink: '#080C0B',
      },
      fontFamily: {
        // Display/Headers/Placares: condensada, pesada, pôster
        display: ['var(--font-display)', 'Anton', 'Impact', 'sans-serif'],
        // UI/Body: limpa, com numerais tabulares
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        score: '-0.05em',
      },
      backgroundImage: {
        // Glow cinematográfico: dourado sangrando em verde profundo
        'pitch-glow':
          'radial-gradient(120% 80% at 50% -10%, rgba(244,208,0,0.14) 0%, rgba(45,106,79,0.12) 35%, rgba(11,17,16,0) 70%)',
        // Véu escuro para legibilidade sobre fotos
        'cinema-veil':
          'linear-gradient(180deg, rgba(8,12,11,0) 0%, rgba(8,12,11,0.4) 45%, rgba(8,12,11,0.95) 100%)',
      },
      keyframes: {
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 0.7s cubic-bezier(0.4, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [],
}

export default config
