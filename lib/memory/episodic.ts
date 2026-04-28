import { supabaseAdmin } from '@/lib/supabase/client'
import { embedText } from '@/lib/memory/embed'
import type { AgentMessage } from '@/types'

export async function saveConversationTurn(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  sources: unknown[] = [],
  toolCalls: unknown[] = []
) {
  const embedding = await embedText(`${userMessage}\n${assistantMessage}`)

  await supabaseAdmin.from('conversations').insert([
    { session_id: sessionId, role: 'user', content: userMessage, embedding: null },
    {
      session_id: sessionId,
      role: 'assistant',
      content: assistantMessage,
      sources,
      tool_calls: toolCalls,
      embedding,
    },
  ])
}

export async function getRecentMessages(sessionId: string, limit = 5): Promise<AgentMessage[]> {
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return ((data ?? []).reverse() as AgentMessage[])
}

export async function findSimilarConversations(query: string, limit = 3): Promise<AgentMessage[]> {
  const embedding = await embedText(query)

  const { data } = await supabaseAdmin.rpc('search_conversations', {
    query_embedding: embedding,
    match_count: limit,
  })

  return (data ?? []) as AgentMessage[]
}
