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
        <span className="text-xs text-gray-500 hidden sm:block">{session.user?.email}</span>
        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
          <User className="w-4 h-4 text-green-700" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="text-xs text-gray-500 h-7 px-2"
        >
          <LogOut className="w-3 h-3 mr-1" />
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
      className="text-xs h-8 gap-2"
    >
      <LogIn className="w-3 h-3" />
      Přihlásit přes Google
    </Button>
  )
}
