export interface LocalityResult {
  locationName: string      // normalizované jméno pro zobrazení
  districtId?: number       // locality_district_id pro Sreality
  regionId?: number         // locality_region_id pro Sreality (pro celá města)
}

// Praha: districtId = 500X (Praha 1–10+)
// Ostatní: regionId (kraj)
const LOCALITY_MAP: { keywords: string[]; result: LocalityResult }[] = [
  { keywords: ['holešovice', 'letná', 'praha 7', 'praha7'], result: { locationName: 'Praha 7 (Holešovice)', districtId: 5007 } },
  { keywords: ['vinohrady', 'nusle', 'praha 2', 'praha2'], result: { locationName: 'Praha 2 (Vinohrady)', districtId: 5002 } },
  { keywords: ['žižkov', 'Praha 3', 'Praha3', 'žižkov'], result: { locationName: 'Praha 3 (Žižkov)', districtId: 5003 } },
  { keywords: ['smíchov', 'anděl', 'Praha 5', 'Praha5'], result: { locationName: 'Praha 5 (Smíchov)', districtId: 5005 } },
  { keywords: ['dejvice', 'bubeneč', 'Praha 6', 'Praha6'], result: { locationName: 'Praha 6 (Dejvice)', districtId: 5006 } },
  { keywords: ['karlín', 'libeň', 'Praha 8', 'Praha8'], result: { locationName: 'Praha 8 (Karlín)', districtId: 5008 } },
  { keywords: ['Praha 9', 'Praha9', 'vysočany'], result: { locationName: 'Praha 9', districtId: 5009 } },
  { keywords: ['Praha 10', 'Praha10', 'vršovice', 'strašnice'], result: { locationName: 'Praha 10 (Vršovice)', districtId: 5010 } },
  { keywords: ['Praha 1', 'Praha1', 'staré město', 'malá strana', 'hradčany'], result: { locationName: 'Praha 1', districtId: 5001 } },
  { keywords: ['Praha 4', 'Praha4', 'nusle', 'krč', 'podolí'], result: { locationName: 'Praha 4', districtId: 5004 } },
  // Brno
  { keywords: ['brno'], result: { locationName: 'Brno', regionId: 14 } },
  // Ostatní kraje/města (ověřené Sreality region IDs)
  { keywords: ['ostrava'], result: { locationName: 'Ostrava', regionId: 12 } },
  { keywords: ['plzeň', 'plzen'], result: { locationName: 'Plzeň', regionId: 2 } },
  { keywords: ['liberec'], result: { locationName: 'Liberec', regionId: 5 } },
  { keywords: ['olomouc'], result: { locationName: 'Olomouc', regionId: 8 } },
  { keywords: ['hradec králové', 'hradec kralove'], result: { locationName: 'Hradec Králové', regionId: 6 } },
  { keywords: ['pardubice'], result: { locationName: 'Pardubice', regionId: 7 } },
  { keywords: ['zlín', 'zlin'], result: { locationName: 'Zlín', regionId: 9 } },
  { keywords: ['české budějovice', 'ceske budejovice'], result: { locationName: 'České Budějovice', regionId: 1 } },
]

export function lookupLocality(query: string): LocalityResult {
  const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  for (const entry of LOCALITY_MAP) {
    for (const kw of entry.keywords) {
      const normalizedKw = kw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (q.includes(normalizedKw) || normalizedKw.includes(q)) {
        return entry.result
      }
    }
  }

  // Fallback — Praha jako default
  return { locationName: query, districtId: 5007 }
}
