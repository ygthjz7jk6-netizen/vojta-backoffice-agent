import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase/client'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('uploaded_files')
    .select('*')
    .order('uploaded_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ files: data ?? [] })
}

export async function DELETE() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Smazání všech uploaded souborů — document_chunks padnou kaskádou (ON DELETE CASCADE)
  const { error } = await supabaseAdmin
    .from('uploaded_files')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // smaže vše (neq jako workaround pro "delete all")

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
