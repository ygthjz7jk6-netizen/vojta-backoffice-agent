import { GoogleGenerativeAI, type Content } from '@google/generative-ai'
import { buildSystemPrompt } from './prompt'
import { getPepaProfile } from '@/lib/memory/pepa-profile'
import { getRecentMessages, findSimilarConversations } from '@/lib/memory/episodic'
import { TOOLS } from '@/lib/tools/index'
import { handleToolCall } from '@/lib/tools/handlers'
import type { Citation } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

export async function runAgent(
  userMessage: string,
  sessionId: string,
  onChunk?: (text: string) => void
): Promise<{ text: string; citations: Citation[]; toolCalls: unknown[]; requiresApproval?: unknown }> {
  const [profile, recentMessages, similarConversations] = await Promise.all([
    getPepaProfile(),
    getRecentMessages(sessionId, 5),
    findSimilarConversations(userMessage, 3),
  ])

  const systemPrompt = buildSystemPrompt(profile)

  const history: Content[] = []

  // Přidat relevantní episodickou paměť jako kontext
  if (similarConversations.length > 0) {
    const memoryContext = similarConversations
      .map(m => `[${new Date(m.created_at).toLocaleDateString('cs-CZ')}]: ${m.content}`)
      .join('\n\n')
    history.push({
      role: 'user',
      parts: [{ text: `[Kontext z minulých konverzací]\n${memoryContext}` }],
    })
    history.push({
      role: 'model',
      parts: [{ text: 'Rozumím, beru v úvahu kontext minulých konverzací.' }],
    })
  }

  // Přidat posledních 5 zpráv aktuální session
  for (const msg of recentMessages) {
    history.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    tools: TOOLS,
  })

  const chat = model.startChat({ history })

  const allCitations: Citation[] = []
  const allToolCalls: unknown[] = []
  let requiresApproval: unknown = null
  let finalText = ''

  // Tool calling loop
  let currentMessage = userMessage
  for (let iteration = 0; iteration < 5; iteration++) {
    const result = await chat.sendMessage(currentMessage)
    const response = result.response

    const functionCalls = response.functionCalls()

    if (!functionCalls || functionCalls.length === 0) {
      finalText = response.text()
      break
    }

    // Zpracovat tool calls
    const toolResults = []
    for (const fc of functionCalls) {
      const { result: toolResult, citations } = await handleToolCall(
        fc.name,
        fc.args as Record<string, unknown>
      )

      allCitations.push(...citations)
      allToolCalls.push({ name: fc.name, input: fc.args, output: toolResult })

      // Zachytit approval požadavky
      if (toolResult && typeof toolResult === 'object' && 'requires_approval' in toolResult) {
        requiresApproval = toolResult
      }

      toolResults.push({
        functionResponse: {
          name: fc.name,
          response: { result: toolResult },
        },
      })
    }

    // Poslat výsledky toolů zpět
    const followUp = await chat.sendMessage(toolResults)
    finalText = followUp.response.text()

    // Pokud nejsou další tool calls, hotovo
    if (!followUp.response.functionCalls()?.length) break
  }

  if (onChunk) onChunk(finalText)

  return {
    text: finalText,
    citations: allCitations,
    toolCalls: allToolCalls,
    requiresApproval,
  }
}
