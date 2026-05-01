import { after, NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/core'
import { saveConversationTurn } from '@/lib/memory/episodic'
import { extractAndSaveMemories } from '@/lib/memory/pepa-memory'
import { supabaseAdmin } from '@/lib/supabase/client'
import { auth } from '@/auth'
import { randomUUID } from 'crypto'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Zpráva nesmí být prázdná.' }, { status: 400 })
    }

    const sid = sessionId || randomUUID()
    const session = await auth()
    const accessToken = session?.accessToken ?? null

    const { text, citations, toolCalls, requiresApproval } = await runAgent(message, sid, undefined, accessToken)

    after(async () => {
      const auditInsert = supabaseAdmin.from('audit_log').insert({
        action: 'agent_query',
        tool: toolCalls.map((t: unknown) => (t as { name: string }).name).join(', ') || 'none',
        user_query: message,
        sources_used: citations,
        result_summary: text.slice(0, 200),
      })

      const results = await Promise.allSettled([
        saveConversationTurn(sid, message, text, citations, toolCalls),
        auditInsert,
        extractAndSaveMemories(message),
      ])

      for (const result of results) {
        if (result.status === 'rejected') console.error(result.reason)
      }
    })

    return NextResponse.json({
      text,
      citations,
      toolCalls,
      requiresApproval,
      sessionId: sid,
      isAuthenticated: !!session,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Agent error:', msg)
    return NextResponse.json(
      { error: 'Agent selhal.', detail: msg },
      { status: 500 }
    )
  }
}
