// Redimensiona/comprime uma imagem no navegador antes do upload. Fotos de
// celular têm vários MB e estouram o limite de corpo da Server Action na Vercel
// (~4,5 MB por invocação, não contornável pelo bodySizeLimit). Um avatar não
// precisa de mais que ~512px, então reduzimos para um JPEG pequeno (~50–150 KB).
//
// Se algo der errado (formato que o canvas não decodifica, ex.: HEIC), devolve
// o arquivo original para não travar o fluxo.
export async function resizeImageFile(
  file: File,
  max = 512,
  quality = 0.82,
): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return file

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode'))
      el.src = dataUrl
    })

    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) return file

    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
