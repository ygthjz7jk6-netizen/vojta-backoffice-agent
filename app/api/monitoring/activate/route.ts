import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { scrapeAllSreality } from '@/lib/scraper/sreality'
import { scrapeBezrealitky } from '@/lib/scraper/bezrealitky'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { location_name, sreality_district_id, category_main, category_type } = body

  if (!location_name) {
    return NextResponse.json({ error: 'Chybí location_name' }, { status: 400 })
  }

  const notify_email = process.env.NOTIFY_EMAIL ?? ''

  // Ulož konfiguraci
  const { data: config, error } = await supabaseAdmin
    .from('monitoring_configs')
    .upsert(
      {
        location_name,
        sreality_district_id: sreality_district_id ?? null,
        sreality_region_id: null,
        sreality_municipality_id: null,
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

  // Okamžitě stáhni aktuální nabídky jako baseline (bez emailu)
  try {
    const [srealityListings, bezrealitkyListings] = await Promise.allSettled([
      scrapeAllSreality({
        categoryMain: category_main ?? 1,
        categoryType: category_type ?? 1,
        districtId: sreality_district_id ?? undefined,
        cityName: !sreality_district_id ? location_name : undefined,
        cityFilter: !sreality_district_id ? location_name : undefined,
      }),
      scrapeBezrealitky({ location: location_name }),
    ])

    const allListings = [
      ...(srealityListings.status === 'fulfilled' ? srealityListings.value : []),
      ...(bezrealitkyListings.status === 'fulfilled' ? bezrealitkyListings.value : []),
    ]

    if (allListings.length > 0) {
      await supabaseAdmin.from('scraped_listings').upsert(
        allListings.map(l => ({
          source_site: l.sourceSite,
          external_id: l.externalId,
          title: l.title,
          price: l.price,
          location: l.location,
          area_sqm: l.areaSqm,
          url: l.url,
          location_name,
          scraped_at: new Date().toISOString(),
        })),
        { onConflict: 'source_site,external_id', ignoreDuplicates: true }
      )
    }

    console.log(`[activate] ${location_name}: baseline uložen, ${allListings.length} nabídek`)
    return NextResponse.json({ ok: true, config, baseline: allListings.length })
  } catch (e) {
    console.error('[activate] baseline scrape failed:', e)
    return NextResponse.json({ ok: true, config, baseline: 0 })
  }
}
