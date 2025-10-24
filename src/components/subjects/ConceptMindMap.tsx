"use client"

import React from "react"

export type VocabRow = { id?: string; concept: string; confidence?: number | null; importance?: number | null }

function tokensOf(s: string): string[] {
  const stop = new Set([
    "the","a","an","of","and","or","to","in","on","for","by","with","at","from","as","is","are","be","this","that","these","those","into","over","under","spaces","space","generalized","general","unitary","linear","non","complex","real"
  ])
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t && !stop.has(t))
}

function stem(t: string): string {
  // very small stemmer for math words
  let s = t
  s = s.replace(/(ization|isations|isations|ization)$/,'ize')
  s = s.replace(/(tion|sion|tions|sions)$/,'t')
  s = s.replace(/(ality|alitys|alities)$/,'al')
  s = s.replace(/(ing|ings)$/,'')
  s = s.replace(/(ies)$/,'y')
  s = s.replace(/(es)$/,'e')
  s = s.replace(/(s)$/,'')
  return s
}

function canonicalTokens(s: string): string[] {
  const base = tokensOf(s).map(stem)
  const out: string[] = []
  const push = (x: string) => { if (!out.includes(x)) out.push(x) }
  base.forEach(t => {
    // synonyms map
    const syn: Record<string, string> = {
      eigenvalue: 'eigen', eigenvector: 'eigen', eigen: 'eigen',
      svd: 'svd', singular: 'svd', decomposition: 'decompose',
      matrix: 'matrix', matric: 'matrix',
      vector: 'vector', basis: 'basis', dot: 'inner', product: 'product', inner: 'inner',
      transform: 'transform', transformation: 'transform', regression: 'regression',
      markov: 'markov', chain: 'markov', stochastic: 'markov', transition: 'markov',
      graph: 'graph', theory: 'graph',
      space: 'space', spaces: 'space', span: 'span',
      orthogonal: 'ortho', orthonormal: 'ortho', projection: 'project',
      tensor: 'tensor',
    }
    if (syn[t]) push(syn[t])
    push(t)
  })
  // join bigrams we know
  const joined = s.toLowerCase()
  if (joined.includes('inner product')) push('inner')
  if (joined.includes('singular value decomposition')) push('svd')
  if (joined.includes('linear transformation')) push('transform')
  if (joined.includes('eigenvalues') || joined.includes('eigenvectors')) push('eigen')
  if (joined.includes('markov chain')) push('markov')
  return out
}


function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  a.forEach(x => { if (b.has(x)) inter++ })
  const uni = a.size + b.size - inter
  return uni ? inter / uni : 0
}

function colorFor(metric: "confidence"|"importance", v?: number | null): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return metric === 'confidence' ? '#94a3b8' : '#a3a3a3'
  // Map 1..5 to gradient
  const t = Math.min(1, Math.max(0, (n - 1) / 4))
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t)
  // confidence: red->green, importance: slate->blue
  if (metric === 'confidence') {
    const r = lerp(239, 16), g = lerp(68, 185), b = lerp(68, 129)
    return `rgb(${r},${g},${b})`
  } else {
    const r = lerp(148, 59), g = lerp(163, 130), b = lerp(184, 246)
    return `rgb(${r},${g},${b})`
  }
}

function useResize(ref: React.RefObject<HTMLElement>) {
  const [rect, setRect] = React.useState({ width: 800, height: 480 })
  React.useEffect(() => {
    function upd() {
      if (!ref.current) return
      const r = ref.current.getBoundingClientRect()
      const w = Math.max(300, Math.round(r.width))
      const h = Math.max(260, Math.round(r.height))
      setRect({ width: w, height: h })
    }
    upd()
    const ro = new ResizeObserver(upd)
    if (ref.current) ro.observe(ref.current)
    return () => { try { ro.disconnect() } catch {} }
  }, [ref])
  return rect
}

