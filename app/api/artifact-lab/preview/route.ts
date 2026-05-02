import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'
import { generateArtifactDeckPptx, generateArtifactPptx } from '@/lib/artifacts/pptx'
import { sampleArtifacts, sampleDecks } from '@/lib/artifacts/samples'
import type { ArtifactDeck, ArtifactSpec } from '@/lib/artifacts/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const execFileAsync = promisify(execFile)
const SOFFICE = '/Applications/LibreOffice.app/Contents/MacOS/soffice'
const renderCache = new Map<string, { createdAt: number; pages: Buffer[]; title: string; theme: 'light' | 'dark' }>()

function safeName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'artifact'
}

function htmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function renderPdfPages(pdf: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { createCanvas } = await import('@napi-rs/canvas')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  ).href
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdf),
  } as unknown as Parameters<typeof pdfjs.getDocument>[0]).promise
  const pages: Buffer[] = []

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise
    pages.push(canvas.toBuffer('image/png'))
  }

  return pages
}

export async function GET(req: NextRequest) {
  let workDir: string | null = null

  try {
    const search = req.nextUrl.searchParams
    const cacheId = search.get('cache')
    if (cacheId) {
      const cached = renderCache.get(cacheId)
      const pageIndex = Number(search.get('page') ?? '0')
      const page = cached?.pages[pageIndex]
      if (!cached || !page) {
        return NextResponse.json({ error: 'Render cache nenalezen.' }, { status: 404 })
      }
      return new NextResponse(new Uint8Array(page), {
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(page.length),
          'Cache-Control': 'no-store',
        },
      })
    }

    const theme = search.get('theme') === 'dark' ? 'dark' : 'light'
    const kind = search.get('kind') === 'artifact' ? 'artifact' : 'deck'
    const index = Number(search.get('index') ?? '0')

    const item = kind === 'artifact' ? sampleArtifacts[index] : sampleDecks[index]
    if (!item) {
      return NextResponse.json({ error: 'Neznamy sample.' }, { status: 404 })
    }

    workDir = await mkdtemp(path.join(tmpdir(), 'artifact-lab-'))
    const base = safeName(item.title)
    const pptxPath = path.join(workDir, `${base}.pptx`)
    const pdfPath = path.join(workDir, `${base}.pdf`)
    const profileDir = path.join(workDir, `lo-profile-${randomUUID()}`)

    const base64 = kind === 'artifact'
      ? await generateArtifactPptx(item as ArtifactSpec, theme)
      : await generateArtifactDeckPptx(item as ArtifactDeck, theme)
    await writeFile(pptxPath, Buffer.from(base64, 'base64'))

    await execFileAsync(SOFFICE, [
      '--headless',
      '--nologo',
      '--nofirststartwizard',
      `-env:UserInstallation=file://${profileDir}`,
      '--convert-to',
      'pdf',
      '--outdir',
      workDir,
      pptxPath,
    ], { timeout: 45000 })

    const pdf = await readFile(pdfPath)

    if (search.get('format') === 'pdf') {
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${base}_${theme}.pdf"`,
          'Content-Length': String(pdf.length),
          'Cache-Control': 'no-store',
        },
      })
    }

    for (const [key, value] of renderCache) {
      if (Date.now() - value.createdAt > 10 * 60 * 1000) renderCache.delete(key)
    }

    const pages = await renderPdfPages(pdf)
    const id = randomUUID()
    renderCache.set(id, { createdAt: Date.now(), pages, title: item.title, theme })
    const html = `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(item.title)} render</title>
    <style>
      :root { color-scheme: ${theme}; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        background: ${theme === 'dark' ? '#0b0d10' : '#e9f2fb'};
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .wrap { max-width: 1180px; margin: 0 auto; display: grid; gap: 22px; }
      .meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        color: ${theme === 'dark' ? '#cbd5e1' : '#334155'};
        font-size: 13px;
      }
      .slide {
        width: 100%;
        aspect-ratio: 16 / 9;
        display: block;
        border-radius: 14px;
        border: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,.13)' : 'rgba(15,23,42,.12)'};
        box-shadow: 0 24px 80px ${theme === 'dark' ? 'rgba(0,0,0,.38)' : 'rgba(15,23,42,.12)'};
        background: white;
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <div class="meta">
        <strong>${htmlEscape(item.title)}</strong>
        <span>${pages.length} slides / LibreOffice render</span>
      </div>
      ${pages.map((_, index) => `<img class="slide" src="/api/artifact-lab/preview?cache=${id}&page=${index}" alt="Slide ${index + 1}" />`).join('\n      ')}
    </main>
  </body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    if (workDir) {
      void rm(workDir, { recursive: true, force: true })
    }
  }
}
