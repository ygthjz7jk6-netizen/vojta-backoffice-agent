import pptxgen from 'pptxgenjs'

// ── Typy slide obsahu ─────────────────────────────────────────────────────────

export interface KpiItem {
  label: string
  value: string
  highlight?: boolean
}

export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface SlideSpec {
  heading: string
  bullets?: string[]
  table?: TableData
  kpis?: KpiItem[]
  note?: string
}

export interface PresentationInput {
  title: string
  subtitle?: string
  slides: SlideSpec[]
}

// ── Paleta ────────────────────────────────────────────────────────────────────

const C = {
  primary:    '1E3A5F',
  accent:     'E8A838',
  accentLight:'FDF3DC',
  light:      'F5F7FA',
  white:      'FFFFFF',
  gray:       '6B7280',
  grayLight:  'E5E7EB',
  dark:       '1F2937',
}

type Prs   = InstanceType<typeof pptxgen>
type Slide = ReturnType<Prs['addSlide']>

// ── Helpers ───────────────────────────────────────────────────────────────────

function addHeader(prs: Prs, slide: Slide, text: string) {
  slide.background = { color: C.light }
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.85,
    fill: { color: C.primary }, line: { type: 'none' },
  })
  slide.addText(text, {
    x: 0.5, y: 0.1, w: 11, h: 0.65,
    fontSize: 20, bold: true, color: C.white, fontFace: 'Calibri',
  })
  slide.addText('Back Office Agent', {
    x: 0.5, y: 6.9, w: 11, h: 0.25,
    fontSize: 9, color: C.gray, fontFace: 'Calibri', italic: true,
  })
}

function addNote(slide: Slide, note: string) {
  slide.addText(`Zdroj: ${note}`, {
    x: 0.5, y: 6.6, w: 11, h: 0.25,
    fontSize: 9, color: C.gray, fontFace: 'Calibri', italic: true,
  })
}

// ── Layout: KPI karty ─────────────────────────────────────────────────────────

function renderKpis(prs: Prs, slide: Slide, kpis: KpiItem[]) {
  const count = Math.min(kpis.length, 4)
  const cardW = count > 3 ? 2.9 : count > 2 ? 3.8 : 5.5
  const startX = (12 - count * (cardW + 0.2)) / 2

  kpis.slice(0, count).forEach((kpi, i) => {
    const x = startX + i * (cardW + 0.2)
    const color = kpi.highlight ? C.accent : C.white
    const textColor = kpi.highlight ? C.white : C.primary
    const labelColor = kpi.highlight ? C.white : C.gray

    slide.addShape(prs.ShapeType.rect, {
      x, y: 1.05, w: cardW, h: 1.4,
      fill: { color }, line: { color: C.grayLight, pt: 1 },
    })
    slide.addText(kpi.value, {
      x, y: 1.1, w: cardW, h: 0.8,
      fontSize: 36, bold: true, align: 'center', color: textColor, fontFace: 'Calibri',
    })
    slide.addText(kpi.label, {
      x, y: 1.9, w: cardW, h: 0.38,
      fontSize: 12, align: 'center', color: labelColor, fontFace: 'Calibri',
    })
  })
}

// ── Layout: bullet list ───────────────────────────────────────────────────────

function renderBullets(slide: Slide, bullets: string[], startY = 1.05) {
  bullets.slice(0, 10).forEach((bullet, i) => {
    const y = startY + i * 0.54
    slide.addText(`•  ${bullet}`, {
      x: 0.5, y, w: 11, h: 0.44,
      fontSize: 13, color: C.dark, fontFace: 'Calibri',
    })
  })
}

// ── Layout: tabulka ───────────────────────────────────────────────────────────

