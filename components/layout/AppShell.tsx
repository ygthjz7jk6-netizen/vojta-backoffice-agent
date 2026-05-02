'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Folder, Home, MessageSquare, PanelLeft, Plus, Radio, Settings, Trash2 } from 'lucide-react'
import { LoginButton } from '@/components/auth/LoginButton'
import { AgentMark } from '@/components/brand/AgentMark'

const ACTIVE_SESSION_KEY = 'agent_session_id'
const CHAT_HISTORY_KEY = 'agent_chat_history'
const CHAT_MESSAGES_PREFIX = 'agent_chat_messages:'
const CHAT_HISTORY_EVENT = 'agent_chat_history_updated'
const CHAT_SESSION_EVENT = 'agent_chat_session_changed'

type ChatSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: Home },
  { href: '/documents', label: 'Dokumenty', icon: Folder },
]

const SECONDARY_ITEMS = [
  { label: 'Monitoring', icon: Radio },
  { label: 'Nastavení', icon: Settings },
]

function safelyReadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function loadChatHistory() {
  return safelyReadJson<ChatSummary[]>(CHAT_HISTORY_KEY, [])
}

function saveChatHistory(history: ChatSummary[]) {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history.slice(0, 30)))
  window.dispatchEvent(new Event(CHAT_HISTORY_EVENT))
}

function formatChatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('agent_sidebar_collapsed') === 'true'
  })
  const [chatHistory, setChatHistory] = useState<ChatSummary[]>(() => loadChatHistory())
  const [activeSessionId, setActiveSessionId] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(ACTIVE_SESSION_KEY) ?? ''
  })

  function setSidebarCollapsed(value: boolean) {
    setSidebarCollapsedState(value)
    localStorage.setItem('agent_sidebar_collapsed', String(value))
  }

  useEffect(() => {
    const syncChatHistory = () => {
      setChatHistory(loadChatHistory())
      setActiveSessionId(localStorage.getItem(ACTIVE_SESSION_KEY) ?? '')
    }

    window.addEventListener(CHAT_HISTORY_EVENT, syncChatHistory)
    window.addEventListener(CHAT_SESSION_EVENT, syncChatHistory)
    window.addEventListener('storage', syncChatHistory)
    return () => {
      window.removeEventListener(CHAT_HISTORY_EVENT, syncChatHistory)
      window.removeEventListener(CHAT_SESSION_EVENT, syncChatHistory)
      window.removeEventListener('storage', syncChatHistory)
    }
  }, [])

  function selectChat(id: string) {
    localStorage.setItem(ACTIVE_SESSION_KEY, id)
    setActiveSessionId(id)
    window.dispatchEvent(new Event(CHAT_SESSION_EVENT))
    router.push('/')
  }

  function createChat() {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const chat = { id, title: 'Nový chat', createdAt: now, updatedAt: now }
    const next = [chat, ...loadChatHistory().filter(item => item.id !== id)]

    localStorage.setItem(ACTIVE_SESSION_KEY, id)
    localStorage.setItem(`${CHAT_MESSAGES_PREFIX}${id}`, JSON.stringify([]))
    saveChatHistory(next)
    setChatHistory(next)
    setActiveSessionId(id)
    window.dispatchEvent(new Event(CHAT_SESSION_EVENT))
    router.push('/')
  }

  function deleteChat(id: string) {
    const remaining = loadChatHistory().filter(chat => chat.id !== id)
    localStorage.removeItem(`${CHAT_MESSAGES_PREFIX}${id}`)

    if (id === activeSessionId) {
      const nextSessionId = remaining[0]?.id ?? crypto.randomUUID()
      localStorage.setItem(ACTIVE_SESSION_KEY, nextSessionId)
      setActiveSessionId(nextSessionId)

      if (!remaining[0]) {
        const now = new Date().toISOString()
        remaining.push({ id: nextSessionId, title: 'Nový chat', createdAt: now, updatedAt: now })
        localStorage.setItem(`${CHAT_MESSAGES_PREFIX}${nextSessionId}`, JSON.stringify([]))
      }

      window.dispatchEvent(new Event(CHAT_SESSION_EVENT))
    }

    saveChatHistory(remaining)
    setChatHistory(remaining)
  }

  return (
    <div className="blue-panel flex h-screen overflow-hidden text-slate-950">
      <aside
        className={`sidebar-surface hidden shrink-0 border-r border-white/70 text-slate-900 shadow-xl shadow-blue-950/5 transition-[width] duration-300 md:flex md:flex-col ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="px-4 py-5">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            {sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="group/sidebar-toggle relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[34%_40%_32%_44%/34%_32%_42%_38%] outline-none focus-visible:ring-3 focus-visible:ring-blue-400/35"
                aria-label="Rozbalit panel"
                title="Rozbalit panel"
              >
                <AgentMark className="absolute inset-0 h-10 w-10 transition-opacity duration-200 group-hover/sidebar-toggle:opacity-0" />
                <span className="absolute inset-0 flex items-center justify-center rounded-[34%_40%_32%_44%/34%_32%_42%_38%] bg-white text-blue-700 opacity-0 shadow-sm shadow-blue-950/5 transition-opacity duration-200 group-hover/sidebar-toggle:opacity-100">
                  <PanelLeft className="h-5 w-5" />
                </span>
              </button>
            ) : (
              <>
                <AgentMark className="h-10 w-10" />
                <div>
                  <p className="text-sm font-semibold leading-5 text-slate-950">Back Office Agent</p>
                  <p className="text-xs text-slate-500">Realitní operativa</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-blue-700 transition-colors hover:bg-white/70 focus-visible:ring-3 focus-visible:ring-blue-400/35"
                  aria-label="Skrýt panel"
                  title="Skrýt panel"
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>

        <nav className={`${sidebarCollapsed ? 'flex-1' : 'shrink-0'} space-y-1 px-3 py-4`}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex h-11 items-center rounded-2xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-sky-400 to-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-600 hover:bg-white/70 hover:text-blue-700'
                } ${sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}
              >
                <item.icon className="h-4 w-4" />
                <span className={sidebarCollapsed ? 'sr-only' : ''}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {!sidebarCollapsed && (
          <section className="min-h-0 flex-1 border-t border-white/70 px-3 py-4">
            <div className="mb-2 flex items-center gap-2 px-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Historie chatů</h2>
              <button
                type="button"
                onClick={createChat}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-blue-700 transition-colors hover:bg-white/70 focus-visible:ring-3 focus-visible:ring-blue-400/35"
                aria-label="Nový chat"
                title="Nový chat"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-full min-h-0 space-y-1 overflow-y-auto pr-1">
              {chatHistory.map(chat => {
                const active = chat.id === activeSessionId

                return (
                  <div
                    key={chat.id}
                    className={`group flex items-center gap-1 rounded-2xl px-2 py-2 transition-colors ${
                      active ? 'bg-white text-slate-950 shadow-sm shadow-blue-950/5' : 'text-slate-600 hover:bg-white/70 hover:text-blue-700'
                    }`}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => selectChat(chat.id)}
                      title={chat.title}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        active ? 'bg-blue-600 text-white' : 'bg-sky-50 text-blue-700'
                      }`}>
                        <MessageSquare className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{chat.title}</span>
                        <span className="block text-xs text-slate-400">{formatChatDate(chat.updatedAt)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                      onClick={() => deleteChat(chat.id)}
                      title="Smazat chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <div className="border-t border-white/70 px-3 py-4">
          <div className="space-y-1">
            {SECONDARY_ITEMS.map(item => (
              <button
                key={item.label}
                type="button"
                disabled
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex h-10 w-full items-center rounded-2xl text-left text-sm font-medium text-slate-400 ${
                  sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className={sidebarCollapsed ? 'sr-only' : ''}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/70 bg-white/70 px-4 shadow-sm shadow-blue-950/5 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <AgentMark className="h-8 w-8" />
            <span className="text-sm font-semibold">Back Office</span>
          </div>

          <nav className="flex items-center gap-1 md:hidden">
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'text-slate-500 hover:bg-sky-100 hover:text-blue-700'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]" />
              Online
            </div>
            <LoginButton />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
