// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import { QuickActions } from './QuickActions'
import { ApprovalModal } from '@/components/approval/ApprovalModal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Paperclip, Plus } from 'lucide-react'
import { AgentMark } from '@/components/brand/AgentMark'

// Minimalistic message type matching what MessageBubble expects
type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolInvocations?: any[]
  sources?: any[]
  created_at?: string
}

export function ChatInterface() {
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return crypto.randomUUID()
    const stored = localStorage.getItem('agent_session_id')
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem('agent_session_id', id)
    return id
  })

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendToAgent = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userMessage, created_at: new Date().toISOString() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    // Placeholder for streaming assistant response
    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', created_at: new Date().toISOString() }])

    try {
      // Convert to simple CoreMessage format for backend
      const coreMessages = updatedMessages.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: coreMessages, sessionId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || res.statusText)
      }

      // Read streaming response as text
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          // Parse Vercel AI data stream format (lines starting with "0:")
          for (const line of chunk.split('\n')) {
            if (line.startsWith('0:')) {
              try {
                const text = JSON.parse(line.slice(2))
                fullText += text
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m))
              } catch {} // ignore parse errors on non-text chunks
            }
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: `Chyba: ${err.message}` }
        : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    sendToAgent(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendToAgent(input)
    }
  }

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true)
    const userContent = `Nahrávám soubor: **${file.name}**`
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: userContent, created_at: new Date().toISOString() }])

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()

      const assistantContent = res.ok
        ? `Soubor **${file.name}** byl nahrán a přidán do znalostní báze (${data.chunk_count} chunků). Kategorie se přiřadí automaticky. Teď se můžeš na soubor ptát.`
        : `Nepodařilo se nahrát soubor: ${data.error}`

      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: assistantContent, created_at: new Date().toISOString() }])

      if (res.ok) {
        fetch('/api/conversations/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, userMessage: userContent, assistantMessage: assistantContent }),
        }).catch(err => console.error('Failed to save', err))
      }
    } catch {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Chyba při nahrávání souboru.', created_at: new Date().toISOString() }])
    } finally {
      setUploadingFile(false)
    }
  }

  // Pending approval logic
  const lastMsg = messages[messages.length - 1]
  const pendingApproval = lastMsg?.toolInvocations?.find(inv => inv.state === 'result' && inv.result?.requires_approval)?.result || null

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
          <QuickActions onSelect={(text) => sendToAgent(text)} />
        ) : (
          <div className="space-y-7 px-[clamp(1rem,9vw,12rem)] py-8">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
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

      <div className="px-[clamp(1rem,10vw,14rem)] pb-5 pt-3">
        <form onSubmit={handleSubmit} className="blue-glass mx-auto flex max-w-3xl items-end gap-2 rounded-[2rem] p-2.5">
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
            type="submit"
            disabled={!input?.trim() || isLoading}
            size="icon"
            className="h-11 w-11 rounded-full bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:brightness-105"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {pendingApproval && (
        <ApprovalModal
          request={pendingApproval}
          onConfirm={async () => {
            if (pendingApproval.type === 'monitoring') {
              const res = await fetch('/api/monitoring/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingApproval)
              })
              if (!res.ok) alert('Chyba při nastavení monitoringu')
            }
            alert('Schváleno')
          }}
          onCancel={() => {}}
        />
      )}
    </div>
  )
}
