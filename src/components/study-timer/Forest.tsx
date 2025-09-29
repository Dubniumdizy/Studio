"use client"

import { useEffect, useRef, useState } from "react"

export function Forest({
  elapsedSeconds,
  burning,
  onBurnDone,
}: {
  elapsedSeconds: number // total elapsed seconds of session
  burning: boolean
  onBurnDone?: () => void
}) {
  type Tree = {
    id: string
    x: number // 0..1 left
    y: number // 0..0.75 bottom (as fraction of height)
    baseSize: number
    hue: number
    canopy: number // 0.8..1.4
    kind: 'evergreen' | 'tall' | 'bush' | 'flower' | 'round' | 'palm'
  }
  const [trees, setTrees] = useState<Tree[]>([])
  const spawnedCountRef = useRef(0)

  // Helper: try to place a new tree with a minimum distance (radius) to others
  const placeTree = (existing: Tree[], attempts = 30): Tree | null => {
    const kinds: Tree['kind'][] = ['evergreen','tall','bush','flower','round','palm']
    const radius = 0.1 // min normalized distance (on 0..1 plane)
    for (let i = 0; i < attempts; i++) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)]
      const candidate: Tree = {
        id: `tree_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        x: 0.05 + Math.random() * 0.9,
        y: Math.random() * 0.7, // allow up to 70% of height
        baseSize: 1.6 + Math.random() * 0.3,
        hue: 95 + Math.random() * 70,
        canopy: 0.9 + Math.random() * 0.5,
        kind,
      }
      let ok = true
      for (const t of existing) {
        const dx = candidate.x - t.x
        const dy = candidate.y - t.y
        const d = Math.hypot(dx, dy)
        if (d < radius) { ok = false; break }
      }
      if (ok) return candidate
    }
    return null
  }

  // Grow a new plant every 15 seconds, based on elapsedSeconds
  useEffect(() => {
    const wanted = Math.floor(elapsedSeconds / 15)
    if (wanted > spawnedCountRef.current) {
      const toAdd = wanted - spawnedCountRef.current
      setTrees(prev => {
        const next = [...prev]
        for (let i = 0; i < toAdd; i++) {
          const placed = placeTree(next)
          if (placed) next.push(placed)
        }
        return next
      })
      spawnedCountRef.current = wanted
    }
  }, [elapsedSeconds])

  // When burning, animate and clear after 1.1s
  useEffect(() => {
    if (burning) {
      const t = setTimeout(() => {
        setTrees([])
        spawnedCountRef.current = 0
        onBurnDone?.()
      }, 1100)
      return () => clearTimeout(t)
    }
  }, [burning, onBurnDone])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes grow-step { from { transform: translateY(18px) scale(0.4); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
        @keyframes burn-up {
          0% { filter: hue-rotate(0deg) brightness(1); opacity: 1; transform: translateY(0) scale(1); }
          60% { filter: hue-rotate(40deg) brightness(1.3); }
          100% { opacity: 0; transform: translateY(-30px) scale(0.8) rotate(3deg); }
        }
      `}</style>
      {trees.map((t) => {
        const left = `${Math.round(t.x * 100)}%`
        const bottom = `${Math.round(t.y * 100)}%`
        const sizePx = 48 * t.baseSize // overall bigger
        const anim = burning ? 'burn-up 1s ease-out forwards' : 'grow-step 400ms ease-out'
        const leafColor = `hsl(${t.hue} 55% 35%)`
        const darkLeaf = `hsl(${t.hue} 55% 28%)`
        const flowerColor = `hsl(${(t.hue+260)%360} 65% 55%)`
        return (
          <div
            key={t.id}
            style={{ left, bottom, animation: anim }}
            className="absolute flex flex-col items-center"
          >
            <svg width={sizePx} height={sizePx} viewBox="0 0 64 64" className="drop-shadow-sm">
              {t.kind === 'evergreen' && (
                <>
                  <polygon points="32,6 20,28 44,28" fill={darkLeaf} />
                  <polygon points="32,14 18,36 46,36" fill={leafColor} />
                  <polygon points="32,22 16,44 48,44" fill={leafColor} />
                  <rect x="29" y="44" width="6" height="16" rx="2" fill="#6b4f2a" />
                </>
              )}
              {t.kind === 'tall' && (
                <>
                  <polygon points="32,8 26,24 38,24" fill={darkLeaf} />
                  <polygon points="32,16 22,34 42,34" fill={leafColor} />
                  <polygon points="32,26 20,46 44,46" fill={leafColor} />
                  <rect x="30" y="46" width="6" height="14" rx="2" fill="#6b4f2a" />
                </>
              )}
              {t.kind === 'bush' && (
                <>
                  <ellipse cx="26" cy="30" rx="14" ry="10" fill={leafColor} />
                  <ellipse cx="40" cy="30" rx="12" ry="9" fill={darkLeaf} />
                  <ellipse cx="33" cy="26" rx="10" ry="8" fill={leafColor} />
                  <rect x="30" y="40" width="6" height="14" rx="2" fill="#6b4f2a" />
                </>
              )}
              {t.kind === 'flower' && (
                <>
                  <rect x="31" y="26" width="2" height="26" fill="#5a8a2a" />
                  <circle cx="24" cy="26" r="6" fill={flowerColor} />
                  <circle cx="28" cy="22" r="5" fill={flowerColor} />
                  <circle cx="32" cy="20" r="4" fill={flowerColor} />
                  <circle cx="36" cy="22" r="5" fill={flowerColor} />
                  <circle cx="40" cy="26" r="6" fill={flowerColor} />
                  <circle cx="32" cy="26" r="6" fill="#ffd9a8" />
                </>
              )}
              {t.kind === 'palm' && (
                <>
                  <rect x="31" y="24" width="2" height="26" fill="#6b4f2a" />
                  <path d="M32 20 C26 18, 22 18, 18 22" stroke={leafColor} strokeWidth="3" fill="none" />
                  <path d="M32 20 C38 18, 42 18, 46 22" stroke={leafColor} strokeWidth="3" fill="none" />
                  <path d="M32 20 C24 22, 22 26, 20 30" stroke={darkLeaf} strokeWidth="3" fill="none" />
                  <path d="M32 20 C40 22, 42 26, 44 30" stroke={darkLeaf} strokeWidth="3" fill="none" />
                </>
              )}
              {t.kind === 'round' && (
                <>
                  <circle cx="28" cy="22" r={18 * t.canopy} fill={leafColor} />
                  <circle cx="40" cy="20" r={14 * t.canopy} fill={darkLeaf} />
                  <rect x="30" y="36" width="6" height="18" rx="2" fill="#6b4f2a" />
                </>
              )}
            </svg>
          </div>
        )
      })}
    </div>
  )
}

