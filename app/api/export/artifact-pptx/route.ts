import { NextRequest, NextResponse } from 'next/server'
import { generateArtifactDeckPptx, generateArtifactPptx } from '@/lib/artifacts/pptx'
import type { ArtifactDeck, ArtifactSpec } from '@/lib/artifacts/types'

export const maxDuration = 30

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'artifact'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { spec?: ArtifactSpec; deck?: ArtifactDeck; theme?: 'light' | 'dark' }
    const theme = body.theme === 'dark' ? 'dark' : 'light'
    const title = body.deck?.title ?? body.spec?.title

    if (!title || (!body.spec && !body.deck)) {
      return NextResponse.json({ error: 'Chybí artifact spec nebo deck.' }, { status: 400 })
    }

    const base64 = body.deck
      ? await generateArtifactDeckPptx(body.deck, theme)
      : await generateArtifactPptx(body.spec!, theme)
    const buffer = Buffer.from(base64, 'base64')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${safeFilePart(title)}_${theme}.pptx"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
