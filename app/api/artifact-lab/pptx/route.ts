import { NextRequest, NextResponse } from 'next/server'
import { generateArtifactDeckPptx, generateArtifactPptx } from '@/lib/artifacts/pptx'
import { sampleArtifacts, sampleDecks } from '@/lib/artifacts/samples'
import type { ArtifactDeck, ArtifactSpec } from '@/lib/artifacts/types'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams
    const theme = search.get('theme') === 'dark' ? 'dark' : 'light'
    const kind = search.get('kind') === 'artifact' ? 'artifact' : 'deck'
    const index = Number(search.get('index') ?? '0')

    const item = kind === 'artifact' ? sampleArtifacts[index] : sampleDecks[index]
    if (!item) {
      return NextResponse.json({ error: 'Neznamy sample.' }, { status: 404 })
    }

    const base64 = kind === 'artifact'
      ? await generateArtifactPptx(item as ArtifactSpec, theme)
      : await generateArtifactDeckPptx(item as ArtifactDeck, theme)
    const buffer = Buffer.from(base64, 'base64')
    const filename = `${item.title.replace(/\s+/g, '_')}_${theme}.pptx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { spec?: ArtifactSpec; deck?: ArtifactDeck; theme?: 'light' | 'dark' }
    if (!body.spec?.title && !body.deck?.title) {
      return NextResponse.json({ error: 'Chybi platny artifact spec nebo deck.' }, { status: 400 })
    }

    const theme = body.theme === 'dark' ? 'dark' : 'light'
    const base64 = body.deck
      ? await generateArtifactDeckPptx(body.deck, theme)
      : await generateArtifactPptx(body.spec!, theme)
    const buffer = Buffer.from(base64, 'base64')
    const title = body.deck?.title ?? body.spec!.title
    const filename = `${title.replace(/\s+/g, '_')}_${theme}.pptx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
