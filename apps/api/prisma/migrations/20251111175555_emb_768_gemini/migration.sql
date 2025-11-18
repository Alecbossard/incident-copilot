-- Ensure pgvector is present
CREATE EXTENSION IF NOT EXISTS vector;

-- Add/alter embedding column to 768 dims for Gemini text-embedding-004
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Incident' AND column_name = 'embedding'
  ) THEN
ALTER TABLE "Incident" ADD COLUMN "embedding" vector(768);
ELSE
ALTER TABLE "Incident" ALTER COLUMN "embedding" TYPE vector(768);
END IF;
END$$;

-- HNSW index for cosine distance (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='incident_embedding_hnsw'
  ) THEN
CREATE INDEX incident_embedding_hnsw
    ON "Incident" USING hnsw (embedding vector_cosine_ops);
END IF;
END$$;
