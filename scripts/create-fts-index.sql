CREATE INDEX IF NOT EXISTS knowledge_chunks_content_fts
  ON knowledge_chunks
  USING gin (to_tsvector('english', title || ' ' || content));