function renderTable(prs: Prs, slide: Slide, table: TableData, startY = 1.05) {
  const colCount = table.headers.length
  const colW = 11 / colCount

  // hlavičkový řádek
  slide.addShape(prs.ShapeType.rect, {
    x: 0.5, y: startY, w: 11, h: 0.4,
    fill: { color: C.primary }, line: { type: 'none' },
  })
  table.headers.forEach((h, i) => {
    slide.addText(h, {
      x: 0.6 + i * colW, y: startY + 0.06, w: colW - 0.1, h: 0.28,
      fontSize: 11, bold: true, color: C.white, fontFace: 'Calibri',
    })
  })

  // řádky dat
  const maxRows = Math.min(table.rows.length, 10)
  table.rows.slice(0, maxRows).forEach((row, ri) => {
    const y = startY + 0.45 + ri * 0.42
    slide.addShape(prs.ShapeType.rect, {
      x: 0.5, y, w: 11, h: 0.38,
      fill: { color: ri % 2 === 0 ? C.white : C.light },
      line: { color: C.grayLight, pt: 1 },
    })
    row.slice(0, colCount).forEach((cell, ci) => {
      slide.addText(cell ?? '', {
        x: 0.6 + ci * colW, y: y + 0.05, w: colW - 0.15, h: 0.28,
        fontSize: 11, color: C.dark, fontFace: 'Calibri',
      })
    })
  })
}

// ── Layout: KPI + bullets (kombinovaný) ──────────────────────────────────────

function renderKpisAndBullets(prs: Prs, slide: Slide, kpis: KpiItem[], bullets: string[]) {
  renderKpis(prs, slide, kpis)
  slide.addShape(prs.ShapeType.rect, {
    x: 0.5, y: 2.65, w: 11, h: 0.02,
    fill: { color: C.grayLight }, line: { type: 'none' },
  })
  renderBullets(slide, bullets, 2.8)
}

// ── Slide builder ─────────────────────────────────────────────────────────────

function buildContentSlide(prs: Prs, spec: SlideSpec) {
  const slide = prs.addSlide()
  addHeader(prs, slide, spec.heading)

  const hasKpis    = spec.kpis && spec.kpis.length > 0
  const hasBullets = spec.bullets && spec.bullets.length > 0
  const hasTable   = spec.table && spec.table.headers.length > 0

  if (hasKpis && hasBullets) {
    renderKpisAndBullets(prs, slide, spec.kpis!, spec.bullets!)
  } else if (hasKpis) {
    renderKpis(prs, slide, spec.kpis!)
    // pokud zbývá místo a nic jiného, přidej prázdný prostor
  } else if (hasTable && hasBullets) {
    renderTable(prs, slide, spec.table!, 1.05)
    // bullets pod tabulkou pokud se vejdou
    const tableH = 0.45 + Math.min(spec.table!.rows.length, 10) * 0.42
    if (1.05 + tableH + 0.3 < 5.5) {
      renderBullets(slide, spec.bullets!, 1.05 + tableH + 0.3)
    }
  } else if (hasTable) {
    renderTable(prs, slide, spec.table!, 1.05)
  } else if (hasBullets) {
    renderBullets(slide, spec.bullets!, 1.05)
  }

  if (spec.note) addNote(slide, spec.note)
}

// ── Title slide ───────────────────────────────────────────────────────────────

function buildTitleSlide(prs: Prs, title: string, subtitle?: string) {
  const slide = prs.addSlide()
  slide.background = { color: C.primary }

  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 4.4, w: '100%', h: 0.45,
    fill: { color: C.accent }, line: { type: 'none' },
  })
  slide.addText(title, {
    x: 0.8, y: 1.4, w: 10.4, h: 1.5,
    fontSize: 36, bold: true, color: C.white, fontFace: 'Calibri',
  })
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8, y: 3.1, w: 8, h: 0.55,
      fontSize: 18, color: 'B8C8DC', fontFace: 'Calibri',
    })
  }
  slide.addText(`Vygenerováno: ${new Date().toLocaleDateString('cs-CZ')}`, {
    x: 0.8, y: subtitle ? 3.75 : 3.1, w: 8, h: 0.4,
    fontSize: 13, color: '8AA0BC', fontFace: 'Calibri', italic: true,
  })
  slide.addText('Back Office Agent', {
    x: 0.8, y: 4.5, w: 8, h: 0.3,
    fontSize: 11, color: C.white, fontFace: 'Calibri',
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generatePptx(input: PresentationInput): Promise<string> {
  const prs = new pptxgen()
  prs.layout = 'LAYOUT_WIDE'

  buildTitleSlide(prs, input.title, input.subtitle)

  const maxContent = 9 // title + 9 = 10 max
  input.slides.slice(0, maxContent).forEach(spec => buildContentSlide(prs, spec))

  return await prs.write({ outputType: 'base64' }) as string
}
