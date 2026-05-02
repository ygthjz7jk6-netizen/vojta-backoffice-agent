import { NextRequest, NextResponse } from 'next/server'
import { generateArtifactXlsx } from '@/lib/artifacts/xlsx'
import type { ArtifactDeck, ArtifactSpec } from '@/lib/artifacts/types'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { spec?: ArtifactSpec; deck?: ArtifactDeck }
    const artifact = body.deck ?? body.spec

    if (!artifact) {
      return NextResponse.json({ error: 'Chybí artifact spec nebo deck.' }, { status: 400 })
    }

    const { base64, filename } = generateArtifactXlsx(artifact)
    const buffer = Buffer.from(base64, 'base64')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
