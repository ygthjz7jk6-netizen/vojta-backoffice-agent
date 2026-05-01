export interface ScrapedListing {
  externalId: string
  title: string
  price: number | null
  location: string
  areaSqm: number | null
  url: string
  sourceSite: string
}

const SREALITY_API = 'https://www.sreality.cz/api/cs/v2/estates'

interface SrealityEstate {
  hash_id: number
  name: string
  price: number
  locality: string
  seo?: { locality?: string }
}

export async function scrapeSreality(params: {
  categoryMain?: number  // 1=byty, 2=domy
  categoryType?: number  // 1=prodej, 2=pronájem
  districtId?: number    // Praha districts (5001–5010)
  cityName?: string      // ostatní města — použije region_entity_type=osmm
  cityFilter?: string    // post-filter: ponech jen nabídky z tohoto města
  perPage?: number
} = {}): Promise<ScrapedListing[]> {
  const {
    categoryMain = 1,
    categoryType = 1,
    districtId,
    cityName,
    cityFilter,
    perPage = 20,
  } = params

  const url = new URL(SREALITY_API)
  url.searchParams.set('category_main_cb', String(categoryMain))
  url.searchParams.set('category_type_cb', String(categoryType))
  url.searchParams.set('per_page', String(perPage))

  if (districtId) {
    url.searchParams.set('locality_district_id', String(districtId))
  } else if (cityName) {
    url.searchParams.set('region', cityName)
    url.searchParams.set('region_entity_type', 'osmm')
  }

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`Sreality API error: ${res.status}`)

  const data = await res.json() as { _embedded?: { estates?: SrealityEstate[] } }
  const estates = data._embedded?.estates ?? []

  const typeSlug = categoryType === 2 ? 'pronajem' : 'prodej'
  const mainSlug = categoryMain === 2 ? 'dum' : 'byt'

  const needle = cityFilter ? normalize(cityFilter) : null

  const filtered = needle
    ? estates.filter(e => normalize(stripOkres(e.locality ?? '')).includes(needle))
    : estates

  return filtered.map(e => ({
    externalId: String(e.hash_id),
    title: e.name ?? 'Bez názvu',
    price: e.price ?? null,
    location: stripOkres(e.locality ?? ''),
    areaSqm: parseArea(e.name),
    url: `https://www.sreality.cz/detail/${typeSlug}/${mainSlug}/${parseDisposition(e.name)}/${e.seo?.locality ?? toSlug(e.locality)}/${e.hash_id}`,
    sourceSite: 'sreality',
  }))
}

function stripOkres(locality: string): string {
  return locality.replace(/,\s*okres\s+[^,]+/gi, '').trim()
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function parseArea(name: string): number | null {
  const match = name?.match(/(\d+)\s*m²/)
  return match ? parseInt(match[1]) : null
}

function parseDisposition(name: string): string {
  const match = name?.match(/(\d+\+(?:kk|\d+))/i)
  return match ? match[1] : 'byt'
}

function toSlug(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'detail'
}
