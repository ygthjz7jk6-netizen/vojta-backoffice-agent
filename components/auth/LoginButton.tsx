'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LogIn, LogOut, User } from 'lucide-react'

export function LoginButton() {
  const { data: session, status } = useSession()

  if (status === 'loading') return null

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs font-medium text-slate-500 sm:block">{session.user?.email}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-sky-100 text-emerald-700">
          <User className="h-4 w-4" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="h-8 rounded-full px-2.5 text-xs text-slate-500 hover:bg-sky-50 hover:text-blue-700"
        >
          <LogOut className="mr-1 h-3 w-3" />
          Odhlásit
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => signIn('google')}
      className="h-9 gap-2 rounded-full border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-blue-700 hover:bg-white"
    >
      <LogIn className="h-3 w-3" />
      Přihlásit přes Google
    </Button>
  )
}
