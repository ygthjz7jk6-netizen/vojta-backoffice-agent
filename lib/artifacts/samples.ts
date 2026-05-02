import type { ArtifactDeck, ArtifactSpec } from './types'

function monthLabels() {
  return ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen']
}

export const sampleArtifacts: ArtifactSpec[] = [
  {
    title: 'Vývoj leadů za posledních 6 měsíců',
    subtitle: 'Reality pipeline',
    description: 'Kompaktni prehled vykonu akvizice a zdroju poptavek.',
    blocks: [
      {
        type: 'kpi',
        items: [
          { label: 'Leadu celkem', value: '186', delta: '+24 %', tone: 'good' },
          { label: 'Konverze', value: '18.4 %', delta: '+3.1 p.b.', tone: 'good' },
          { label: 'Prumerna cena', value: '8.7 mil.', tone: 'accent' },
        ],
      },
      {
        type: 'chart',
        title: 'Měsíční trend',
        kind: 'bar',
        labels: monthLabels(),
        datasets: [{ label: 'Leady', data: [19, 24, 31, 28, 39, 45] }],
      },
      {
        type: 'chart',
        title: 'Podil zdroju',
        kind: 'donut',
        labels: ['Web', 'Sreality', 'Doporučení', 'Google Ads'],
        datasets: [{ label: 'Zdroj', data: [42, 31, 18, 9] }],
        unit: '%',
      },
      {
        type: 'insight',
        text: 'Nejsilnější růst přišel z webu a doporučení. Placeným kampaním stojí za to zkontrolovat cenu za lead.',
        tone: 'accent',
      },
    ],
    sources: [{ label: 'crm_leads', detail: 'demo fixture' }],
  },
  {
    title: 'Bufet: spotřeba rohlíků za týden',
    subtitle: 'Nedoménový test univerzálního renderu',
    description: 'Schválně mimo reality, aby šablona nebyla navázaná na jednu oblast.',
    blocks: [
      {
        type: 'kpi',
        items: [
          { label: 'Rohlíků týdně', value: '428 ks', delta: '+70 %', tone: 'good' },
          { label: 'Nejsilnější den', value: 'Středa', tone: 'accent' },
          { label: 'Průměr denně', value: '61 ks', tone: 'neutral' },
        ],
      },
      {
        type: 'chart',
        title: 'Tvar týdne',
        kind: 'dotMatrix',
        labels: ['Po', 'Ut', 'St', 'Ct', 'Pa', 'So', 'Ne'],
        datasets: [{ label: 'Kusy', data: [42, 58, 91, 75, 88, 44, 30] }],
        unit: 'ks',
      },
      {
        type: 'table',
        title: 'Denní rozpad',
        headers: ['Den', 'Rano', 'Obed', 'Odpoledne', 'Celkem'],
        rows: [
          ['Po', 18, 16, 8, 42],
          ['Ut', 24, 21, 13, 58],
          ['St', 39, 31, 21, 91],
          ['Ct', 32, 27, 16, 75],
          ['Pa', 38, 34, 16, 88],
          ['So', 20, 14, 10, 44],
          ['Ne', 13, 10, 7, 30],
        ],
      },
    ],
    sources: [{ label: 'bufet_firma', detail: 'random test data' }],
  },
  {
    title: 'Nemovitosti s chybějícími údaji',
    subtitle: 'Datová kvalita',
    blocks: [
      {
        type: 'kpi',
        items: [
          { label: 'Nemovitosti', value: '14' },
          { label: 'S chybějícími daty', value: '7', tone: 'warning' },
          { label: 'Priorita', value: '3 vysoké', tone: 'bad' },
        ],
      },
      {
        type: 'table',
        title: 'Kandidati k doplneni',
        headers: ['Nemovitost', 'Lokalita', 'Cena', 'Chybi'],
        rows: [
          ['Byt 3+kk Nad Krocinkou', 'Praha 9', '8 900 000 Kc', 'rekonstrukce'],
          ['Rodinny dum Klanovice', 'Praha 9', '17 500 000 Kc', 'energeticka trida'],
          ['Atelier Vrsovice', 'Praha 10', '5 200 000 Kc', 'plocha sklepa'],
          ['Pozemek Dolni Brezany', 'Praha-zapad', '11 800 000 Kc', 'site'],
        ],
      },
      {
        type: 'text',
        title: 'Doporuceny dalsi krok',
        bullets: [
          'Nejdriv doplnit rekonstrukce u bytu Nad Krocinkou.',
          'U domu Klanovice overit energeticky stitek pred dalsi kampani.',
          'U pozemku oddělit chybějící technické sítě od obchodního popisu.',
        ],
      },
    ],
    sources: [{ label: 'properties', detail: 'demo fixture' }],
  },
  {
    title: 'Stress test dlouhych labelu a ridkych dat',
    subtitle: 'Fallback chovani',
    blocks: [
      {
        type: 'chart',
        title: 'Velmi dlouhe kategorie',
        kind: 'bar',
        labels: [
          'Organicke poptavky z dlouhodobeho obsahu',
          'Telefonaty po osobnim doporuceni',
          'Jednorazova kampan s omezenym rozpoctem',
        ],
        datasets: [{ label: 'Počet', data: [3, 12, 0] }],
      },
      {
        type: 'insight',
        text: 'Renderer musi zustat citelny i tehdy, kdyz jsou data mala, nazvy dlouhe a jedna hodnota nulova.',
        tone: 'warning',
      },
    ],
    sources: [{ label: 'artifact lab', detail: 'edge case' }],
  },
]

