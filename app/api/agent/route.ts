// @ts-nocheck
import { NextRequest } from 'next/server'
import { runAgentStream } from '@/lib/agent/core'
import { auth } from '@/auth'
import { randomUUID } from 'crypto'
import { saveConversationTurn } from '@/lib/memory/episodic'
import { extractAndSaveMemories } from '@/lib/memory/pepa-memory'
import { supabaseAdmin } from '@/lib/supabase/client'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionId } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Zprávy nesmí být prázdné.' }), { status: 400 })
    }

    const sid = sessionId || randomUUID()
    const session = await auth()
    const accessToken = session?.accessToken ?? null

    const latestUserMessage = messages[messages.length - 1]?.content || ''

    const result = await runAgentStream(messages, accessToken, async ({ text, toolCalls, citations }) => {
      const results = await Promise.allSettled([
        saveConversationTurn(sid, latestUserMessage, text, citations, toolCalls),
        supabaseAdmin.from('audit_log').insert({
          action: 'agent_query_stream',
          tool: toolCalls.map((t: any) => t.toolName).join(', ') || 'none',
          user_query: latestUserMessage,
          sources_used: citations,
          result_summary: text.slice(0, 200),
        }),
        extractAndSaveMemories(latestUserMessage),
      ])

      for (const res of results) {
        if (res.status === 'rejected') console.error('onFinish Error:', res.reason)
      }
    })

    // Use built-in method on StreamTextResult to get a response
    return result.toTextStreamResponse({
      headers: {
        'x-session-id': sid,
        'x-is-authenticated': String(!!session)
      }
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Agent stream error:', msg)
    return new Response(JSON.stringify({ error: 'Agent selhal.', detail: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
