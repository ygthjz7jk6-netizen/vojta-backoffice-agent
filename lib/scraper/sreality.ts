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
const PER_PAGE = 60

interface SrealityEstate {
  hash_id: number
  name: string
  price: number
  locality: string
  seo?: { locality?: string }
}

interface SrealityParams {
  categoryMain?: number  // 1=byty, 2=domy
  categoryType?: number  // 1=prodej, 2=pronájem
  districtId?: number    // Praha districts (5001–5010)
  cityName?: string      // ostatní města — použije region_entity_type=osmm
  cityFilter?: string    // post-filter: ponech jen nabídky z tohoto města
}

// Stáhne VŠECHNY nabídky (paginuje automaticky)
export async function scrapeAllSreality(params: SrealityParams): Promise<ScrapedListing[]> {
  const first = await fetchPage(params, 1)
  if (first.resultSize <= PER_PAGE) return first.listings

  const totalPages = Math.ceil(first.resultSize / PER_PAGE)
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      fetchPage(params, i + 2).then(r => r.listings).catch(() => [] as ScrapedListing[])
    )
  )

  return [...first.listings, ...rest.flat()]
}

// Stáhne jednu stránku (zachováno pro zpětnou kompatibilitu)
export async function scrapeSreality(params: SrealityParams & { perPage?: number } = {}): Promise<ScrapedListing[]> {
  return (await fetchPage(params, 1, params.perPage ?? 20)).listings
}

async function fetchPage(
  params: SrealityParams,
  page: number,
  perPage = PER_PAGE
): Promise<{ listings: ScrapedListing[]; resultSize: number }> {
  const { categoryMain = 1, categoryType = 1, districtId, cityName, cityFilter } = params

  const url = new URL(SREALITY_API)
  url.searchParams.set('category_main_cb', String(categoryMain))
  url.searchParams.set('category_type_cb', String(categoryType))
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))

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

  const data = await res.json() as { result_size?: number; _embedded?: { estates?: SrealityEstate[] } }
  let estates = data._embedded?.estates ?? []

  if (cityFilter) {
    const needle = normalize(cityFilter)
    estates = estates.filter(e => normalize(stripOkres(e.locality ?? '')).includes(needle))
  }

  const typeSlug = categoryType === 2 ? 'pronajem' : 'prodej'
  const mainSlug = categoryMain === 2 ? 'dum' : 'byt'

  return {
    resultSize: data.result_size ?? 0,
    listings: estates.map(e => ({
      externalId: String(e.hash_id),
      title: e.name ?? 'Bez názvu',
      price: e.price ?? null,
      location: stripOkres(e.locality ?? ''),
      areaSqm: parseArea(e.name),
      url: `https://www.sreality.cz/detail/${typeSlug}/${mainSlug}/${parseDisposition(e.name)}/${e.seo?.locality ?? toSlug(e.locality)}/${e.hash_id}`,
      sourceSite: 'sreality',
    })),
  }
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
