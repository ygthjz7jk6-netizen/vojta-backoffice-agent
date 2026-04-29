import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { google } from 'googleapis'

export async function GET() {
  const session = await auth()

  let calendarTest: unknown = 'nepřihlášen'
  if (session?.accessToken) {
    try {
      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({ access_token: session.accessToken })
      const cal = google.calendar({ version: 'v3', auth: oauth2Client })
      const res = await cal.calendarList.list({ maxResults: 1 })
      calendarTest = `OK — kalendářů: ${res.data.items?.length ?? 0}`
    } catch (e) {
      calendarTest = `CHYBA: ${(e as Error).message}`
    }
  }

  return NextResponse.json({
    isAuthenticated: !!session,
    hasAccessToken: !!session?.accessToken,
    email: session?.user?.email ?? null,
    calendarTest,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'MISSING',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
  })
}
