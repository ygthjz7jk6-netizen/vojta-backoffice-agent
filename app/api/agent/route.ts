import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/core'
import { saveConversationTurn } from '@/lib/memory/episodic'
import { supabaseAdmin } from '@/lib/supabase/client'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Zpráva nesmí být prázdná.' }, { status: 400 })
    }

    const sid = sessionId || randomUUID()

    const { text, citations, toolCalls, requiresApproval } = await runAgent(message, sid)

    // Uložit do episodické paměti
    await saveConversationTurn(sid, message, text, citations, toolCalls)

    // Audit log
    await supabaseAdmin.from('audit_log').insert({
      action: 'agent_query',
      tool: toolCalls.map((t: unknown) => (t as { name: string }).name).join(', ') || 'none',
      user_query: message,
      sources_used: citations,
      result_summary: text.slice(0, 200),
    })

    return NextResponse.json({
      text,
      citations,
      toolCalls,
      requiresApproval,
      sessionId: sid,
    })
  } catch (error) {
    console.error('Agent error:', error)
    return NextResponse.json(
      { error: 'Agent selhal. Zkuste to prosím znovu.' },
      { status: 500 }
    )
  }
}
