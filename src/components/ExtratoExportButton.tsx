'use client'

import html2canvas from 'html2canvas'
import { Download } from 'lucide-react'
import { useState } from 'react'

export function ExtratoExportButton() {
  const [loading, setLoading] = useState(false)

  async function exportar() {
    const el = document.getElementById('extrato-content')
    if (!el) return
    setLoading(true)
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        background: '#080c0b',
      })
      const a = document.createElement('a')
      a.download = 'meu-extrato-bolao.jpg'
      a.href = canvas.toDataURL('image/jpeg', 0.92)
      a.click()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={exportar}
      disabled={loading}
      className="motion-cinema flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-4 py-2.5 font-sans text-sm font-semibold text-cream/70 hover:border-brasil-gold/40 hover:text-brasil-gold disabled:opacity-50"
    >
      <Download size={16} />
      {loading ? 'Gerando...' : 'Exportar como JPG'}
    </button>
  )
}
