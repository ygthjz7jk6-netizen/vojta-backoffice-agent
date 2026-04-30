import type { ScrapedListing } from './sreality'

const BRK_API = 'https://api.bezrealitky.cz/graphql'

const QUERY = `
  query ListAdverts($filters: AdvertFilterInput, $limit: Int) {
    listAdverts(filters: $filters, limit: $limit) {
      id
      uri
      headline
      price
      priceNote
      surface
      location {
        address
      }
    }
  }
`

interface BrkAdvert {
  id: string
  uri: string
  headline: string
  price: number | null
  surface: number | null
  location?: { address?: string }
}

export async function scrapeBezrealitky(params: {
  offerType?: 'PRODEJ' | 'PRONAJEM'
  estateType?: 'BYT' | 'DUM'
  location?: string
  limit?: number
} = {}): Promise<ScrapedListing[]> {
  const {
    offerType = 'PRODEJ',
    estateType = 'BYT',
    location = 'Holešovice',
    limit = 20,
  } = params

  const res = await fetch(BRK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        filters: {
          offerType,
          estateType,
          locationInput: { locationText: location },
        },
        limit,
      },
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`Bezrealitky API error: ${res.status}`)

  const data = await res.json() as { data?: { listAdverts?: BrkAdvert[] } }
  const adverts = data.data?.listAdverts ?? []

  return adverts.map(a => ({
    externalId: String(a.id),
    title: a.headline ?? 'Bez názvu',
    price: a.price ?? null,
    location: a.location?.address ?? location,
    areaSqm: a.surface ?? null,
    url: `https://www.bezrealitky.cz/${a.uri}`,
    sourceSite: 'bezrealitky',
  }))
}
