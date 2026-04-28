import { supabaseAdmin } from '@/lib/supabase/client'
import type { PepaProfile } from '@/types'

const DEFAULT_PROFILE: PepaProfile = {
  role: 'Back office manager, realitní firma',
  preferences: {
    report_format: 'krátký bullet-point souhrn + čísla',
    language: 'česky, tykání',
    chart_style: 'jednoduchý sloupcový',
  },
  frequent_tasks: [],
  key_people: [],
  calendar_email: null,
  working_hours: '8:00-17:00',
  last_updated: null,
}

export async function getPepaProfile(): Promise<PepaProfile> {
  const { data } = await supabaseAdmin
    .from('pepa_profile')
    .select('value')
    .eq('key', 'profile')
    .single()

  return (data?.value as PepaProfile) ?? DEFAULT_PROFILE
}

export async function updatePepaProfile(updates: Partial<PepaProfile>): Promise<void> {
  const current = await getPepaProfile()
  const merged = {
    ...current,
    ...updates,
    preferences: { ...current.preferences, ...(updates.preferences ?? {}) },
    frequent_tasks: mergeUnique(current.frequent_tasks, updates.frequent_tasks ?? []),
    key_people: mergeUnique(current.key_people, updates.key_people ?? []),
    last_updated: new Date().toISOString(),
  }

  await supabaseAdmin
    .from('pepa_profile')
    .upsert({ key: 'profile', value: merged, updated_at: new Date().toISOString() })
}

function mergeUnique(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].slice(0, 20)
}
