import { google } from 'googleapis'

export async function getCalendarSlots(
  accessToken: string,
  dateFrom: string,
  dateTo: string,
  durationMinutes = 60
): Promise<string[]> {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const freeBusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: new Date(dateFrom).toISOString(),
      timeMax: new Date(dateTo + 'T23:59:59').toISOString(),
      items: [{ id: 'primary' }],
    },
  })

  const busy = freeBusy.data.calendars?.primary?.busy ?? []

  // Generuj volné sloty 9:00–17:00 po durationMinutes minutách
  const slots: string[] = []
  const from = new Date(dateFrom)
  const to = new Date(dateTo)

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    // Přeskoč víkendy
    if (d.getDay() === 0 || d.getDay() === 6) continue

    for (let hour = 9; hour <= 17 - durationMinutes / 60; hour++) {
      const slotStart = new Date(d)
      slotStart.setHours(hour, 0, 0, 0)
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)

      const isBusy = busy.some(b => {
        const busyStart = new Date(b.start!)
        const busyEnd = new Date(b.end!)
        return slotStart < busyEnd && slotEnd > busyStart
      })

      if (!isBusy) {
        slots.push(
          `${slotStart.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })} ${slotStart.getHours()}:00–${slotEnd.getHours()}:00`
        )
      }
    }
  }

  return slots.slice(0, 8)
}
