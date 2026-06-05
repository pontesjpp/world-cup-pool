'use client'

import { useEffect, useState } from 'react'

// Contagem regressiva ao vivo até `target`. Reutilizada no prazo da pré-copa
// (24h) e no buffer de 5 min do mata-mata.

function diffParts(ms: number) {
  const clamp = Math.max(0, ms)
  const totalSec = Math.floor(clamp / 1000)
  return {
    d: Math.floor(totalSec / 86400),
    h: Math.floor((totalSec % 86400) / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
    done: clamp <= 0,
  }
}

export function Countdown({
  target,
  className,
  onComplete,
  hideSeconds = false,
}: {
  target: string | number | Date
  className?: string
  onComplete?: () => void
  hideSeconds?: boolean
}) {
  const targetMs = new Date(target).getTime()
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (now != null && now >= targetMs) onComplete?.()
  }, [now, targetMs, onComplete])

  // Evita mismatch de hidratação: só renderiza após montar no cliente.
  if (now == null) return <span className={className}>—</span>

  const { d, h, m, s, done } = diffParts(targetMs - now)
  if (done) return <span className={className}>encerrado</span>

  const pad = (n: number) => String(n).padStart(2, '0')
  const parts = [
    d > 0 ? `${d}d` : null,
    `${pad(h)}h`,
    `${pad(m)}m`,
    hideSeconds ? null : `${pad(s)}s`,
  ].filter(Boolean)

  return <span className={`tabular ${className ?? ''}`}>{parts.join(' ')}</span>
}

export default Countdown
