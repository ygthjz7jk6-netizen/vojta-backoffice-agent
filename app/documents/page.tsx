import { AppShell } from '@/components/layout/AppShell'
import { DocumentsPage } from '@/components/documents/DocumentsPage'
import { auth } from '@/auth'
import { listDocuments } from '@/lib/documents/data'

export default async function Documents() {
  const session = await auth()
  let initialData = null
  let initialError: string | null = null

  if (!session) {
    initialError = 'Unauthorized'
  } else {
    try {
      initialData = await listDocuments()
    } catch (err) {
      initialError = err instanceof Error ? err.message : String(err)
    }
  }

  return (
    <AppShell>
      <DocumentsPage initialData={initialData} initialError={initialError} />
    </AppShell>
  )
}
