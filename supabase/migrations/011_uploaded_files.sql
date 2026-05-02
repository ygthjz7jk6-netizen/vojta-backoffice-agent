-- Tabulka pro manuálně nahrané soubory přes UI
CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT,
  chunk_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing', -- processing | ready | error
  error_message TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK na document_chunks — kaskádové mazání chunků při smazání souboru
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS uploaded_file_id UUID REFERENCES uploaded_files(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS document_chunks_uploaded_file_id_idx
  ON document_chunks(uploaded_file_id);
