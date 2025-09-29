import { supabase } from '@/lib/supabaseClient'

// Types
export type AssetKind = 'video' | 'audio'
export interface Asset {
  id: string
  kind: AssetKind
  title: string
  url: string
  thumbnail_url?: string | null
  loop_start_ms?: number | null
  loop_end_ms?: number | null
  tags?: string[] | null
}

export interface UserSceneSound {
  id?: string
  user_scene_id: string
  audio_asset_id: string
  volume: number
  is_enabled: boolean
  sort_order: number
}

export interface UserScene {
  id: string
  user_id: string
  video_asset_id: string
  started_at: string
  user_scene_sounds?: UserSceneSound[]
}

// Local storage fallback keys
const LS_SCENE_KEY = 'focus_user_scene'
const LS_SOUNDS_KEY = 'focus_user_scene_sounds'

function isOffline() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !url || !key || url.includes('placeholder')
}

export async function listAssets(kind?: AssetKind): Promise<Asset[]> {
  const sb = supabase as any
  if (isOffline()) {
    // No remote catalog in offline mode; return empty and allow manual URLs
    return []
  }
  let q = sb.from('assets').select('*').order('created_at', { ascending: false })
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q
  if (error) throw error
  return data as Asset[]
}

export async function getOrCreateUserScene(userId: string): Promise<UserScene | null> {
  const sb = supabase as any
  if (isOffline()) {
    const sceneStr = typeof window !== 'undefined' ? localStorage.getItem(LS_SCENE_KEY) : null
    const soundsStr = typeof window !== 'undefined' ? localStorage.getItem(LS_SOUNDS_KEY) : null
    const scene = sceneStr ? (JSON.parse(sceneStr) as UserScene) : null
    const sounds = soundsStr ? (JSON.parse(soundsStr) as UserSceneSound[]) : []
    if (scene) return { ...scene, user_scene_sounds: sounds }
    return null
  }
  // Fetch latest scene with sounds
  const { data: scene, error } = await sb
    .from('user_scenes')
    .select('id, user_id, video_asset_id, started_at, user_scene_sounds:user_scene_sounds(id, user_scene_id, audio_asset_id, volume, is_enabled, sort_order)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return scene as UserScene | null
}

export async function startNewScene(userId: string, video_asset_id: string): Promise<UserScene> {
  const sb = supabase as any
  if (isOffline()) {
    const scene: UserScene = {
      id: `scene_${Date.now()}`,
      user_id: userId,
      video_asset_id,
      started_at: new Date().toISOString(),
      user_scene_sounds: []
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_SCENE_KEY, JSON.stringify(scene))
      localStorage.setItem(LS_SOUNDS_KEY, JSON.stringify([]))
    }
    return scene
  }
  const { data, error } = await sb
    .from('user_scenes')
    .insert({ user_id: userId, video_asset_id })
    .select('id, user_id, video_asset_id, started_at')
    .single()
  if (error) throw error
  return data as UserScene
}

export async function upsertLayer(layer: UserSceneSound): Promise<UserSceneSound> {
  const sb = supabase as any
  if (isOffline()) {
    if (typeof window !== 'undefined') {
      const sounds: UserSceneSound[] = JSON.parse(localStorage.getItem(LS_SOUNDS_KEY) || '[]')
      let updated: UserSceneSound
      if (layer.id) {
        const idx = sounds.findIndex((s) => s.id === layer.id)
        if (idx >= 0) sounds[idx] = { ...sounds[idx], ...layer }
        updated = sounds[idx]
      } else {
        updated = { ...layer, id: `sound_${Date.now()}` }
        sounds.push(updated)
      }
      localStorage.setItem(LS_SOUNDS_KEY, JSON.stringify(sounds))
      return updated
    }
    return layer
  }
  const { data, error } = await sb
    .from('user_scene_sounds')
    .upsert(layer, { onConflict: 'id' })
    .select('id, user_scene_id, audio_asset_id, volume, is_enabled, sort_order')
    .single()
  if (error) throw error
  return data as UserSceneSound
}

export async function setLayers(user_scene_id: string, layers: UserSceneSound[]): Promise<void> {
  const sb = supabase as any
  if (isOffline()) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_SOUNDS_KEY, JSON.stringify(layers))
    }
    return
  }
  // Simplest approach: delete then insert
  const { error: delErr } = await sb.from('user_scene_sounds').delete().eq('user_scene_id', user_scene_id)
  if (delErr) throw delErr
  if (layers.length) {
    const { error: insErr } = await sb.from('user_scene_sounds').insert(layers)
    if (insErr) throw insErr
  }
}

export async function listAudioAssets(): Promise<Asset[]> {
  return listAssets('audio')
}

export async function listVideoAssets(): Promise<Asset[]> {
  return listAssets('video')
}

