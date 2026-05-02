import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase/client'

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Načteme název souboru z drive_files, abychom mohli smazat i document_chunks podle source_file
  const { data: driveFile } = await supabaseAdmin
    .from('drive_files')
    .select('name')
    .eq('drive_file_id', id)
    .single()

  // Smažeme document_chunks kde source_file = název souboru
  if (driveFile?.name) {
    await supabaseAdmin
      .from('document_chunks')
      .delete()
      .eq('source_file', driveFile.name)
  }

  // Smažeme záznam z drive_files
  const { error } = await supabaseAdmin
    .from('drive_files')
    .delete()
    .eq('drive_file_id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
