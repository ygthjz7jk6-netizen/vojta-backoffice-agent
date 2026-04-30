import { NextRequest, NextResponse } from 'next/server'
import { scrapeSreality } from '@/lib/scraper/sreality'
import { scrapeBezrealitky } from '@/lib/scraper/bezrealitky'
import { sendNewListingsEmail } from '@/lib/notifications/email'
import { supabaseAdmin } from '@/lib/supabase/client'
import type { ScrapedListing } from '@/lib/scraper/sreality'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  const isManual = req.nextUrl.searchParams.get('manual') === '1'

  if (!isCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const location = process.env.SCRAPE_LOCATION ?? 'Holešovice'

  // Scraping obou zdrojů paralelně
  const [srealityRaw, bezrealitkyRaw] = await Promise.allSettled([
    scrapeSreality({ districtId: 5006 }),
    scrapeBezrealitky({ location }),
  ])

  const allListings: ScrapedListing[] = [
    ...(srealityRaw.status === 'fulfilled' ? srealityRaw.value : []),
    ...(bezrealitkyRaw.status === 'fulfilled' ? bezrealitkyRaw.value : []),
  ]

  if (allListings.length === 0) {
    return NextResponse.json({ ok: true, new: 0, message: 'Žádné výsledky ze scraperů' })
  }

  // Zjistit které jsou nové (nejsou v DB)
  const { data: existing } = await supabaseAdmin
    .from('scraped_listings')
    .select('source_site, external_id')
    .in('source_site', [...new Set(allListings.map(l => l.sourceSite))])

  const existingSet = new Set(
    (existing ?? []).map(r => `${r.source_site}__${r.external_id}`)
  )

  const newListings = allListings.filter(
    l => !existingSet.has(`${l.sourceSite}__${l.externalId}`)
  )

  // Upsert všechny do DB
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
        scraped_at: new Date().toISOString(),
      })),
      { onConflict: 'source_site,external_id' }
    )
  }

  // Email pouze pokud jsou nové nabídky
  let emailSent = false
  if (newListings.length > 0 && process.env.GMAIL_APP_PASSWORD) {
    await sendNewListingsEmail(newListings, location)
    emailSent = true
  }

  console.log(`[scrape-notify] total=${allListings.length} new=${newListings.length} emailSent=${emailSent}`)

  return NextResponse.json({
    ok: true,
    total: allListings.length,
    new: newListings.length,
    emailSent,
    sreality: srealityRaw.status === 'fulfilled' ? srealityRaw.value.length : `error: ${(srealityRaw as PromiseRejectedResult).reason}`,
    bezrealitky: bezrealitkyRaw.status === 'fulfilled' ? bezrealitkyRaw.value.length : `error: ${(bezrealitkyRaw as PromiseRejectedResult).reason}`,
  })
}
