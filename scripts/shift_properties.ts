import { supabaseAdmin } from '../lib/supabase/client'

async function moveDates() {
  // Get 25 latest sold properties
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('id')
    .eq('status', 'sold')
    .order('created_at', { ascending: false })
    .limit(25)
    
  if (error) {
    console.error('Error fetching properties', error)
    return
  }
  
  if (!data || !data.length) {
    console.log('No data found.')
    return
  }
  
  // Shift to window Nov 2025 - Apr 2026
  const start = new Date('2025-11-05T12:00:00Z').getTime()
  const end = new Date('2026-04-20T12:00:00Z').getTime()
  
  for (let i = 0; i < data.length; i++) {
    const randomTime = start + Math.random() * (end - start)
    const newDate = new Date(randomTime).toISOString()
    
    await supabaseAdmin
      .from('properties')
      .update({ created_at: newDate })
      .eq('id', data[i].id)
  }
  
  console.log(`Moved ${data.length} exported properties to recent 6-months window.`)
}

moveDates().catch(console.error)
