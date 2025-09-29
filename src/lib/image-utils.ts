export async function compressImageFileToDataUrl(file: File, opts?: { maxWidth?: number; maxHeight?: number; quality?: number; mime?: string }): Promise<string> {
  const maxWidth = opts?.maxWidth ?? 1600
  const maxHeight = opts?.maxHeight ?? 600
  const quality = opts?.quality ?? 0.85
  const mime = opts?.mime ?? 'image/jpeg'

  // For GIFs, return original data URL (canvas strips animation). Caller can decide.
  if (/gif$/i.test(file.type)) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    return dataUrl
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = r.result as string
    }
    r.onerror = reject
    r.readAsDataURL(file)
  })

  const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
  const w = Math.max(1, Math.floor(img.width * scale))
  const h = Math.max(1, Math.floor(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL(mime, quality)
}
