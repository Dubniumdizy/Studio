"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { listAudioAssets, listVideoAssets, getOrCreateUserScene, startNewScene, upsertLayer, setLayers, type Asset, type UserScene, type UserSceneSound } from '@/lib/focus'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

interface AudioNodeBundle {
  audio: HTMLAudioElement
  src: MediaElementAudioSourceNode
  gain: GainNode
}

export function FocusInline({ showVideo = true }: { showVideo?: boolean }) {
  const { user } = useAuth()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const nodesRef = useRef<Record<string, AudioNodeBundle>>({})

  const [videoAssets, setVideoAssets] = useState<Asset[]>([])
  const [audioAssets, setAudioAssets] = useState<Asset[]>([])

  const [scene, setScene] = useState<UserScene | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [layers, setLayersState] = useState<UserSceneSound[]>([])
  const [showDemoNotice, setShowDemoNotice] = useState(false)

  // Load catalog and user scene on mount
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [vids, auds] = await Promise.all([listVideoAssets(), listAudioAssets()])
      if (!mounted) return
      setVideoAssets(vids)
      setAudioAssets(auds)
      setShowDemoNotice((vids.length === 0) && (auds.length === 0))
      if (user) {
        const s = await getOrCreateUserScene(user.id)
        if (!mounted) return
        if (s) {
          setScene(s)
          setSelectedVideo(s.video_asset_id)
          setLayersState((s.user_scene_sounds ?? []).sort((a,b) => a.sort_order - b.sort_order))
        } else if (vids.length) {
          const ns = await startNewScene(user.id, vids[0].id)
          setScene(ns)
          setSelectedVideo(ns.video_asset_id)
          setLayersState([])
        }
      }
    })()
    return () => { mounted = false }
  }, [user])

  const startAudio = async () => {
    if (!audioCtx) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      setAudioCtx(ctx)
      masterGainRef.current = ctx.createGain()
      masterGainRef.current.gain.value = 1.0
      masterGainRef.current.connect(ctx.destination)

      // Build node graph from current layers
      const byId: Record<string, Asset> = Object.fromEntries(audioAssets.map(a => [a.id, a]))
      layers.forEach(l => {
        const asset = byId[l.audio_asset_id]
        if (!asset) return
        const audioEl = new Audio(asset.url)
        audioEl.loop = true
        audioEl.crossOrigin = 'anonymous'
        const src = ctx.createMediaElementSource(audioEl)
        const gain = ctx.createGain()
        gain.gain.value = l.is_enabled ? l.volume : 0
        src.connect(gain).connect(masterGainRef.current!)
        nodesRef.current[l.audio_asset_id] = { audio: audioEl, src, gain }
      })

      await ctx.resume()
      await Promise.all(Object.values(nodesRef.current).map(n => n.audio.play().catch(() => {})))
    } else {
      await audioCtx.resume()
      await Promise.all(Object.values(nodesRef.current).map(n => n.audio.play().catch(() => {})))
    }
  }

  const onSelectVideo = async (video_asset_id: string) => {
    setSelectedVideo(video_asset_id)
    if (!user) return
    const ns = await startNewScene(user.id, video_asset_id)
    setScene(ns)
    if (layers.length) {
      const moved = layers.map(l => ({ ...l, id: undefined, user_scene_id: ns.id }))
      await setLayers(ns.id, moved)
      setLayersState(moved)
    }
  }

  const toggleLayer = async (audio_asset_id: string, enabled: boolean) => {
    if (!scene) return
    const existing = layers.find(l => l.audio_asset_id === audio_asset_id)
    let updated: UserSceneSound
    if (existing) {
      updated = await upsertLayer({ ...existing, is_enabled: enabled })
    } else {
      const sort_order = layers.length ? Math.max(...layers.map(l => l.sort_order)) + 1 : 0
      updated = await upsertLayer({ user_scene_id: scene.id, audio_asset_id, volume: 0.6, is_enabled: enabled, sort_order })
    }
    const newLayers = [...layers.filter(l => l.audio_asset_id !== audio_asset_id), updated].sort((a,b) => a.sort_order - b.sort_order)
    setLayersState(newLayers)

    if (audioCtx) {
      const node = nodesRef.current[audio_asset_id]
      if (node) {
        node.gain.gain.linearRampToValueAtTime(enabled ? (existing?.volume ?? 0.6) : 0, (audioCtx).currentTime + 0.15)
      } else if (enabled) {
        const asset = audioAssets.find(a => a.id === audio_asset_id)
        if (asset && masterGainRef.current) {
          const audioEl = new Audio(asset.url)
          audioEl.loop = true
          audioEl.crossOrigin = 'anonymous'
          const src = audioCtx.createMediaElementSource(audioEl)
          const gain = audioCtx.createGain()
          gain.gain.value = existing?.volume ?? 0.6
          src.connect(gain).connect(masterGainRef.current)
          nodesRef.current[audio_asset_id] = { audio: audioEl, src, gain }
          await audioEl.play().catch(() => {})
        }
      }
    }
  }

  const changeVolume = async (audio_asset_id: string, volume: number[]) => {
    const v = volume[0]
    if (!scene) return
    const existing = layers.find(l => l.audio_asset_id === audio_asset_id)
    if (!existing) return
    const updated = await upsertLayer({ ...existing, volume: v })
    setLayersState(layers.map(l => l.audio_asset_id === audio_asset_id ? updated : l))
    const node = nodesRef.current[audio_asset_id]
    if (node && audioCtx) node.gain.gain.linearRampToValueAtTime(existing.is_enabled ? v : 0, audioCtx.currentTime + 0.1)
  }

  const currentVideoUrl = useMemo(() => {
    const v = videoAssets.find(v => v.id === selectedVideo)
    return v?.url
  }, [videoAssets, selectedVideo])

  const loadDemoAssets = () => {
    // Lightweight demo assets (royalty-free examples). Replace with your own when ready.
    const demoVideos: Asset[] = [
      { id: 'demo-video-forest', kind: 'video', title: 'Forest Rain', url: 'https://cdn.coverr.co/videos/coverr-rain-in-the-forest-1570/1080p.mp4', thumbnail_url: null, loop_start_ms: 0, loop_end_ms: null, tags: ['demo','forest','rain'] },
      { id: 'demo-video-room', kind: 'video', title: 'Cozy Room', url: 'https://cdn.coverr.co/videos/coverr-cozy-living-room-6237/1080p.mp4', thumbnail_url: null, loop_start_ms: 0, loop_end_ms: null, tags: ['demo','cozy'] }
    ]
    const demoAudios: Asset[] = [
      { id: 'demo-audio-rain', kind: 'audio', title: 'Rain', url: 'https://cdn.pixabay.com/download/audio/2022/01/12/audio_c1f0c6f9f2.mp3?filename=rain-ambient-110397.mp3', thumbnail_url: null, loop_start_ms: 0, loop_end_ms: null, tags: ['demo','rain'] },
      { id: 'demo-audio-fire', kind: 'audio', title: 'Fireplace', url: 'https://cdn.pixabay.com/download/audio/2021/09/01/audio_b1f9a9c2a7.mp3?filename=fireplace-ambient-6096.mp3', thumbnail_url: null, loop_start_ms: 0, loop_end_ms: null, tags: ['demo','fire'] }
    ]
    setVideoAssets(demoVideos)
    setAudioAssets(demoAudios)
    setShowDemoNotice(false)
    if (!selectedVideo && demoVideos.length) setSelectedVideo(demoVideos[0].id)
  }

  return (
    <div className="relative w-full overflow-hidden rounded-md border bg-background">
      {showVideo && (
        <>
          <video
            ref={videoRef}
            src={currentVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-48 object-cover"
          />
          <div className="absolute inset-0 h-48 bg-black/30" />
        </>
      )}

      <div className={`relative ${showVideo ? 'pt-52' : ''} p-3 space-y-3`}>
        <div className="flex items-center gap-2">
          <Button onClick={startAudio} size="sm">Start Focus</Button>
          <div className="text-xs text-muted-foreground">Enable audio</div>
        </div>

        {showDemoNotice && (
          <div className="p-3 rounded-md border bg-muted/30 text-xs text-muted-foreground">
            No scenes or sounds found. You can seed the assets table in Supabase, or load a few demo assets for testing.
            <div className="mt-2"><Button size="sm" variant="secondary" onClick={loadDemoAssets}>Load demo assets</Button></div>
          </div>
        )}

        <div>
          <div className="text-xs text-muted-foreground mb-1">Scene</div>
          <div className="flex gap-2 overflow-x-auto">
            {videoAssets.map(v => (
              <button key={v.id} onClick={() => onSelectVideo(v.id)} className={`min-w-[96px] h-16 rounded-md overflow-hidden border ${selectedVideo === v.id ? 'ring-2 ring-primary' : ''}`}>
                {v.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-[10px] bg-muted">{v.title}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Ambient layers</div>
          <div className="space-y-2">
            {audioAssets.map(a => {
              const layer = layers.find(l => l.audio_asset_id === a.id)
              const enabled = !!layer?.is_enabled
              const volume = layer?.volume ?? 0.6
              return (
                <div key={a.id} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-5 text-xs truncate">{a.title}</div>
                  <div className="col-span-5">
                    <Slider value={[volume]} max={1} step={0.01} onValueChange={(v) => changeVolume(a.id, v)} disabled={!enabled} />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button size="sm" variant={enabled ? 'secondary' : 'outline'} onClick={() => toggleLayer(a.id, !enabled)}>
                      {enabled ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>
              )
            })}
            {audioAssets.length === 0 && !showDemoNotice && (
              <div className="text-xs text-muted-foreground">No ambient sounds available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

