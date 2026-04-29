import { NextRequest, NextResponse } from 'next/server'
import { syncDrive } from '@/lib/drive/sync'
import { auth } from '@/auth'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Vercel cron autorizace
  const authHeader = req.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  // Nebo přihlášený uživatel (manuální trigger)
  const session = await auth()
  const accessToken = session?.accessToken

  if (!isCron && !accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pro cron potřebujeme uložený token — viz níže
  const token = accessToken ?? process.env.DRIVE_SYNC_TOKEN

  if (!token) {
    return NextResponse.json({ error: 'No access token available. Login first to authorize Drive sync.' }, { status: 400 })
  }

  try {
    const result = await syncDrive(token)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const msg = (err as Error).message
    console.error('Drive sync error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
