import { Resend } from 'resend'
import type { ScrapedListing } from '@/lib/scraper/sreality'

export async function sendNewListingsEmail(listings: ScrapedListing[], location: string) {
  const to = process.env.NOTIFY_EMAIL
  if (!to) throw new Error('NOTIFY_EMAIL není nastaven')

  const resend = new Resend(process.env.RESEND_API_KEY)

  const subject = `🏠 ${listings.length} nových nabídek — ${location} (${new Date().toLocaleDateString('cs-CZ')})`

  const rows = listings
    .map(l => {
      const price = l.price ? `${(l.price / 1_000_000).toFixed(2)} mil. Kč` : 'cena neuvedena'
      const area = l.areaSqm ? `${l.areaSqm} m²` : ''
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee"><a href="${l.url}">${l.title}</a></td>
        <td style="padding:8px;border-bottom:1px solid #eee">${l.location}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${area}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">${price}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#888">${l.sourceSite}</td>
      </tr>`
    })
    .join('')

  const html = `
    <div style="font-family:sans-serif;max-width:800px;margin:0 auto">
      <h2 style="color:#1a1a2e">Nové nabídky — ${location}</h2>
      <p style="color:#666">${new Date().toLocaleDateString('cs-CZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px;text-align:left">Název</th>
            <th style="padding:8px;text-align:left">Lokalita</th>
            <th style="padding:8px;text-align:left">Plocha</th>
            <th style="padding:8px;text-align:left">Cena</th>
            <th style="padding:8px;text-align:left">Zdroj</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:24px">
        Vojta Back Office Agent · automatická notifikace
      </p>
    </div>
  `

  await resend.emails.send({
    from: 'Vojta Agent <onboarding@resend.dev>',
    to,
    subject,
    html,
  })
}
