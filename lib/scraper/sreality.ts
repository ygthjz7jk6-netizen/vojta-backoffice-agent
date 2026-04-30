export interface ScrapedListing {
  externalId: string
  title: string
  price: number | null
  location: string
  areaSqm: number | null
  url: string
  sourceSite: string
}

// Praha 7 (Holešovice, Letná) = district 5006, region 10
const SREALITY_API = 'https://www.sreality.cz/api/cs/v2/estates'

interface SrealityEstate {
  hash_id: number
  name: string
  price: number
  locality: string
  gps?: { lat: number; lon: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labelsMap?: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items?: { name: string; value: unknown }[]
}

export async function scrapeSreality(params: {
  categoryMain?: number  // 1=byty, 2=domy
  categoryType?: number  // 1=prodej, 2=pronájem
  districtId?: number
  regionId?: number
  perPage?: number
} = {}): Promise<ScrapedListing[]> {
  const {
    categoryMain = 1,
    categoryType = 1,  // prodej
    districtId = 5007, // Praha 7 (Holešovice)
    regionId,
    perPage = 20,
  } = params

  const url = new URL(SREALITY_API)
  url.searchParams.set('category_main_cb', String(categoryMain))
  url.searchParams.set('category_type_cb', String(categoryType))
  if (regionId) {
    url.searchParams.set('locality_region_id', String(regionId))
  } else {
    url.searchParams.set('locality_district_id', String(districtId))
  }
  url.searchParams.set('per_page', String(perPage))

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`Sreality API error: ${res.status}`)

  const data = await res.json() as { _embedded?: { estates?: SrealityEstate[] } }
  const estates = data._embedded?.estates ?? []

  return estates.map(e => ({
    externalId: String(e.hash_id),
    title: e.name ?? 'Bez názvu',
    price: e.price ?? null,
    location: e.locality ?? '',
    areaSqm: parseArea(e.name),
    url: `https://www.sreality.cz/detail/${params.categoryType === 2 ? 'pronajem' : 'prodej'}/byt/-/${e.hash_id}`,
    sourceSite: 'sreality',
  }))
}

function parseArea(name: string): number | null {
  const match = name?.match(/(\d+)\s*m²/)
  return match ? parseInt(match[1]) : null
}
