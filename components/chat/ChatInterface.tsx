'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import { QuickActions } from './QuickActions'
import { ApprovalModal } from '@/components/approval/ApprovalModal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Paperclip, Plus } from 'lucide-react'
import { AgentMark } from '@/components/brand/AgentMark'
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
  const [uploadingFile, setUploadingFile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true)
    const uploadMsg: AgentMessage = {
      id: Math.random().toString(36),
      role: 'user',
      content: `Nahrávám soubor: **${file.name}**`,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, uploadMsg])

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()

      const userContent = `Nahrávám soubor: **${file.name}**`
      const assistantContent = res.ok
        ? `Soubor **${file.name}** byl nahrán a přidán do znalostní báze (${data.chunk_count} chunků). Kategorie se přiřadí automaticky. Teď se můžeš na soubor ptát.`
        : `Nepodařilo se nahrát soubor: ${data.error}`

      const resultMsg: AgentMessage = {
        id: Math.random().toString(36),
        role: 'assistant',
        content: assistantContent,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, resultMsg])

      // Uložit upload zprávy do conversations DB, aby je agent viděl v historii
      if (res.ok) {
        fetch('/api/conversations/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userMessage: userContent,
            assistantMessage: assistantContent,
          }),
        }).catch(err => console.error('Failed to save upload conversation:', err))
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Math.random().toString(36),
        role: 'assistant',
        content: 'Chyba při nahrávání souboru.',
        created_at: new Date().toISOString(),
      }])
    } finally {
      setUploadingFile(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/70 bg-white/60 px-4 py-3 backdrop-blur-xl md:px-6">
        <div>
          <h1 className="text-sm font-semibold text-slate-950">Chat</h1>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto rounded-full border-sky-200 bg-white/70 text-blue-700 hover:bg-sky-50"
            onClick={() => {
              const id = crypto.randomUUID()
              localStorage.setItem('agent_session_id', id)
              window.location.reload()
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nový chat
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <QuickActions onSelect={sendMessage} />
        ) : (
          <div className="space-y-7 px-[clamp(1rem,9vw,12rem)] py-8">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-3xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-500 shadow-sm shadow-blue-950/5 backdrop-blur-xl">
                <AgentMark className="h-8 w-8" />
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Agent pracuje
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-[clamp(1rem,10vw,14rem)] pb-5 pt-3">
        <div className="blue-glass mx-auto flex max-w-3xl items-end gap-2 rounded-[2rem] p-2.5">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full border-white/70 bg-white/70 text-blue-700 shadow-sm hover:bg-white"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile || isLoading}
            title="Nahrát soubor do znalostní báze"
          >
            {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napiš dotaz nebo úkol pro agenta..."
            className="max-h-[200px] min-h-[44px] flex-1 resize-none border-0 bg-transparent px-2 py-3 text-[15px] text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-0"
            rows={1}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-11 w-11 rounded-full bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:brightness-105"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
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
