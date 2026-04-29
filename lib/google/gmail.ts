import { google } from 'googleapis'

export async function createGmailDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const message = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
    '',
    body,
  ].join('\n')

  const encoded = Buffer.from(message).toString('base64url')

  const draft = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw: encoded } },
  })

  return draft.data.id ?? 'ok'
}
