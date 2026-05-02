-- Content-based deduplication for manual UI uploads.
-- If the exact same binary file is uploaded again, the app can reuse the
-- existing ready RAG chunks instead of parsing and embedding it again.

ALTER TABLE uploaded_files
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS uploaded_files_content_hash_idx
  ON uploaded_files(content_hash)
  WHERE content_hash IS NOT NULL;

