import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    location_name,
    sreality_district_id,
    sreality_region_id,
    category_main,
    category_type,
  } = body

  if (!location_name) {
    return NextResponse.json({ error: 'Chybí location_name' }, { status: 400 })
  }

  const notify_email = process.env.NOTIFY_EMAIL ?? ''

  const { data, error } = await supabaseAdmin
    .from('monitoring_configs')
    .upsert(
      {
        location_name,
        sreality_district_id: sreality_district_id ?? null,
        sreality_region_id: sreality_region_id ?? null,
        category_main: category_main ?? 1,
        category_type: category_type ?? 1,
        notify_email,
        active: true,
      },
      { onConflict: 'location_name' }
    )
    .select()
    .single()

  if (error) {
    console.error('monitoring activate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, config: data })
}