export const sampleDecks: ArtifactDeck[] = [
  {
    title: 'Týdenní back office prezentace',
    subtitle: 'Komplexni deck test',
    description: 'Víceslidová prezentace s nadpisy, grafy, KPI, tabulkami, odrážkami a textovými insighty.',
    slides: [
      {
        title: 'Executive summary',
        subtitle: 'Slide 1 / souhrn',
        layout: 'summary',
        description: 'Rychlý přehled týdne pro Pepu: obchodní výkon, kvalita dat a další kroky.',
        blocks: [
          {
            type: 'kpi',
            items: [
              { label: 'Nové leady', value: '42', delta: '+18 %', tone: 'good' },
              { label: 'Aktivni nemovitosti', value: '14', tone: 'accent' },
              { label: 'Chybějící údaje', value: '7', delta: '-2 oproti minule', tone: 'warning' },
              { label: 'Nové nabídky monitoring', value: '9', tone: 'neutral' },
            ],
          },
          {
            type: 'insight',
            title: 'Hlavní zpráva',
            text: 'Poptávka roste, ale kvalita dat u nemovitostí pořád brzdí navazující komunikaci a reporting.',
            tone: 'accent',
          },
          {
            type: 'text',
            title: 'Co udělat tento týden',
            bullets: [
              'Doplnit rekonstrukce a energetické štítky u prioritních nemovitostí.',
              'Zkontrolovat kampaně s nižší konverzí z placených zdrojů.',
              'Připravit follow-up pro leady s vysokou pravděpodobností prohlídky.',
            ],
          },
        ],
        sources: [{ label: 'crm_leads + properties', detail: 'demo fixture' }],
      },
      {
        title: 'Výkon leadů podle měsíců',
        subtitle: 'Slide 2 / grafy',
        layout: 'chart-focus',
        description: 'Trend akvizice a rozpad zdrojů poptávek.',
        blocks: [
          {
            type: 'chart',
            title: 'Měsíční trend leadů',
            subtitle: 'Počet nových leadů podle měsíce',
            kind: 'area',
            labels: monthLabels(),
            datasets: [{ label: 'Leady', data: [19, 24, 31, 28, 39, 45] }],
            unit: 'leadů',
            yAxisLabel: 'Počet leadů',
            summaryValue: '+24 %',
            annotation: 'Červen je nejsilnější měsíc v celé řadě.',
            highlightIndex: 5,
            showValueLabels: true,
          },
          {
            type: 'chart',
            title: 'Zdroj poptávek',
            kind: 'donut',
            labels: ['Web', 'Sreality', 'Doporučení', 'Google Ads'],
            datasets: [{ label: 'Podil', data: [42, 31, 18, 9] }],
            unit: '%',
          },
          {
            type: 'insight',
            text: 'Největší přírůstek přišel z organických zdrojů. Placeným kampaním chybí podobné tempo.',
            tone: 'good',
          },
        ],
        sources: [{ label: 'crm_leads', detail: 'monthly_count' }],
      },
      {
        title: 'Datová kvalita nemovitostí',
        subtitle: 'Slide 3 / tabulka',
        layout: 'table-focus',
        description: 'Které záznamy potřebují doplnit před další prezentací klientům.',
        blocks: [
          {
            type: 'table',
            title: 'Prioritni doplneni',
            headers: ['Nemovitost', 'Lokalita', 'Cena', 'Chybi', 'Priorita'],
            rows: [
              ['Byt 3+kk Nad Krocínkou', 'Praha 9', '8 900 000 Kč', 'rekonstrukce', 'vysoká'],
              ['Rodinný dům Klánovice', 'Praha 9', '17 500 000 Kč', 'energetická třída', 'vysoká'],
              ['Ateliér Vršovice', 'Praha 10', '5 200 000 Kč', 'plocha sklepa', 'střední'],
              ['Pozemek Dolní Břežany', 'Praha-západ', '11 800 000 Kč', 'sítě', 'vysoká'],
              ['Byt 2+kk Nusle', 'Praha 4', '6 300 000 Kč', 'fond oprav', 'nízká'],
            ],
          },
          {
            type: 'text',
            title: 'Komentar',
            bullets: [
              'Chybějící údaje mají dopad hlavně na klientskou prezentaci a srovnávací reporty.',
              'U vysokých priorit dává smysl doplnění ještě před dalším mailingem.',
            ],
          },
        ],
        sources: [{ label: 'properties', detail: 'has_missing_fields=true' }],
      },
      {
        title: 'Bufetovy sanity check',
        subtitle: 'Slide 4 / mimo realitni domenu',
        layout: 'big-number',
        description: 'Stejny renderer musi zvladnout i libovolne tema bez realitniho kontextu.',
        blocks: [
          {
            type: 'kpi',
            items: [
              { label: 'Rohlíků týdně', value: '428', delta: '+70 %', tone: 'good' },
              { label: 'Špička', value: 'Středa', tone: 'accent' },
              { label: 'Průměr denně', value: '61 ks' },
            ],
          },
          {
            type: 'chart',
            title: 'Spotřeba v týdnu',
            subtitle: 'Počet rohlíků snědených v bufetu podle dne',
            kind: 'dotMatrix',
            labels: ['Po', 'Ut', 'St', 'Ct', 'Pa', 'So', 'Ne'],
            datasets: [{ label: 'Rohliky', data: [42, 58, 91, 75, 88, 44, 30] }],
            unit: 'ks',
            annotation: 'Středa a pátek tvoří největší špičky týdne.',
            highlightIndex: 2,
            showValueLabels: true,
          },
          {
            type: 'insight',
            text: 'Datový kontrakt neřeší doménu. Když AI dodá strukturovaná data, renderer z nich udělá čitelný slide.',
            tone: 'accent',
          },
        ],
        sources: [{ label: 'bufet_firma', detail: 'random test data' }],
      },
      {
        title: 'Akční plán',
        subtitle: 'Slide 5 / timeline',
        layout: 'timeline',
        description: 'Praktický plán pro další týden v jasných krocích.',
        blocks: [
          {
            type: 'text',
            title: 'Kroky',
            bullets: [
              'Doplnit kritické údaje v databázi nemovitostí.',
              'Oslovit leady se zájmem o prohlídku.',
              'Zkontrolovat zdroje s nízkou konverzí.',
              'Připravit krátký report pro pondělní poradu.',
            ],
          },
          {
            type: 'insight',
            text: 'Největší dopad bude mít kombinace datové hygieny a rychlého follow-upu na teplé leady.',
            tone: 'accent',
          },
        ],
        sources: [{ label: 'artifact lab', detail: 'action plan fixture' }],
      },
    ],
    sources: [{ label: 'artifact lab', detail: 'complex deck fixture' }],
  },
]

function randomizeSpec(base: ArtifactSpec): ArtifactSpec {
  return {
    ...base,
    blocks: base.blocks.map(block => {
      if (block.type !== 'chart') return block
      return {
        ...block,
        datasets: block.datasets.map(dataset => ({
          ...dataset,
          data: dataset.data.map(value => Math.max(0, Math.round(value * (0.72 + Math.random() * 0.68)))),
        })),
      }
    }),
  }
}

export function randomizeArtifact(base: ArtifactSpec): ArtifactSpec {
  return randomizeSpec(base)
}

export function randomizeDeck(base: ArtifactDeck): ArtifactDeck {
  return {
    ...base,
    slides: base.slides.map(slide => randomizeSpec(slide)),
  }
}
