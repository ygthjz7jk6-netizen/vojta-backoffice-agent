import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/core'
import { saveConversationTurn } from '@/lib/memory/episodic'
import { supabaseAdmin } from '@/lib/supabase/client'
import { randomUUID } from 'crypto'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Zpráva nesmí být prázdná.' }, { status: 400 })
    }

    const sid = sessionId || randomUUID()

    const { text, citations, toolCalls, requiresApproval } = await runAgent(message, sid)

    // Fire-and-forget — neblokujeme response
    saveConversationTurn(sid, message, text, citations, toolCalls).catch(console.error)
    Promise.resolve(supabaseAdmin.from('audit_log').insert({
      action: 'agent_query',
      tool: toolCalls.map((t: unknown) => (t as { name: string }).name).join(', ') || 'none',
      user_query: message,
      sources_used: citations,
      result_summary: text.slice(0, 200),
    })).catch(console.error)

    return NextResponse.json({
      text,
      citations,
      toolCalls,
      requiresApproval,
      sessionId: sid,
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
