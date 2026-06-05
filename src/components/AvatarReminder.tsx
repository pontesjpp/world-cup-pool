'use client'

import { useRef, useState, useTransition } from 'react'
import { atualizarFotoPerfil } from '@/actions/auth'
import { resizeImageFile } from '@/lib/image'

// Portão obrigatório para quem criou a conta antes da foto virar obrigatória.
// Renderizado pelo layout NO LUGAR do conteúdo quando o profile não tem
// avatar_url — bloqueia o uso do app até enviar uma foto. Depois do envio
// bem-sucedido a revalidação do layout libera as páginas automaticamente.
export function AvatarReminder() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
    setFile(f)
    setError(null)
  }

  function handleSubmit() {
    if (!file) {
      setError('Escolha uma foto para enviar.')
      return
    }
    setError(null)
    startTransition(async () => {
      const resized = await resizeImageFile(file)
      const fd = new FormData()
      fd.append('avatar', resized)
      const res = await atualizarFotoPerfil(fd)
      if (res?.error) setError(res.error)
      // Sucesso: o layout revalida e este aviso deixa de ser renderizado.
    })
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-warm-orange/40 bg-warm-orange/[0.07] p-6 text-center md:p-8">
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg">⚠️</span>
        <p className="font-display text-xl uppercase tracking-wide text-warm-orange">
          Adicione sua foto de perfil
        </p>
      </div>
      <p className="mt-2 font-sans text-sm text-cream/60">
        A foto agora é obrigatória para usar o bolão. Envie uma imagem para
        continuar.
      </p>

      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="motion-cinema group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-cream/25 bg-void/70 hover:border-brasil-gold"
          aria-label="Escolher foto de perfil"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Pré-visualização da foto" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-3xl text-cream/30 group-hover:text-brasil-gold">+</span>
          )}
        </button>

        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="motion-cinema rounded-lg border border-cream/15 px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-[0.1em] text-cream/80 hover:border-cream/40 hover:text-cream"
          >
            {preview ? 'Trocar foto' : 'Escolher foto'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !file}
            className="motion-cinema rounded-lg bg-gradient-to-br from-brasil-gold to-[#FFE36B] px-4 py-1.5 font-display text-xs uppercase tracking-[0.15em] text-void shadow-lg shadow-brasil-gold/20 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? 'Enviando…' : 'Enviar foto'}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 font-sans text-sm font-medium text-flare">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      </div>
    </div>
  )
}

export default AvatarReminder
