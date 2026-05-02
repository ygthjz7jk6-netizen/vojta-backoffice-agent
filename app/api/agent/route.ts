// @ts-nocheck
import { after, NextRequest } from 'next/server'
import { runAgentStream } from '@/lib/agent/core'
import { auth } from '@/auth'
import { randomUUID } from 'crypto'
import { saveConversationTurn } from '@/lib/memory/episodic'
import { extractAndSaveMemories } from '@/lib/memory/pepa-memory'
import { supabaseAdmin } from '@/lib/supabase/client'

export const maxDuration = 60

function extractLatestUserText(messages: any[]): string {
  const latest = [...messages].reverse().find(msg => msg.role === 'user')
  if (!latest) return ''
  if (typeof latest.content === 'string') return latest.content
  if (Array.isArray(latest.parts)) {
    return latest.parts
      .filter((part: any) => part.type === 'text' && typeof part.text === 'string')
      .map((part: any) => part.text)
      .join('\n')
  }
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionId, id } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Zprávy nesmí být prázdné.' }), { status: 400 })
    }

    const sid = sessionId || id || randomUUID()
    const session = await auth()
    const accessToken = session?.accessToken ?? null

    const latestUserMessage = extractLatestUserText(messages)

    const result = await runAgentStream(messages, accessToken, async ({ text, toolCalls, citations }) => {
      after(async () => {
        const results = await Promise.allSettled([
          saveConversationTurn(sid, latestUserMessage, text, citations, toolCalls),
          supabaseAdmin.from('audit_log').insert({
            action: 'agent_query_stream',
            tool: toolCalls.map((t: any) => t.toolName).join(', ') || 'none',
            user_query: latestUserMessage,
            sources_used: citations,
            result_summary: text.slice(0, 200),
          }),
          extractAndSaveMemories(latestUserMessage, accessToken),
        ])

        for (const res of results) {
          if (res.status === 'rejected') console.error('onFinish Error:', res.reason)
        }
      })
    })

    return result.toUIMessageStreamResponse({
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
