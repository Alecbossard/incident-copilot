-- Ensure pgvector is present
CREATE EXTENSION IF NOT EXISTS vector;

-- If the column does not exist, create it at 1536 dims ; else change its type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Incident' AND column_name = 'embedding'
  ) THEN
ALTER TABLE "Incident" ADD COLUMN "embedding" vector(1536);
ELSE
ALTER TABLE "Incident" ALTER COLUMN "embedding" TYPE vector(1536);
END IF;
END$$;

-- HNSW index for fast cosine similarity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'incident_embedding_hnsw'
  ) THEN
CREATE INDEX incident_embedding_hnsw
    ON "Incident" USING hnsw (embedding vector_cosine_ops);
END IF;
END$$;
