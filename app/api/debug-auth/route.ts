import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  return NextResponse.json({
    isAuthenticated: !!session,
    hasAccessToken: !!session?.accessToken,
    email: session?.user?.email ?? null,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'MISSING',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
  })
}