export default function ConceptMindMap({ vocab, subjectName }: { vocab: VocabRow[]; subjectName?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { width, height } = useResize(containerRef)

  // Defaults (no toolbar)
  const simThreshold = 0.1
  const metric: "confidence"|"importance" = 'confidence'
  const showLabels = true
  const minImp = 0
  const showGroups = false
  const showArrows = true

  const filtered = React.useMemo(() => {
    return (vocab || []).filter(v => (Number(v.importance ?? 0) >= minImp))
  }, [vocab])

  const graph = React.useMemo(() => {
    const nodes = filtered.map((v, idx) => ({
      id: v.id || String(idx),
      concept: v.concept || `(item ${idx+1})`,
      confidence: Number(v.confidence),
      importance: Number(v.importance),
      toks: new Set(tokensOf(v.concept || '')),
      canon: new Set(canonicalTokens(v.concept || '')),
      notes: v as any as { notes?: string }
    }))
    const edges: { source: number; target: number; w: number; dir?: 'a->b'|'b->a'|'none'; kind: 'subset'|'sim'|'manual'; label?: string }[] = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        const jac = Math.max(jaccard(a.toks, b.toks), jaccard(a.canon as any, b.canon as any))
        const aInB = b.concept.toLowerCase().includes(a.concept.toLowerCase()) && a.concept.length > 2
        const bInA = a.concept.toLowerCase().includes(b.concept.toLowerCase()) && b.concept.length > 2
        const synOverlap = (() => {
          let c = 0
          ;(a.canon as any as Set<string>).forEach((t: string)=> { if ((b.canon as any as Set<string>).has(t)) c++ })
          return c
        })()
        const substr = aInB || bInA ? 1 : 0
        const w = Math.max(jac, substr ? 0.6 : 0, synOverlap>0 ? 0.45 : 0)
        if (w >= simThreshold) {
          let dir: 'a->b'|'b->a'|'none' = 'none'
          let kind: 'subset'|'sim' = 'sim'
          if (aInB && !bInA) { dir = 'b->a'; kind = 'subset' }
          else if (bInA && !aInB) { dir = 'a->b'; kind = 'subset' }
          else { dir = 'none'; kind = substr ? 'subset' : 'sim' }
          edges.push({ source: i, target: j, w, dir, kind })
        }
      }
    }

    // Layout: cluster by first token
    const groups: Record<string, number[]> = {}
    nodes.forEach((n, idx) => {
      const first = Array.from(n.toks)[0] || 'misc'
      if (!groups[first]) groups[first] = []
      groups[first].push(idx)
    })
    const cx = width / 2, cy = height / 2
    const placed: { x: number; y: number }[] = nodes.map(() => ({ x: cx, y: cy }))

    // Build adjacency for layout
    const adj: Record<number, number[]> = {}
    edges.forEach(e => {
      if (!adj[e.source]) adj[e.source] = []
      if (!adj[e.target]) adj[e.target] = []
      adj[e.source].push(e.target)
      adj[e.target].push(e.source)
    })
    // Pick hub as highest degree
    let hub = 0, best = -1
    nodes.forEach((_, i) => { const d = (adj[i]?.length || 0); if (d > best) { best = d; hub = i } })
    // BFS layers
    const dist: number[] = Array(nodes.length).fill(Infinity)
    const q: number[] = []
    dist[hub] = 0; q.push(hub)
    while (q.length) {
      const u = q.shift()!
      for (const v of (adj[u] || [])) { if (dist[v] === Infinity) { dist[v] = dist[u] + 1; q.push(v) } }
    }
    const layers: Record<number, number[]> = {}
    nodes.forEach((_, i) => { const d = Number.isFinite(dist[i]) ? dist[i] : 3; if (!layers[d]) layers[d] = []; layers[d].push(i) })
    const maxLayer = Math.max(...Object.keys(layers).map(n => Number(n)))
    const baseR = Math.min(width, height) * 0.08
    const gap = Math.min(width, height) * 0.12
    for (let d = 0; d <= maxLayer; d++) {
      const ids = layers[d] || []
      const r = d === 0 ? 0 : baseR + (d - 1) * gap
      ids.forEach((id, k) => {
        if (d === 0) { placed[id] = { x: cx, y: cy }; return }
        const a = (2 * Math.PI * k) / Math.max(1, ids.length)
        placed[id] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
      })
    }

    return { nodes, edges, placed }
  }, [filtered, simThreshold, width, height])

  const scaleRadius = (n: number | null | undefined) => {
    const v = Number(n)
    if (!Number.isFinite(v)) return 7
    return 6 + (v - 1) * 2.4 // 1..5 -> 6..16
  }

  // Estimate text width for node box
  const estimateTextWidth = (s: string) => Math.min(180, Math.max(40, s.length * 7))

  // Dragging support
  const [posOverrides, setPosOverrides] = React.useState<Record<string, {x:number,y:number}>>(()=>{
    try { return JSON.parse(localStorage.getItem(`mindmap_layout_${subjectName||'subject'}`)||'{}') } catch { return {} }
  })
  const saveLayout = (next: Record<string, {x:number,y:number}>) => {
    try { localStorage.setItem(`mindmap_layout_${subjectName||'subject'}`, JSON.stringify(next)) } catch {}
  }
  const [drag, setDrag] = React.useState<{id:string, dx:number, dy:number}|null>(null)
  const [pendingLink, setPendingLink] = React.useState<string|null>(null)
  const [customEdges, setCustomEdges] = React.useState<{aId:string,bId:string,label?:string}[]>(()=>{
    try { return JSON.parse(localStorage.getItem(`mindmap_edges_${subjectName||'subject'}`)||'[]') } catch { return [] }
  })
  const saveEdges = (next:{aId:string,bId:string,label?:string}[])=>{
    try { localStorage.setItem(`mindmap_edges_${subjectName||'subject'}`, JSON.stringify(next)) } catch {}
  }
  const deleteCustomEdgeByIndex = (idx:number) => {
    setCustomEdges(prev => { const next = prev.filter((_, i)=> i !== idx); saveEdges(next); return next })
  }

  // Final position resolver
  const getPos = (i:number, id:string) => posOverrides[id] || graph.placed[i]

  const onMouseDown = (e: React.MouseEvent, i:number, id:string) => {
    if (e.shiftKey) {
      if (pendingLink && pendingLink !== id) {
        const exists = customEdges.filter(ce => (ce.aId === pendingLink && ce.bId === id) || (ce.aId === id && ce.bId === pendingLink))
        if (exists.length) {
          if (window.confirm('A link between these nodes exists. Delete it?')) {
            const next = customEdges.filter(ce => !((ce.aId === pendingLink && ce.bId === id) || (ce.aId === id && ce.bId === pendingLink)))
            setCustomEdges(next); saveEdges(next); setPendingLink(null)
            e.stopPropagation(); return
          } else {
            setPendingLink(null); e.stopPropagation(); return
          }
        }
        const label = window.prompt('Relation label (optional)', '') || undefined
        const next = [...customEdges, { aId: pendingLink, bId: id, label }]
        setCustomEdges(next); saveEdges(next); setPendingLink(null)
        e.stopPropagation(); return
      } else {
        setPendingLink(id); e.stopPropagation(); return
      }
    }
    const p = getPos(i, id)
    const rect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect()
    const ex = e.clientX - (rect?.left||0)
    const ey = e.clientY - (rect?.top||0)
    setDrag({ id, dx: ex - p.x, dy: ey - p.y })
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return
    const svg = (e.currentTarget as SVGSVGElement)
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left - drag.dx
    const y = e.clientY - rect.top - drag.dy
    setPosOverrides(prev => ({ ...prev, [drag.id]: { x, y } }))
  }
  const onMouseUp = () => { if (drag){ setDrag(null); saveLayout(posOverrides) } }

  return (
    <div ref={containerRef} className="w-full h-[560px] border rounded bg-muted/30 relative">
      <div className="absolute left-2 bottom-2 text-[10px] text-slate-500 select-none">Drag nodes. Shift+click two nodes to add/remove a link. Click × on a manual link to delete.</div>
      <svg width={width} height={height} className="absolute inset-0" onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
        </defs>
        {/* Edges (generated + custom) */}
        <g stroke="#94a3b8" strokeOpacity={0.7} fill="none">
          {[
            ...graph.edges,
            ...customEdges.map((ce, ceIndex)=>{
              const aIdx = graph.nodes.findIndex(n=> (n.id||'')===ce.aId)
              const bIdx = graph.nodes.findIndex(n=> (n.id||'')===ce.bId)
              if (aIdx<0 || bIdx<0) return null as any
              return { source:aIdx, target:bIdx, w:1, dir:'none' as const, kind:'manual' as const, label: ce.label, __manual:true, __ceIndex: ceIndex, __aId: ce.aId, __bId: ce.bId }
            }).filter(Boolean) as any[]
          ].map((e: any, i) => {
            const a = getPos(e.source, graph.nodes[e.source].id || String(e.source))
            const b = getPos(e.target, graph.nodes[e.target].id || String(e.target))
            const w = 0.6 + e.w * 2.2
            const markerEnd = showArrows ? (e.dir === 'a->b' ? 'url(#arrow)' : e.dir === 'b->a' ? undefined : undefined) : undefined
            const markerStart = showArrows && e.dir === 'b->a' ? 'url(#arrow)' : undefined
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={w} markerEnd={markerEnd as any} markerStart={markerStart as any} />
                {/* edge label */}
                {(e.label || e.kind === 'subset') && (
                  <text x={(a.x + b.x)/2} y={(a.y + b.y)/2 - 4} fontSize={10} fill="#475569" textAnchor="middle">{e.label || 'subset'}</text>
                )}
                {e.kind === 'manual' && typeof e.__ceIndex === 'number' && (
                  <g transform={`translate(${(a.x + b.x)/2},${(a.y + b.y)/2})`} onClick={(ev)=>{ ev.stopPropagation(); deleteCustomEdgeByIndex(e.__ceIndex) }} style={{ cursor: 'pointer' }}>
                    <rect x={-8} y={-8} width={16} height={16} rx={3} fill="#fef2f2" stroke="#ef4444" />
                    <text x={0} y={4} fontSize={12} fill="#ef4444" textAnchor="middle">×</text>
                  </g>
                )}
              </g>
            )
          })}
        </g>
        {/* Nodes */}
        <g>
          {graph.nodes.map((n, i) => {
            const p = getPos(i, n.id || String(i))
            const metricVal = metric === 'confidence' ? n.confidence : n.importance
            const stroke = colorFor(metric, metricVal)
            const text = n.concept
            const bw = estimateTextWidth(text)
            const bh = 24
            return (
              <g key={n.id || i} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'move' }} onMouseDown={(e)=> onMouseDown(e, i, n.id || String(i))}>
                <rect x={-bw/2} y={-bh/2} width={bw} height={bh} rx={10} fill="#f8fafc" stroke={stroke} strokeWidth={1.2} />
                {showLabels && (
                  <text x={0} y={4} fontSize={12} fill="#111827" textAnchor="middle">{text}</text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

