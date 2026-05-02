import { NextRequest, NextResponse } from 'next/server'
import { saveConversationTurn } from '@/lib/memory/episodic'
import { auth } from '@/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, userMessage, assistantMessage } = await req.json()

    if (!sessionId || !userMessage || !assistantMessage) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    await saveConversationTurn(sessionId, userMessage, assistantMessage)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Save conversation error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
