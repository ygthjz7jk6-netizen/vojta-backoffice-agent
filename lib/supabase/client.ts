import { createClient } from '@supabase/supabase-js'

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  return url
}

function getAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  return key
}

function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || getAnonKey()
}

// Browser client
export function getSupabase() {
  return createClient(getSupabaseUrl(), getAnonKey())
}

// Server admin client (pro API routes)
export function getSupabaseAdmin() {
  return createClient(getSupabaseUrl(), getServiceKey(), {
    auth: { persistSession: false }
  })
}

// Zpětná kompatibilita — lazy getters
export const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {
  get: (_, prop) => getSupabase()[prop as keyof ReturnType<typeof getSupabase>]
})

export const supabaseAdmin = new Proxy({} as ReturnType<typeof getSupabaseAdmin>, {
  get: (_, prop) => getSupabaseAdmin()[prop as keyof ReturnType<typeof getSupabaseAdmin>]
})
