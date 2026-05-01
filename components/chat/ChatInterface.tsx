'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import { QuickActions } from './QuickActions'
import { ApprovalModal } from '@/components/approval/ApprovalModal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import type { AgentMessage } from '@/types'

export function ChatInterface() {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return crypto.randomUUID()
    const stored = localStorage.getItem('agent_session_id')
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem('agent_session_id', id)
    return id
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingApproval, setPendingApproval] = useState<Record<string, any> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: AgentMessage = {
      id: Math.random().toString(36),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      const agentMsg: AgentMessage = {
        id: Math.random().toString(36),
        role: 'assistant',
        content: data.text,
        sources: data.citations,
        tool_calls: data.toolCalls,
        requires_approval: data.requiresApproval,
        created_at: new Date().toISOString(),
      }

      setMessages(prev => [...prev, agentMsg])

      if (data.requiresApproval) {
        setPendingApproval(data.requiresApproval)
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Math.random().toString(36),
        role: 'assistant',
        content: 'Omlouvám se, nastala chyba. Zkus to prosím znovu.',
        created_at: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 md:px-6">
        <div>
          <h1 className="text-sm font-semibold text-neutral-950">Chat</h1>
          <p className="text-xs text-neutral-500">NotebookLM režim, odpovědi pouze ze zdrojů</p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => {
              const id = crypto.randomUUID()
              localStorage.setItem('agent_session_id', id)
              window.location.reload()
            }}
          >
            Nový chat
          </Button>
        )}
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <QuickActions onSelect={sendMessage} />
      )}

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Agent přemýšlí...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 bg-white px-4 py-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napiš dotaz nebo úkol pro agenta..."
            className="flex-1 min-h-[48px] max-h-[200px] resize-none"
            rows={1}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Agent vždy cituje zdroje • Nikdy nevymýšlí data
        </p>
      </div>

      {/* Approval Modal */}
      {pendingApproval && (
        <ApprovalModal
          request={pendingApproval}
          onConfirm={async () => {
            if (pendingApproval.type === 'monitoring') {
              const res = await fetch('/api/monitoring/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingApproval),
              })
              if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Neznámá chyba' }))
                alert(`Chyba při nastavení monitoringu: ${err.error}`)
                return
              }
            }
            setPendingApproval(null)
          }}
          onCancel={() => setPendingApproval(null)}
        />
      )}
    </div>
  )
}
