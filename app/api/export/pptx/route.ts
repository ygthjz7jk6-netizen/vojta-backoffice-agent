import { NextRequest, NextResponse } from 'next/server'
import { generatePptx, type PresentationInput } from '@/lib/export/pptx'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const input: PresentationInput = await req.json()

    if (!input.title || !Array.isArray(input.slides) || input.slides.length === 0) {
      return NextResponse.json({ error: 'Chybí title nebo slides.' }, { status: 400 })
    }

    const base64 = await generatePptx(input)
    const buffer = Buffer.from(base64, 'base64')
    const filename = `${input.title.replace(/\s+/g, '_')}.pptx`

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
