'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Database, Home, Radio, Settings } from 'lucide-react'
import { LoginButton } from '@/components/auth/LoginButton'

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: Home },
  { href: '/documents', label: 'Dokumenty', icon: Database },
]

const SECONDARY_ITEMS = [
  { label: 'Monitoring', icon: Radio },
  { label: 'Nastavení', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-100 text-neutral-950">
      <aside className="hidden w-64 shrink-0 border-r border-neutral-200 bg-white md:flex md:flex-col">
        <div className="border-b border-neutral-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-950 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-5">Back Office Agent</p>
              <p className="text-xs text-neutral-500">Realitní operativa</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-neutral-950 text-white'
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-neutral-200 px-3 py-4">
          <div className="space-y-1">
            {SECONDARY_ITEMS.map(item => (
              <button
                key={item.label}
                type="button"
                disabled
                className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-neutral-400"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-950 text-white">
              <Bot className="h-4 w-4" />
            </div>
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
                  className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                    active
                      ? 'bg-neutral-950 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-neutral-500 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
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
