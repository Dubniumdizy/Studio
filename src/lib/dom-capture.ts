export async function captureElementToJpeg(element: HTMLElement, opts?: { scale?: number; background?: string; quality?: number }): Promise<{ dataUrl: string; width: number; height: number; pixelWidth: number; pixelHeight: number }>{
  const scale = opts?.scale ?? 2
  const background = opts?.background ?? '#ffffff'
  const quality = opts?.quality ?? 0.95

  const rect = element.getBoundingClientRect()
  const width = Math.ceil(rect.width)
  const height = Math.ceil(rect.height)

  // Clone node and inline computed styles
  const clone = element.cloneNode(true) as HTMLElement

  const inlineStyles = (src: Element, dst: Element) => {
    const win = src.ownerDocument!.defaultView!
    const cs = win.getComputedStyle(src as Element)
    const style: Record<string,string> = {}
    for (let i = 0; i < cs.length; i++) {
      const prop = cs.item(i)
      if (!prop) continue
      const val = cs.getPropertyValue(prop)
      // Skip overly long default styles
      if (val) (dst as HTMLElement).style.setProperty(prop, val)
    }
    // Copy input values/textareas content for accurate rendering
    if ((src as HTMLInputElement).value && dst instanceof HTMLInputElement) {
      dst.value = (src as HTMLInputElement).value
    }
    if (src.hasChildNodes() && dst.hasChildNodes()) {
      const srcChildren = Array.from(src.childNodes)
      const dstChildren = Array.from(dst.childNodes)
      for (let i = 0; i < srcChildren.length; i++) {
        const s = srcChildren[i]
        const d = dstChildren[i]
        if (s instanceof Element && d instanceof Element) inlineStyles(s, d)
      }
    }
  }
  inlineStyles(element, clone)

  // Helpers to robustly inline external assets (avoid tainting)
  const toAbsoluteUrl = (u: string) => {
    try { return new URL(u, window.location.href).href } catch { return u }
  }
  const fetchAsDataUrl = async (u: string): Promise<string | undefined> => {
    const abs = toAbsoluteUrl(u)
    try {
      const resp = await fetch(abs, { mode: 'cors', credentials: 'omit' })
      if (!resp.ok) throw new Error('bad status')
      const b = await resp.blob()
      const reader = new FileReader()
      return await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(b)
      })
    } catch {
      // Fallback via same-origin proxy to bypass CORS
      try {
        const proxy = `/api/image-proxy?url=${encodeURIComponent(abs)}`
        const resp2 = await fetch(proxy, { credentials: 'omit' })
        if (!resp2.ok) throw new Error('proxy failed')
        const b2 = await resp2.blob()
        const reader2 = new FileReader()
        return await new Promise<string>((resolve, reject) => {
          reader2.onload = () => resolve(reader2.result as string)
          reader2.onerror = reject
          reader2.readAsDataURL(b2)
        })
      } catch {
        return undefined
      }
    }
  }

  // Try to inline external <img> and <picture> sources to prevent canvas tainting
  const inlineImages = async (root: HTMLElement) => {
    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[]
    await Promise.all(imgs.map(async (img) => {
      const src = (img.currentSrc || img.getAttribute('src') || '').trim()
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) return
      const dataUrl = await fetchAsDataUrl(src)
      if (dataUrl) {
        img.setAttribute('src', dataUrl)
        img.removeAttribute('srcset')
        // Ensure future loads don't override our inlined source
        ;(img as any).srcset = ''
        img.crossOrigin = 'anonymous'
      }
    }))
  }
  await inlineImages(clone)

  // Sanitize structure likely to cause tainting
  // - Remove <source> inside <picture>
  // - Remove <iframe>
  // - Inline <video poster> and remove <source> inside <video>
  const sanitizeStructure = async (root: HTMLElement) => {
    // Remove sources inside <picture>
    Array.from(root.querySelectorAll('picture source')).forEach(n => n.remove())
    // Remove iframes entirely
    Array.from(root.querySelectorAll('iframe')).forEach(n => n.remove())
    // Videos: inline poster and remove sources
    const videos = Array.from(root.querySelectorAll('video')) as HTMLVideoElement[]
    await Promise.all(videos.map(async (v) => {
      const poster = v.getAttribute('poster') || ''
      if (poster && !poster.startsWith('data:') && !poster.startsWith('blob:')) {
        const dataUrl = await fetchAsDataUrl(poster)
        if (dataUrl) v.setAttribute('poster', dataUrl)
        else v.removeAttribute('poster')
      }
      Array.from(v.querySelectorAll('source')).forEach(s => s.remove())
      // Prevent autoplay/network
      v.removeAttribute('src')
      v.load?.()
    }))
  }
  await sanitizeStructure(clone)

  // Inline CSS images from various properties (common CORS taint source)
  const inlineCssUrlProps = [
    'backgroundImage',
    'listStyleImage',
    'maskImage',
    'borderImageSource',
    // Some browsers expose gradients/images under "background" too
    'background'
  ] as const

  const inlineBackgroundImages = async (root: HTMLElement) => {
    const elements = Array.from(root.querySelectorAll<HTMLElement>('*')).concat([root])
    const urlRegexGlobal = /url\((\"|\')?(.*?)(\1)?\)/gi

    await Promise.all(elements.map(async (el) => {
      try {
        // Use computed style to catch values applied via classes
        const cs = getComputedStyle(el)
        let updatedStyle = el.getAttribute('style') || ''

        for (const prop of inlineCssUrlProps) {
          const rawVal = (prop === 'background') ? cs.getPropertyValue('background') : (cs as any)[prop] as string
          if (!rawVal || rawVal === 'none') continue

          // Replace all url(...) occurrences in the value
          let replaced = rawVal
          const seen = new Map<string,string>()
          let match: RegExpExecArray | null
          urlRegexGlobal.lastIndex = 0
          while ((match = urlRegexGlobal.exec(rawVal)) !== null) {
            const urlInCss = (match[2] || '').trim()
            if (!urlInCss || urlInCss.startsWith('data:') || urlInCss.startsWith('blob:')) continue
            if (seen.has(urlInCss)) {
              const dataUrl = seen.get(urlInCss)!
              replaced = replaced.replace(match[0], `url(${dataUrl})`)
              continue
            }
            const dataUrl = await fetchAsDataUrl(urlInCss)
            if (dataUrl) {
              seen.set(urlInCss, dataUrl)
              replaced = replaced.replace(match[0], `url(${dataUrl})`)
            }
          }

          if (replaced !== rawVal) {
            // Prefer setting the specific longhand where possible
            if (prop === 'background' || prop === 'backgroundImage') {
              el.style.backgroundImage = replaced
            } else if (prop === 'listStyleImage') {
              el.style.listStyleImage = replaced as any
            } else if (prop === 'maskImage') {
              (el.style as any).maskImage = replaced
            } else if (prop === 'borderImageSource') {
              (el.style as any).borderImageSource = replaced
            }
          }
        }

        // Preserve other existing inline styles
        if (updatedStyle) el.setAttribute('style', el.getAttribute('style') || '')
      } catch {
        // ignore per element
      }
    }))
  }
  await inlineBackgroundImages(clone)

  // Inline pseudo-element images (e.g., ::before/::after background/content)
  const inlinePseudoImages = async (srcEl: Element, dstEl: Element, rules: string[], counter: { n: number }) => {
    const id = `cap-${++counter.n}`
    ;(dstEl as HTMLElement).setAttribute('data-cap-id', id)
    const processPseudo = async (pseudo: '::before' | '::after') => {
      // Use computed style from the source (original) element
      const pcs = getComputedStyle(srcEl as Element, pseudo as any)
      if (!pcs) return
      const urlRegexGlobal = /url\((\"|\')?(.*?)(\1)?\)/gi
      const backgroundVal = pcs.getPropertyValue('background-image') || (pcs as any).backgroundImage || ''
      const contentVal = pcs.getPropertyValue('content') || ''
      let ruleParts: string[] = []
      const replaceUrls = async (val: string): Promise<string> => {
        if (!val || val === 'none') return val
        let replaced = val
        let match: RegExpExecArray | null
        const seen = new Map<string,string>()
        urlRegexGlobal.lastIndex = 0
        while ((match = urlRegexGlobal.exec(val)) !== null) {
          const urlInCss = (match[2] || '').trim()
          if (!urlInCss || urlInCss.startsWith('data:') || urlInCss.startsWith('blob:')) continue
          if (seen.has(urlInCss)) {
            const dataUrl = seen.get(urlInCss)!
            replaced = replaced.replace(match[0], `url(${dataUrl})`)
            continue
          }
          const dataUrl = await fetchAsDataUrl(urlInCss)
          if (dataUrl) {
            seen.set(urlInCss, dataUrl)
            replaced = replaced.replace(match[0], `url(${dataUrl})`)
          }
        }
        return replaced
      }
      const bgRepl = await replaceUrls(backgroundVal)
      if (bgRepl !== backgroundVal) ruleParts.push(`background-image: ${bgRepl} !important;`)
      const contentRepl = await replaceUrls(contentVal)
      if (contentRepl !== contentVal) ruleParts.push(`content: ${contentRepl} !important;`)
      if (ruleParts.length) {
        rules.push(`[data-cap-id="${id}"]${pseudo}{ ${ruleParts.join(' ')} }`)
      }
    }
    await processPseudo('::before')
    await processPseudo('::after')
    // Recurse children in order
    const srcKids = Array.from(srcEl.children)
    const dstKids = Array.from(dstEl.children)
    for (let i = 0; i < srcKids.length && i < dstKids.length; i++) {
      await inlinePseudoImages(srcKids[i], dstKids[i], rules, counter)
    }
  }
  const pseudoRules: string[] = []
  await inlinePseudoImages(element, clone, pseudoRules, { n: 0 })

  // Wrap cloned node into XHTML container with explicit sizing
  const wrapper = document.createElement('div')
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  wrapper.style.width = width + 'px'
  wrapper.style.height = height + 'px'
  wrapper.style.background = background
  wrapper.appendChild(clone)

  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(wrapper)}</foreignObject></svg>`

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      // Allow drawing inline data
      image.onload = () => resolve(image)
      image.onerror = (e) => reject(e)
      image.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(width * scale))
    canvas.height = Math.max(1, Math.floor(height * scale))
    const ctx = canvas.getContext('2d')!
    // Fill background
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    return { dataUrl, width, height, pixelWidth: canvas.width, pixelHeight: canvas.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}
