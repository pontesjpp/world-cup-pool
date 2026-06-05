'use client'

import { useRef, useState } from 'react'

export function AvatarPicker() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (preview) URL.revokeObjectURL(preview)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  return (
    <div>
      <span className="mb-1.5 block font-sans text-[11px] font-semibold uppercase tracking-[0.15em] text-cream/50">
        Sua foto
      </span>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="motion-cinema group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-cream/25 bg-void/70 hover:border-brasil-gold"
          aria-label="Escolher foto de perfil"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Pré-visualização da foto"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-display text-3xl text-cream/30 group-hover:text-brasil-gold">
              +
            </span>
          )}
        </button>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="motion-cinema self-start rounded-lg border border-cream/15 px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-[0.1em] text-cream/80 hover:border-cream/40 hover:text-cream"
          >
            {preview ? 'Trocar foto' : 'Escolher foto'}
          </button>
          <span className="font-sans text-[11px] text-cream/35">
            JPG ou PNG, opcional
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        id="avatar"
        name="avatar"
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}
