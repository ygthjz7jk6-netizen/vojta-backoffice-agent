import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../lib/supabase/client';
import * as path from 'path';

async function main() {
  const filePath = path.join(process.cwd(), 'Realitka_BackOffice_System/Uzavrene_Obchody_2020_2026.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet) as any[];

  const inserts = data.map(row => {
    // Basic mapping using available headers shown earlier
    return {
      address: row.Adresa || 'Neznámá adresa',
      city: 'Neznámé město',
      price: row.Cena_Prodej_CZK ? Number(row.Cena_Prodej_CZK) : null,
      status: 'sold',
      type: 'byt', // Placeholder for missing type
      created_at: row.Datum_Podpisu_Kupni ? new Date(row.Datum_Podpisu_Kupni).toISOString() : new Date().toISOString()
    };
  });

  const chunkSize = 200;
  let totalInserted = 0;
  
  // Clear first if we want idempotency but we omit to not delete manually managed things
  for (let i = 0; i < inserts.length; i += chunkSize) {
    const chunk = inserts.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin.from('properties').insert(chunk);
    if (error) {
      console.error('Error inserting chunk:', error);
      process.exit(1);
    }
    totalInserted += chunk.length;
  }
  
  console.log(`Successfully inserted ${totalInserted} properties.`);
}

main().catch(console.error);
