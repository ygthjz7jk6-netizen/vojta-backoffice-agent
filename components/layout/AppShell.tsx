'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Folder, Home, PanelLeft, Radio, Settings } from 'lucide-react'
import { LoginButton } from '@/components/auth/LoginButton'
import { AgentMark } from '@/components/brand/AgentMark'

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: Home },
  { href: '/documents', label: 'Dokumenty', icon: Folder },
]

const SECONDARY_ITEMS = [
  { label: 'Monitoring', icon: Radio },
  { label: 'Nastavení', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('agent_sidebar_collapsed') === 'true'
  })

  function setSidebarCollapsed(value: boolean) {
    setSidebarCollapsedState(value)
    localStorage.setItem('agent_sidebar_collapsed', String(value))
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

        <nav className="flex-1 space-y-1 px-3 py-4">
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
