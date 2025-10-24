import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Browser-side client. Requires env vars to be set:
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Check if we should use offline mode
const isOfflineMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')

if (isOfflineMode) {
  console.warn('🔧 Running in offline mode - Supabase features will use localStorage fallback')
}

// Mock Supabase client for offline development with chainable query builder
const createOfflineClient = (): Partial<SupabaseClient> => {
  const offlineUser = {
    id: 'offline-user',
    email: 'user@offline.local',
    user_metadata: { display_name: 'Offline User' },
  } as any

  type Resp<T = any> = Promise<{ data: T; error: null }>

  const makeBuilder = (initial: any = [] as any[]) => {
    const state: any = {
      table: null,
      filters: [],
      orderBy: null,
      limitVal: null,
      selectCols: '*',
      mutation: null,
      payload: null,
    }

    const resolveData = (): any => {
      // Return empty shapes to keep UI happy
      if (state.mutation === 'insert' || state.mutation === 'update') {
        // echo payload or null
        return Array.isArray(state.payload) ? state.payload : (state.payload ?? null)
      }
      if (state.limitVal === 1 || state.singleMode) return null
      return []
    }

    const builder: any = {
      select(cols?: string) { state.selectCols = cols ?? '*'; return builder },
      insert(payload: any) { state.mutation = 'insert'; state.payload = payload; return builder },
      update(payload: any) { state.mutation = 'update'; state.payload = payload; return builder },
      delete() { state.mutation = 'delete'; return builder },
      upsert(payload: any) { state.mutation = 'upsert'; state.payload = payload; return builder },
      eq() { return builder },
      gte() { return builder },
      lte() { return builder },
      in() { return builder },
      ilike() { return builder },
      order() { return builder },
      limit(n: number) { state.limitVal = n; return builder },
      maybeSingle(): Resp<any> { state.singleMode = true; return Promise.resolve({ data: resolveData(), error: null }) },
      single(): Resp<any> { state.singleMode = true; return Promise.resolve({ data: resolveData(), error: null }) },
      selectReturning(): Resp<any> { return Promise.resolve({ data: resolveData(), error: null }) },
      then(onFulfilled: any, onRejected: any) {
        // Allow `await ...select().eq().order()` patterns
        try {
          const res = { data: resolveData(), error: null }
          return Promise.resolve(res).then(onFulfilled, onRejected)
        } catch (e) {
          return Promise.reject(e).then(onFulfilled, onRejected)
        }
      },
    }
    return builder
  }

  return {
    auth: {
      getSession: async () => ({ data: { session: { user: offlineUser } }, error: null }),
      getUser: async () => ({ data: { user: offlineUser }, error: null }),
      signUp: async () => ({ data: { user: offlineUser }, error: null }),
      signInWithPassword: async () => ({ data: { user: offlineUser }, error: null }),
      updateUser: async () => ({ data: { user: offlineUser }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, error: null })
    },
    from: (_table?: string) => {
      const qb = makeBuilder([])
      ;(qb as any).state = { table: _table }
      return qb
    },
    channel: (_name: string) => {
      const handlers: any[] = []
      const ch: any = {
        on: (_event: string, _filter: any, _cb: (payload: any) => void) => { handlers.push({ _event, _filter, _cb }); return ch },
        subscribe: () => ch,
        unsubscribe: () => { /* no-op in offline mode */ },
      }
      return ch
    },
    removeChannel: (_ch: any) => { try { _ch?.unsubscribe?.() } catch {} return { data: null, error: null } },
  } as any
}

export const supabase = isOfflineMode 
  ? createOfflineClient()
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })

